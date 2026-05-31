// Design Ref: §3-12 마스터 관리자 패널 — 아빠(DAD) + Master 접속 전용 (v3.0 MC Dark)
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers, updateMember } from '@/infrastructure/firebase/collections/members'
import { fsGet, fsSet, fsUpdate, fsQuery, fsDelete } from '@/infrastructure/firebase/firestore'
import { hashPin, signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'
import { getPendingObservers, approveObserver, rejectObserver, OBSERVER_TYPE_LABELS, type ObserverSession } from '@/application/use-cases/auth/observerLogin'
import { subscribeNotices, addNotice, deleteNotice, type Notice } from '@/infrastructure/firebase/collections/notices'
import {
  subscribeTournamentSettings, saveTournamentSettings, subscribeTournamentScores,
  type TournamentSettings, type TournamentScore,
} from '@/infrastructure/firebase/collections/tournament'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import type { Member } from '@/domain/entities/Member'
import { APP_VERSION } from '@/config/version'
import { ALL_QUESTIONS } from './QuestionBoxPage'

// ── 섹션 헤더 ─────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <p className="t-sub font-bold text-gold t-pixel-shadow">{title}</p>
    </div>
  )
}

const INPUT_CLS    = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'
const TEXTAREA_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub resize-none px-3 py-2.5 focus:outline-none focus:border-gold'

export default function MasterSettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const showBackButton = location.pathname === '/master'

  const { currentMember, familyId: storeFamilyId } = useAuthStore()
  const familyId = storeFamilyId ?? localStorage.getItem('familyId') ?? ''

  const [members,         setMembers]         = useState<Member[]>([])
  const [currentSettings, setCurrentSettings] = useState<{ familyCodeHash?: string; joinCode?: string } | null>(null)
  const [observers,       setObservers]       = useState<ObserverSession[]>([])
  const [observerLoading, setObserverLoading] = useState(false)

  // ── 닉네임 + loginId 수정 ────────────────────────────────────────
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editLoginId,  setEditLoginId]  = useState('')

  // ── 토스트 (PixelModal 기반) ─────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 확인 팝업 (PixelModal 기반) ──────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{ message: string; onYes: () => void } | null>(null)
  const confirm = (message: string, onYes: () => void) => setConfirmModal({ message, onYes })

  // ── 구성원 강제 내보내기 확인 ────────────────────────────────────
  const [expelTarget, setExpelTarget] = useState<Member | null>(null)

  // ── 공지사항 ─────────────────────────────────────────────────────
  const [notices,       setNotices]       = useState<Notice[]>([])
  const [noticeTitle,   setNoticeTitle]   = useState('')
  const [noticeContent, setNoticeContent] = useState('')
  const [noticeSaving,  setNoticeSaving]  = useState(false)

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim() || !familyId) return
    setNoticeSaving(true)
    const { error } = await addNotice(
      familyId, noticeTitle.trim(), noticeContent.trim(),
      currentMember?.id ?? '', currentMember?.name ?? '관리자'
    )
    setNoticeSaving(false)
    if (error) { showToast('등록 실패: ' + error, 'error'); return }
    setNoticeTitle(''); setNoticeContent('')
    showToast('공지사항이 등록됐어요', 'success')
  }

  const handleDeleteNotice = async (noticeId: string) => {
    if (!familyId) return
    const { error } = await deleteNotice(familyId, noticeId)
    if (error) { showToast('삭제 실패', 'error'); return }
    showToast('삭제됐어요', 'success')
  }

  // ── 천하제일 주간 대회 ───────────────────────────────────────────
  const defaultTS = (): TournamentSettings => ({
    active: false, title: '천하제일 가족 게임 대회', roundNumber: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate:   new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    difficulty: 3,
  })
  const [tournament,    setTournament]    = useState<TournamentSettings>(defaultTS())
  const [tournamentScs, setTournamentScs] = useState<TournamentScore[]>([])
  const [tSaving,       setTSaving]       = useState(false)

  useEffect(() => {
    if (!familyId) return
    const u1 = subscribeTournamentSettings(familyId, s => { if (s) setTournament(s) })
    const u2 = subscribeTournamentScores(familyId, setTournamentScs)
    return () => { u1(); u2() }
  }, [familyId])

  const handleTournamentSave = async () => {
    if (!familyId) return
    setTSaving(true)
    const { error } = await saveTournamentSettings(familyId, tournament)
    setTSaving(false)
    if (error) showToast('대회 설정 저장 실패: ' + error, 'error')
    else showToast('대회 설정이 저장됐어요', 'success')
  }

  const handleTournamentToggle = async () => {
    if (!familyId) return
    const next = { ...tournament, active: !tournament.active }
    setTournament(next)
    const { error } = await saveTournamentSettings(familyId, next)
    if (error) { showToast('토글 실패', 'error'); setTournament(tournament) }
    else showToast(next.active ? '🏆 대회가 시작됐어요!' : '대회가 종료됐어요', 'success')
  }

  const handleNewRound = async () => {
    if (!familyId) return
    const next: TournamentSettings = {
      ...tournament,
      active:      true,
      roundNumber: tournament.roundNumber + 1,
      startDate:   new Date().toISOString().slice(0, 10),
      endDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    }
    setTournament(next)
    await saveTournamentSettings(familyId, next)
    showToast(`제${next.roundNumber}회 대회가 시작됐어요!`, 'success')
  }

  // ── 경쟁 시스템 ON/OFF ───────────────────────────────────────────
  const [weeklyCompOn,  setWeeklyCompOn]  = useState(() => localStorage.getItem('fq_weekly_comp')  !== 'off')
  const [monthlyCompOn, setMonthlyCompOn] = useState(() => localStorage.getItem('fq_monthly_comp') !== 'off')
  const toggleWeekly  = () => { const v = !weeklyCompOn;  setWeeklyCompOn(v);  localStorage.setItem('fq_weekly_comp',  v ? 'on' : 'off') }
  const toggleMonthly = () => { const v = !monthlyCompOn; setMonthlyCompOn(v); localStorage.setItem('fq_monthly_comp', v ? 'on' : 'off') }

  // ── 롤백 스냅샷 ─────────────────────────────────────────────────
  const LS_SNAPSHOTS = 'fq_snapshots'
  type Snapshot = { ts: string; label: string; data: any }
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_SNAPSHOTS) ?? '[]') } catch { return [] }
  })

  const saveSnapshot = useCallback(() => {
    const snap: Snapshot = {
      ts: new Date().toISOString(),
      label: new Date().toLocaleString('ko-KR'),
      data: {
        members:   localStorage.getItem('fq_member_cache'),
        familyId:  localStorage.getItem('familyId'),
        lastLogin: localStorage.getItem('fq_last_login'),
        favOrder:  localStorage.getItem('fq_fav_order'),
      },
    }
    const next = [snap, ...snapshots].slice(0, 5)
    setSnapshots(next)
    localStorage.setItem(LS_SNAPSHOTS, JSON.stringify(next))
    showToast('현재 상태가 저장됐어요', 'success')
  }, [snapshots])

  const restoreSnapshot = useCallback((snap: Snapshot) => {
    if (snap.data.members)   localStorage.setItem('fq_member_cache', snap.data.members)
    if (snap.data.familyId)  localStorage.setItem('familyId', snap.data.familyId)
    if (snap.data.lastLogin) localStorage.setItem('fq_last_login', snap.data.lastLogin)
    if (snap.data.favOrder)  localStorage.setItem('fq_fav_order', snap.data.favOrder)
    showToast(`${snap.label} 기준으로 복원됐어요. 앱을 다시 시작해주세요`, 'success')
  }, [])

  const deleteSnapshot = useCallback((index: number) => {
    const next = snapshots.filter((_, i) => i !== index)
    setSnapshots(next)
    localStorage.setItem(LS_SNAPSHOTS, JSON.stringify(next))
    showToast('스냅샷이 삭제됐어요', 'success')
  }, [snapshots])

  // ── 게스트 신청 목록 로드 ───────────────────────────────────────
  const loadObservers = async () => {
    if (!familyId) return
    setObserverLoading(true)
    const list = await getPendingObservers(familyId)
    setObservers(list)
    setObserverLoading(false)
  }

  const handleApproveObserver = async (s: ObserverSession) => {
    const { error } = await approveObserver(familyId, s.id)
    if (error) { showToast('승인 실패', 'error'); return }
    showToast(`"${s.name}" 승인 완료! 24시간 접속 가능해요`, 'success')
    loadObservers()
  }

  const handleRejectObserver = async (s: ObserverSession) => {
    const { error } = await rejectObserver(familyId, s.id)
    if (error) { showToast('거절 실패', 'error'); return }
    showToast(`"${s.name}" 거절했어요`, 'success')
    loadObservers()
  }

  // ── 구성원 구독 + 설정 로드 ──────────────────────────────────────
  useEffect(() => {
    if (!familyId) return
    const unsub = subscribeMembers(familyId, setMembers, () => {})
    fsGet<any>(`families/${familyId}/config/settings`)
      .then(({ data }) => setCurrentSettings(data))
    loadObservers()
    return unsub
  }, [familyId])

  // ── 구성원 내보내기 (PixelModal confirm) ─────────────────────────
  const handleExpelConfirmed = async () => {
    if (!familyId || !expelTarget) return
    const { error } = await updateMember(familyId, expelTarget.id, { isActive: false } as any)
    if (error) { showToast('변경 실패', 'error'); return }
    showToast(`"${expelTarget.name}"을 내보냈어요`, 'success')
    setExpelTarget(null)
  }

  const handleRestore = async (member: Member) => {
    if (!familyId) return
    const { error } = await updateMember(familyId, member.id, { isActive: true } as any)
    if (error) { showToast('복구 실패', 'error'); return }
    showToast(`"${member.name}"을 복구했어요`, 'success')
  }

  // ── 닉네임 + loginId 저장 ────────────────────────────────────────
  const handleNicknameSave = async (member: Member) => {
    if (!familyId || !editNickname.trim()) return
    const updates: any = { name: editNickname.trim() }
    if (editLoginId.trim()) updates.loginId = editLoginId.trim().toLowerCase()
    const { error } = await updateMember(familyId, member.id, updates)
    if (error) { showToast('수정 실패', 'error'); return }
    if (editLoginId.trim()) {
      await fsSet(`member_login_ids/${editLoginId.trim().toLowerCase()}`, {
        familyId, memberId: member.id,
      })
    }
    showToast('저장됐어요', 'success')
    setEditingId(null)
  }

  // ── Firestore 전체 삭제 ──────────────────────────────────────────
  const FAMILY_SUBCOLLECTIONS = [
    'members', 'missions', 'rewards', 'messages',
    'notifications', 'begging', 'special_days', 'question_answers',
  ]

  const deleteAllFamilyData = async (): Promise<string | null> => {
    if (!familyId) return '가족 ID가 없어요'
    try {
      for (const sub of FAMILY_SUBCOLLECTIONS) {
        const { data } = await fsQuery<any>(`families/${familyId}/${sub}`, [])
        for (const doc of data) await fsDelete(`families/${familyId}/${sub}/${doc.id}`)
      }
      await fsDelete(`families/${familyId}/config/settings`)
      if (currentSettings?.joinCode) await fsDelete(`family_codes/${currentSettings.joinCode}`)
      return null
    } catch (e: any) {
      return e?.message ?? '삭제 중 오류가 발생했어요'
    }
  }

  // ── 앱 초기화 ───────────────────────────────────────────────────
  const { clearSession } = useAuthStore()
  const [showResetPin,  setShowResetPin]  = useState(false)
  const [resetPinInput, setResetPinInput] = useState('')
  const [resetPinError, setResetPinError] = useState('')
  const [resetLoading,  setResetLoading]  = useState(false)

  const handleAppReset = async () => {
    setResetLoading(true)
    setResetPinError('')
    if (currentMember?.pinHash) {
      const hashed = await hashPin(resetPinInput)
      if (hashed !== currentMember.pinHash) {
        setResetPinError('PIN이 틀렸어요 🔒')
        setResetLoading(false)
        return
      }
    }
    const deleteError = await deleteAllFamilyData()
    if (deleteError) {
      showToast('초기화 실패: ' + deleteError, 'error')
      setResetLoading(false)
      return
    }
    await signOut()
    clearSession()
    clearAllLocalData()
    window.location.replace('/login')
  }

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-panel-dark">

      {/* ── 토스트 팝업 (PixelModal 규칙 3 준수) ─────────────────── */}
      <PixelModal
        open={!!toast}
        onClose={() => setToast(null)}
        title={toast?.type === 'success' ? '✅ 완료' : '❌ 오류'}
        size="sm"
      >
        <p className={`font-korean text-sm text-center py-2 ${toast?.type === 'success' ? 'text-approved' : 'text-rejected'}`}>
          {toast?.message}
        </p>
        <PixelButton variant="ghost" size="sm" fullWidth onClick={() => setToast(null)}>닫기</PixelButton>
      </PixelModal>

      {/* ── 확인 팝업 ────────────────────────────────────────────── */}
      <PixelModal
        open={!!confirmModal}
        title="확인"
        onClose={() => setConfirmModal(null)}
        size="sm"
      >
        <p className="font-korean text-sm text-cream text-center mb-5 whitespace-pre-line">
          {confirmModal?.message}
        </p>
        <div className="flex gap-3">
          <PixelButton variant="ghost" className="flex-1" onClick={() => setConfirmModal(null)}>취소</PixelButton>
          <PixelButton variant="danger" className="flex-1"
            onClick={() => { confirmModal?.onYes(); setConfirmModal(null) }}>
            실행
          </PixelButton>
        </div>
      </PixelModal>

      {/* ── 구성원 내보내기 확인 팝업 ────────────────────────────── */}
      <PixelModal
        open={!!expelTarget}
        title="구성원 내보내기"
        onClose={() => setExpelTarget(null)}
        size="sm"
      >
        <p className="font-korean text-sm text-cream text-center mb-1">
          "{expelTarget?.name}"을 내보내겠어요?
        </p>
        <p className="font-korean text-xs text-panel-sub text-center mb-5">
          해당 구성원은 더 이상 로그인할 수 없어요.
        </p>
        <div className="flex gap-3">
          <PixelButton variant="ghost" className="flex-1" onClick={() => setExpelTarget(null)}>취소</PixelButton>
          <PixelButton variant="danger" className="flex-1" onClick={handleExpelConfirmed}>내보내기</PixelButton>
        </div>
      </PixelModal>

      {/* ── 헤더 ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-panel-darkest border-b-4 border-gold/30 px-4 py-3 flex items-center gap-3">
        {showBackButton && (
          <PixelButton variant="ghost" size="sm" onClick={() => navigate(-1)}>← 뒤로</PixelButton>
        )}
        <h1 className="t-heading t-pixel-shadow">⛏ 아빠 작업방</h1>
        {currentMember && (
          <span className="ml-auto t-micro text-panel-sub">
            {currentMember.name} 접속 중
          </span>
        )}
      </div>

      <div className="p-3 pb-8 space-y-4 max-w-lg mx-auto">

        {/* ── ⚡ 엔진 완전 새로고침 버튼 ──────────────────────────── */}
        <div className="card-pixel p-3">
          <SectionHeader icon="⚡" title="엔진 완전 새로고침" />
          <p className="font-korean text-xs text-panel-sub mb-3">
            바탕화면 바로가기 캐시 꼬임 문제 해결용.<br />
            서비스 워커 캐시 + LocalStorage + SessionStorage를 강제 초기화하고 앱을 재시작합니다.
          </p>
          <PixelButton
            variant="danger"
            size="lg"
            fullWidth
            onClick={async () => {
              // 1. 서비스 워커 캐시 전체 삭제
              if ('caches' in window) {
                const keys = await window.caches.keys()
                await Promise.all(keys.map(k => window.caches.delete(k)))
              }
              // 2. 서비스 워커 등록 해제
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(regs.map(r => r.unregister()))
              }
              // 3. SessionStorage 초기화
              sessionStorage.clear()
              // 4. 게임 관련 임시 키 정리 (fq_inv_* 등 유지, 꼬인 캐시만 제거)
              const preserveKeys = [
                'familyId', 'fq_last_login', 'fq_login_at', 'fq_member_cache',
                'fq_fav_order', 'fq_weekly_comp', 'fq_monthly_comp',
                'fq_bgm_theme', 'fq_inv_weapon', 'fq_inv_skin', 'fq_inv_pet', 'fq_inv_xp',
                'fq_snapshots',
              ]
              const allKeys = Object.keys(localStorage)
              allKeys
                .filter(k => !preserveKeys.includes(k))
                .forEach(k => localStorage.removeItem(k))
              // 5. 하드 리로드
              window.location.reload()
            }}
          >
            ⚡ 캐시 강제 초기화 + 재시작
          </PixelButton>
        </div>

        {/* ── 1. 구성원 관리 ──────────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="👥" title={`구성원 관리 (${members.length}/4명)`} />

          {members.length === 0 ? (
            <p className="t-sub text-panel-sub text-center py-4">
              {familyId ? '구성원을 불러오는 중...' : '가족 ID가 없어요'}
            </p>
          ) : (
            <div className="space-y-3">
              {[...members].sort((a, b) => {
                const order: Record<string, number> = { DAD: 0, MOM: 1, CHILD: 2, OBSERVER: 3 }
                return (order[a.role] ?? 9) - (order[b.role] ?? 9)
              }).map(member => {
                const isParentMember = member.role === 'DAD' || member.role === 'MOM'
                const displayLevel   = isParentMember ? 100 : member.level
                const displayExp     = isParentMember ? 99999 : member.exp
                return (
                  /* 각 구성원 행 → card-pixel 독립 상자 */
                  <div key={member.id}
                    className={`card-pixel p-3 space-y-2 ${!member.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <CharacterSprite
                        characterId={member.character.characterId}
                        role={member.role}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        {editingId === member.id ? (
                          <div className="space-y-1.5">
                            <input
                              value={editNickname}
                              onChange={e => setEditNickname(e.target.value)}
                              maxLength={10}
                              placeholder="닉네임"
                              autoFocus
                              className={INPUT_CLS}
                            />
                            <input
                              value={editLoginId}
                              onChange={e => setEditLoginId(e.target.value.replace(/\s/g, ''))}
                              maxLength={20}
                              placeholder="로그인 ID (영문+숫자, 새 기기 로그인용)"
                              className={INPUT_CLS}
                            />
                            <div className="flex gap-1.5">
                              <PixelButton size="sm" variant="gold" onClick={() => handleNicknameSave(member)}>저장</PixelButton>
                              <PixelButton size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</PixelButton>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="t-sub font-bold text-cream">
                              {member.name}
                              {member.realName && member.realName !== member.name && (
                                <span className="text-panel-sub font-normal ml-1">({member.realName})</span>
                              )}
                            </p>
                            {(member as any).loginId && (
                              <span className="font-korean text-xs text-sky border border-sky px-1">
                                ID: {(member as any).loginId}
                              </span>
                            )}
                            <PixelButton size="sm" variant="ghost"
                              onClick={() => {
                                setEditingId(member.id)
                                setEditNickname(member.name)
                                setEditLoginId((member as any).loginId ?? '')
                              }}>
                              수정
                            </PixelButton>
                          </div>
                        )}
                        <p className="t-micro text-panel-sub mt-0.5">
                          {member.role === 'DAD' ? '아빠' : member.role === 'MOM' ? '엄마' : '자녀'}
                          {' · '}Lv.{displayLevel}
                          {' · '}EXP {displayExp.toLocaleString('ko-KR')}
                          {isParentMember && <span className="text-gold ml-1">👑</span>}
                          {!member.isActive && <span className="text-rejected ml-1 font-bold">(비활성)</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {member.isActive && currentMember?.id !== member.id && (
                        <PixelButton variant="danger" size="sm" onClick={() => setExpelTarget(member)}>
                          내보내기
                        </PixelButton>
                      )}
                      {!member.isActive && (
                        <PixelButton variant="success" size="sm" onClick={() => handleRestore(member)}>
                          복구
                        </PixelButton>
                      )}
                      {currentMember?.id === member.id && (
                        <span className="t-micro text-gold self-center">← 현재 접속 중</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 4. 게스트 접속 신청 관리 ────────────────────────────── */}
        <div className="card-pixel p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon="👀" title="게스트 접속 신청" />
            <PixelButton size="sm" variant="ghost" onClick={loadObservers}>새로고침</PixelButton>
          </div>
          {observerLoading ? (
            <p className="t-sub text-panel-sub text-center py-3">불러오는 중...</p>
          ) : observers.length === 0 ? (
            <p className="t-sub text-panel-sub text-center py-3">대기 중인 게스트 신청이 없어요</p>
          ) : (
            <div className="space-y-3">
              {observers.map(s => (
                <div key={s.id} className="card-pixel p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="t-sub font-bold text-cream">
                        {s.name}
                        <span className="font-normal text-panel-sub ml-1">
                          {OBSERVER_TYPE_LABELS[s.type]}
                        </span>
                      </p>
                      <p className="t-micro text-panel-sub">전화 끝 4자리: {s.phoneLast4}</p>
                    </div>
                    <span className="t-micro text-hold font-bold">대기중</span>
                  </div>
                  <div className="flex gap-2">
                    <PixelButton variant="success" size="sm" onClick={() => handleApproveObserver(s)}>
                      ✅ 승인 (24h)
                    </PixelButton>
                    <PixelButton variant="danger" size="sm" onClick={() => handleRejectObserver(s)}>
                      ❌ 거절
                    </PixelButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 5. 두근두근 질문함 ──────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="💌" title={`두근두근 질문함 (총 ${ALL_QUESTIONS.length}개)`} />
          <p className="t-micro text-panel-sub mb-3">아이들이 매일 1개씩 질문에 답해요. 답변과 감정을 확인할 수 있어요.</p>
          <div className="space-y-2 mb-3">
            {ALL_QUESTIONS.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-panel-border last:border-0">
                <span className="font-pixel text-xs text-gold mt-0.5 flex-shrink-0">Q{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="t-sub text-cream">{item.q}</p>
                  <p className="t-micro text-approved mt-0.5">보상: {item.reward}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <PixelButton variant="gold" size="md" className="flex-[2]"
              onClick={() => navigate('/settings/question-answers')}>
              답변 목록 보기 →
            </PixelButton>
            <PixelButton variant="ghost" size="md" className="flex-1"
              onClick={() => navigate('/settings/questions')}>
              전체 ({ALL_QUESTIONS.length}개)
            </PixelButton>
          </div>
        </div>

        {/* ── 5-b. 기념일·생일 관리 ───────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="📅" title="기념일·생일 관리" />
          <p className="t-micro text-panel-sub mb-3">생일·기념일·특별일을 등록하면 달력에 이모지로 표시돼요.</p>
          <PixelButton variant="gold" size="md" fullWidth onClick={() => navigate('/settings/special-days')}>
            기념일·생일 관리 →
          </PixelButton>
        </div>

        {/* ── 5-c. 천하제일 주간 대회 제어판 ─────────────────────────── */}
        <div className="card-pixel p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon="🏆" title="천하제일 주간 대회 제어판" />
            <PixelButton
              size="sm"
              variant={tournament.active ? 'danger' : 'success'}
              onClick={handleTournamentToggle}
            >
              {tournament.active ? '⏹ 대회 종료' : '▶ 대회 시작'}
            </PixelButton>
          </div>

          {/* 현재 대회 상태 배지 */}
          <div className={`px-3 py-2 mb-4 border-2 ${tournament.active ? 'border-gold bg-gold/10' : 'border-panel-border bg-panel-darkest'}`}>
            <p className="font-pixel text-xs text-gold">
              {tournament.active ? '🔴 LIVE' : '⚪ 대기'} — 제{tournament.roundNumber}회
            </p>
            <p className="font-korean text-sm font-bold text-cream mt-0.5">{tournament.title}</p>
            <p className="font-korean text-xs text-panel-sub">{tournament.startDate} ~ {tournament.endDate}</p>
          </div>

          {/* 대회 설정 폼 */}
          <div className="space-y-3 mb-4">
            <div>
              <p className="t-micro text-panel-sub mb-1">대회 이름</p>
              <input
                value={tournament.title}
                onChange={e => setTournament(p => ({ ...p, title: e.target.value }))}
                maxLength={30}
                placeholder="대회 이름"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="t-micro text-panel-sub mb-1">시작일</p>
                <input
                  type="date"
                  value={tournament.startDate}
                  onChange={e => setTournament(p => ({ ...p, startDate: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
              <div className="flex-1">
                <p className="t-micro text-panel-sub mb-1">종료일</p>
                <input
                  type="date"
                  value={tournament.endDate}
                  onChange={e => setTournament(p => ({ ...p, endDate: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
            </div>

            {/* ── 난이도 슬라이더 ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="t-micro text-panel-sub">게임 기본 난이도</p>
                <p className="font-pixel text-xs text-gold">
                  {'★'.repeat(tournament.difficulty)}{'☆'.repeat(5 - tournament.difficulty)}
                  {' '}Lv.{tournament.difficulty}
                </p>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={tournament.difficulty}
                onChange={e => setTournament(p => ({ ...p, difficulty: Number(e.target.value) }))}
                className="w-full h-2 accent-gold cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #FFD700 0%, #FFD700 ${(tournament.difficulty - 1) / 4 * 100}%, #1A1A1A ${(tournament.difficulty - 1) / 4 * 100}%, #1A1A1A 100%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                {['쉬움', '보통', '중간', '어려움', '지옥'].map((l, i) => (
                  <span key={l}
                    className={`font-korean text-[10px] ${tournament.difficulty === i + 1 ? 'text-gold font-bold' : 'text-panel-sub'}`}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <PixelButton
              variant="gold" size="md" className="flex-1"
              disabled={tSaving}
              onClick={handleTournamentSave}
            >
              {tSaving ? '저장 중...' : '💾 설정 저장'}
            </PixelButton>
            <PixelButton
              variant="sky" size="md" className="flex-1"
              onClick={() => confirm('새 회차를 시작할까요? 기존 대회는 유지되고 새 랭킹이 시작돼요.', handleNewRound)}
            >
              ⏭ 다음 회차
            </PixelButton>
          </div>

          {/* ── 대회 점수 히스토리 ────────────────────────────────── */}
          {tournamentScs.length > 0 && (
            <div>
              <p className="t-micro text-panel-sub font-bold mb-2">
                📊 제{tournament.roundNumber}회 대회 랭킹
              </p>
              {(() => {
                const roundScores = tournamentScs
                  .filter(s => s.roundNumber === tournament.roundNumber)
                  .slice(0, 5)
                if (roundScores.length === 0) return (
                  <p className="t-micro text-panel-sub text-center py-2">아직 기록 없음</p>
                )
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'] as const
                return (
                  <div className="space-y-1">
                    {roundScores.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 px-2 py-1 card-pixel">
                        <span className="text-base">{medals[i]}</span>
                        <span className="font-korean text-xs text-cream flex-1 truncate">
                          {s.memberName}
                          <span className="text-panel-sub ml-1">
                            ({s.gameId === 'galaga' ? '갤러그' : s.gameId === 'tetris' ? '테트리스' : s.gameId === 'ponpoko' ? '너구리' : '뱀꼬리'})
                          </span>
                        </span>
                        <span className="font-pixel text-xs text-gold">{s.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* 회차 선택 히스토리 */}
              {tournament.roundNumber > 1 && (
                <div className="mt-3">
                  <p className="t-micro text-panel-sub font-bold mb-1">📜 전 회차 결과</p>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: tournament.roundNumber - 1 }, (_, i) => i + 1).reverse().map(round => {
                      const top = tournamentScs
                        .filter(s => s.roundNumber === round)
                        .slice(0, 1)[0]
                      return (
                        <div key={round}
                          className="card-pixel px-2 py-1 text-center min-w-[80px]">
                          <p className="font-pixel text-[9px] text-gold">제{round}회</p>
                          {top ? (
                            <>
                              <p className="font-korean text-[10px] text-cream truncate">{top.memberName}</p>
                              <p className="font-pixel text-[9px] text-approved">{top.score.toLocaleString()}</p>
                            </>
                          ) : (
                            <p className="font-korean text-[10px] text-panel-sub">기록없음</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 6. 경쟁 시스템 설정 ─────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="🥇" title="경쟁 시스템 설정" />
          <p className="t-micro text-panel-sub mb-3">아이들 간의 주간·월간 왕관 경쟁을 ON/OFF 설정해요.</p>
          <div className="space-y-3">
            {[
              { label: '주간 경쟁 (은 왕관 🥈)', desc: '매주 미션 완료 1위 아이에게 수여', on: weeklyCompOn,  toggle: toggleWeekly },
              { label: '월간 경쟁 (금 왕관 🥇)', desc: '매달 누적 점수 1위 아이에게 수여', on: monthlyCompOn, toggle: toggleMonthly },
            ].map(item => (
              <div key={item.label}
                className="card-pixel p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="t-sub font-bold text-cream">{item.label}</p>
                  <p className="t-micro text-panel-sub">{item.desc}</p>
                </div>
                <PixelButton
                  size="sm"
                  variant={item.on ? 'success' : 'ghost'}
                  onClick={item.toggle}
                >
                  {item.on ? 'ON' : 'OFF'}
                </PixelButton>
              </div>
            ))}
          </div>
        </div>

        {/* ── 공지사항 관리 ────────────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="📢" title="공지사항 관리" />
          <p className="t-micro text-panel-sub mb-3">홈 화면 하단에 최근 5개 공지사항이 아코디언으로 표시돼요.</p>
          <div className="space-y-2 mb-4">
            <input
              value={noticeTitle}
              onChange={e => setNoticeTitle(e.target.value)}
              placeholder="제목"
              maxLength={30}
              className={INPUT_CLS}
            />
            <textarea
              value={noticeContent}
              onChange={e => setNoticeContent(e.target.value)}
              placeholder="내용 (최대 5줄 표시)"
              rows={3}
              maxLength={300}
              className={TEXTAREA_CLS}
            />
            <PixelButton
              variant="purple" size="md" fullWidth
              disabled={noticeSaving || !noticeTitle.trim() || !noticeContent.trim()}
              onClick={handleAddNotice}
            >
              {noticeSaving ? '등록 중...' : '공지 등록'}
            </PixelButton>
          </div>
          {notices.length > 0 && (
            <div className="space-y-2">
              <p className="t-micro text-panel-sub font-bold">등록된 공지 ({notices.length}개)</p>
              {notices.map(n => (
                <div key={n.id} className="card-pixel p-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="t-sub font-bold text-cream truncate">{n.title}</p>
                    <p className="t-micro text-panel-sub">
                      {n.createdAt.toLocaleDateString()} · {n.authorName}
                    </p>
                  </div>
                  <PixelButton variant="danger" size="sm" flex-shrink-0
                    onClick={() => confirm(`"${n.title}" 공지를 삭제할까요?`, () => handleDeleteNotice(n.id))}>
                    삭제
                  </PixelButton>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 7. 보상 종류 관리 ────────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="💰" title="보상 종류 관리" />
          <p className="t-micro text-panel-sub mb-3">커스텀 보상을 최대 10종까지 등록할 수 있어요.</p>
          <div className="space-y-2">
            {[
              { emoji: '💰', label: '용돈',       unit: '100원 단위' },
              { emoji: '🎮', label: '게임시간',   unit: '10분 단위' },
              { emoji: '📱', label: '핸드폰시간', unit: '10분 단위' },
              { emoji: '🎁', label: '선물',       unit: '텍스트 입력' },
              { emoji: '🍕', label: '외식',       unit: '텍스트 입력' },
            ].map(item => (
              <div key={item.label}
                className="flex items-center gap-3 py-1.5 border-b border-panel-border last:border-0">
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="t-sub font-bold text-cream">{item.label}</p>
                  <p className="t-micro text-panel-sub">{item.unit}</p>
                </div>
                <span className="t-micro text-approved font-bold flex-shrink-0">사용중</span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <PixelButton variant="ghost" size="md" fullWidth onClick={() => navigate('/settings/reward-types')}>
              전체 보상 관리 →
            </PixelButton>
          </div>
        </div>

        {/* ── 앱 정보 ──────────────────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="ℹ️" title="앱 정보" />
          <div className="space-y-1.5">
            {[
              { label: '버전',      value: `v${APP_VERSION}`, cls: 'text-gold' },
              { label: '서비스명',  value: '패밀리 퀘스트',    cls: 'text-cream' },
              { label: '최대 구성원', value: '4명',           cls: 'text-cream' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="t-micro text-panel-sub">{item.label}</span>
                <span className={`t-micro font-bold ${item.cls}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 롤백 스냅샷 ──────────────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="💾" title="상태 저장 & 롤백" />
          <p className="t-micro text-panel-sub mb-3">
            현재 상태를 저장하고, 이전 시점으로 복원할 수 있어요. (최대 5개 보관)
          </p>
          <PixelButton variant="gold" size="md" fullWidth className="mb-3" onClick={saveSnapshot}>
            💾 지금 상태 저장
          </PixelButton>
          {snapshots.length > 0 ? (
            <div className="space-y-2">
              <p className="t-micro text-gold font-bold">저장된 스냅샷</p>
              {snapshots.map((snap, i) => (
                <div key={i} className="card-pixel p-2 flex items-center gap-2">
                  <span className="t-sub text-cream flex-1 min-w-0 truncate">{snap.label}</span>
                  <PixelButton variant="sky" size="sm"
                    onClick={() => confirm(
                      `"${snap.label}" 기준으로 복원할까요?\n앱이 재시작됩니다.`,
                      () => restoreSnapshot(snap)
                    )}>
                    복원
                  </PixelButton>
                  <PixelButton variant="danger" size="sm"
                    onClick={() => confirm(`"${snap.label}" 스냅샷을 삭제할까요?`, () => deleteSnapshot(i))}>
                    삭제
                  </PixelButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="t-micro text-panel-sub text-center">저장된 스냅샷이 없어요</p>
          )}
        </div>

        {/* ── 앱 초기화 ────────────────────────────────────────────── */}
        <div className="card-pixel p-4">
          <SectionHeader icon="🔄" title="앱 초기화" />
          <p className="t-micro text-panel-sub mb-3">
            로그인 정보와 로컬 캐시를 전부 삭제해요.<br/>
            새로 가입하거나 다른 계정으로 시작할 때 사용해요.
          </p>
          {!showResetPin ? (
            <PixelButton variant="danger" size="lg" fullWidth
              onClick={() => { setShowResetPin(true); setResetPinInput(''); setResetPinError('') }}>
              앱 데이터 초기화
            </PixelButton>
          ) : (
            <div className="space-y-2">
              <p className="t-sub font-bold text-rejected">
                ⚠️ 되돌릴 수 없어요. PIN을 입력하고 확인해주세요.
              </p>
              <input
                type="password"
                value={resetPinInput}
                onChange={e => setResetPinInput(e.target.value)}
                placeholder={currentMember?.pinHash ? '현재 PIN 입력' : 'PIN 확인 불필요'}
                maxLength={8}
                className={`${INPUT_CLS} !border-rejected`}
              />
              {resetPinError && (
                <p className="t-sub text-rejected font-bold">{resetPinError}</p>
              )}
              <div className="flex gap-2">
                <PixelButton variant="ghost" size="md" className="flex-1"
                  onClick={() => setShowResetPin(false)}>
                  취소
                </PixelButton>
                <PixelButton variant="danger" size="md" className="flex-1"
                  disabled={resetLoading || (!!currentMember?.pinHash && !resetPinInput)}
                  onClick={handleAppReset}>
                  {resetLoading ? '초기화 중...' : '완전 초기화'}
                </PixelButton>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
