// Design Ref: §3-12 마스터 관리자 패널 — 아빠(DAD) + Master 접속 전용
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers, updateMember } from '@/infrastructure/firebase/collections/members'
import { fsGet, fsUpdate, fsQuery, fsDelete } from '@/infrastructure/firebase/firestore'
import { setFamilyJoinCode } from '@/infrastructure/firebase/collections/familyCodes'
import { hashFamilyCode, hashPin, signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'
import { getPendingObservers, approveObserver, rejectObserver, OBSERVER_TYPE_LABELS, type ObserverSession } from '@/application/use-cases/auth/observerLogin'
import { subscribeNotices, addNotice, deleteNotice, type Notice } from '@/infrastructure/firebase/collections/notices'
import { sendManualReward } from '@/infrastructure/firebase/collections/rewards'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import type { Member } from '@/domain/entities/Member'
import { APP_VERSION } from '@/config/version'
import { ALL_QUESTIONS } from './QuestionBoxPage'

// ── 확인 팝업 ─────────────────────────────────────────────────────
function ConfirmModal({ message, onYes, onNo }: { message: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-cream border-4 border-pixel-dark w-full max-w-sm p-5 shadow-pixel">
        <p className="font-korean text-sm font-bold text-pixel-dark text-center mb-5">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onYes}
            className="flex-1 py-3 bg-rejected border-4 border-red-800 font-korean text-sm font-bold
                       text-white hover:bg-red-600 active:translate-y-0.5 transition-all">
            네, 실행할게요
          </button>
          <button type="button" onClick={onNo}
            className="flex-1 py-3 bg-cream border-4 border-pixel-dark font-korean text-sm font-bold
                       text-pixel-dark hover:border-gold active:translate-y-0.5 transition-all">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 토스트 ────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 p-6">
      <div className={`w-full max-w-xs px-5 py-4 border-4 border-pixel-dark font-korean text-sm
                       animate-fade-slide-up text-center
                       ${type === 'success' ? 'bg-approved text-white' : 'bg-rejected text-white'}`}>
        {type === 'success' ? '✅ ' : '❌ '}{message}
      </div>
    </div>
  )
}

// ── 섹션 헤더 ─────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <p className="font-korean text-sm font-bold text-purple">{title}</p>
    </div>
  )
}

export default function MasterSettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // /master: AppLayout 밖 → 헤더 없음(뒤로가기 필요) / /settings/master: 헤더 있음(뒤로가기 불필요)
  const showBackButton = location.pathname === '/master'

  // familyId: store 우선, 없으면 localStorage (직접 /master 접근 시 store가 비어있을 수 있음)
  const { currentMember, familyId: storeFamilyId } = useAuthStore()
  const familyId = storeFamilyId ?? localStorage.getItem('familyId') ?? ''

  const [members, setMembers] = useState<Member[]>([])
  const [currentSettings, setCurrentSettings] = useState<{ familyCodeHash?: string; joinCode?: string } | null>(null)

  // ── 가족 비밀 코드 ──────────────────────────────────────────────
  const [newJoinCode, setNewJoinCode]       = useState('')
  const [showJoinCode, setShowJoinCode]     = useState(false)
  const [showCurrentCode, setShowCurrentCode] = useState(false)
  const joinCodeValid = newJoinCode.trim().length >= 4
  const [observers, setObservers] = useState<ObserverSession[]>([])
  const [observerLoading, setObserverLoading] = useState(false)

  // ── 인증키 변경 ──────────────────────────────────────────────────
  const [newCode, setNewCode] = useState('')
  const [newCodeConfirm, setNewCodeConfirm] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [showCodeConfirm, setShowCodeConfirm] = useState(false)
  const codeMatch = newCode.trim().length >= 4 && newCode === newCodeConfirm

  // ── 닉네임 수정 ──────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')

  // ── 토스트 ──────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 확인 팝업 ────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<{ message: string; onYes: () => void } | null>(null)
  const confirm = (message: string, onYes: () => void) => setConfirmModal({ message, onYes })

  // ── 수동 보상 발송 ───────────────────────────────────────────────
  const [rewardMemberId,  setRewardMemberId]  = useState('')
  const [rewardType,      setRewardType]      = useState('MONEY')
  const [rewardAmount,    setRewardAmount]    = useState('')
  const [rewardLabel,     setRewardLabel]     = useState('')
  const [rewardSending,   setRewardSending]   = useState(false)

  const handleSendReward = async () => {
    if (!familyId || !rewardMemberId || !rewardAmount) return
    setRewardSending(true)
    const { error } = await sendManualReward(
      familyId,
      rewardMemberId,
      currentMember?.id ?? '',
      rewardType,
      Number(rewardAmount),
      rewardLabel || undefined,
    )
    setRewardSending(false)
    if (error) { showToast('발송 실패: ' + error, 'error'); return }
    showToast('보상을 발송했어요! ✅', 'success')
    setRewardAmount(''); setRewardLabel('')
  }

  // ── 공지사항 ─────────────────────────────────────────────────────
  const [notices, setNotices]       = useState<Notice[]>([])
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeContent, setNoticeContent] = useState('')
  const [noticeSaving, setNoticeSaving] = useState(false)

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim() || !familyId) return
    setNoticeSaving(true)
    const authorName = currentMember?.name ?? '관리자'
    const authorId   = currentMember?.id ?? ''
    const { error } = await addNotice(familyId, noticeTitle.trim(), noticeContent.trim(), authorId, authorName)
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
        members: localStorage.getItem('fq_member_cache'),
        familyId: localStorage.getItem('familyId'),
        lastLogin: localStorage.getItem('fq_last_login'),
        favOrder: localStorage.getItem('fq_fav_order'),
      },
    }
    const next = [snap, ...snapshots].slice(0, 5) // 최대 5개 유지
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

  // ── 가족 인증키 변경 ─────────────────────────────────────────────
  const handleChangeCode = async () => {
    if (!familyId) return
    if (!codeMatch) { showToast('인증키를 올바르게 입력해주세요 (4자 이상, 두 칸 일치)', 'error'); return }
    const codeHash = await hashFamilyCode(newCode.trim())
    const { error } = await fsUpdate(`families/${familyId}/config/settings`, { familyCodeHash: codeHash })
    if (error) { showToast('변경에 실패했어요', 'error'); return }
    showToast('인증키가 변경되었어요', 'success')
    setNewCode(''); setNewCodeConfirm('')
  }

  // ── 가족 비밀 코드 설정 ──────────────────────────────────────────
  const handleSetJoinCode = async () => {
    if (!familyId) return
    if (!joinCodeValid) { showToast('비밀 코드는 4자 이상이어야 해요', 'error'); return }
    const oldCode = currentSettings?.joinCode ?? null
    const { error } = await setFamilyJoinCode(familyId, oldCode, newJoinCode.trim())
    if (error) { showToast('저장에 실패했어요: ' + error, 'error'); return }
    // settings 다시 로드
    fsGet<any>(`families/${familyId}/config/settings`).then(({ data }) => setCurrentSettings(data))
    showToast('비밀 코드가 설정됐어요!', 'success')
    setNewJoinCode('')
  }

  // ── 구성원 내보내기 ──────────────────────────────────────────────
  const handleExpel = async (member: Member) => {
    if (!familyId) return
    if (!window.confirm(`"${member.name}"을 내보내겠어요?\n해당 구성원은 더 이상 로그인할 수 없어요.`)) return
    const { error } = await updateMember(familyId, member.id, { isActive: false } as any)
    if (error) { showToast('변경 실패', 'error'); return }
    showToast(`"${member.name}"을 내보냈어요`, 'success')
  }

  // ── 구성원 복구 ──────────────────────────────────────────────────
  const handleRestore = async (member: Member) => {
    if (!familyId) return
    const { error } = await updateMember(familyId, member.id, { isActive: true } as any)
    if (error) { showToast('복구 실패', 'error'); return }
    showToast(`"${member.name}"을 복구했어요`, 'success')
  }

  // ── 닉네임 저장 ──────────────────────────────────────────────────
  const handleNicknameSave = async (member: Member) => {
    if (!familyId || !editNickname.trim()) return
    const { error } = await updateMember(familyId, member.id, { name: editNickname.trim() } as any)
    if (error) { showToast('수정 실패', 'error'); return }
    showToast('닉네임이 변경되었어요', 'success')
    setEditingId(null)
  }

  // ── Firestore 전체 삭제 (앱 초기화 핵심) ────────────────────────
  // 모든 서브컬렉션 문서를 삭제 → 다른 기기에서 getMember=null → SessionRestorer 강제 kick-out
  const FAMILY_SUBCOLLECTIONS = [
    'members', 'missions', 'rewards', 'messages',
    'notifications', 'begging', 'special_days', 'question_answers',
  ]

  const deleteAllFamilyData = async (): Promise<string | null> => {
    if (!familyId) return '가족 ID가 없어요'
    try {
      // 1. 각 서브컬렉션의 모든 문서 삭제
      for (const sub of FAMILY_SUBCOLLECTIONS) {
        const { data } = await fsQuery<any>(`families/${familyId}/${sub}`, [])
        for (const doc of data) {
          await fsDelete(`families/${familyId}/${sub}/${doc.id}`)
        }
      }
      // 2. config/settings 삭제
      await fsDelete(`families/${familyId}/config/settings`)
      // 3. family_codes 엔트리 삭제 (joinCode 있을 때)
      if (currentSettings?.joinCode) {
        await fsDelete(`family_codes/${currentSettings.joinCode}`)
      }
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

    // 1. PIN 검증
    if (currentMember?.pinHash) {
      const hashed = await hashPin(resetPinInput)
      if (hashed !== currentMember.pinHash) {
        setResetPinError('PIN이 틀렸어요 🔒')
        setResetLoading(false)
        return
      }
    }

    // 2. Firestore 전체 삭제 (로그인 상태에서 먼저 실행해야 보안규칙 통과)
    //    → 다른 기기: getMember=null → SessionRestorer가 자동 kick-out
    const deleteError = await deleteAllFamilyData()
    if (deleteError) {
      showToast('초기화 실패: ' + deleteError, 'error')
      setResetLoading(false)
      return
    }

    // 3. 현재 기기 Firebase 로그아웃 + 로컬 완전 삭제
    await signOut()
    clearSession()
    clearAllLocalData()

    // 4. 하드 리셋 (Zustand 메모리까지 완전 초기화)
    window.location.replace('/login')
  }

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-minecraft">
      {toast && <Toast message={toast.message} type={toast.type} />}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onYes={() => { confirmModal.onYes(); setConfirmModal(null) }}
          onNo={() => setConfirmModal(null)}
        />
      )}

      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-10 bg-pixel-dark border-b-4 border-dirt px-4 py-3 flex items-center gap-3">
        {showBackButton && (
          <button type="button" onClick={() => navigate(-1)}
            className="font-korean text-cream text-sm font-bold">
            ← 뒤로
          </button>
        )}
        <h1 className="font-korean text-sm font-bold text-gold">⛏ 아빠 작업방</h1>
        {currentMember && (
          <span className="ml-auto font-korean text-xs text-stone">
            {currentMember.name} 접속 중
          </span>
        )}
      </div>

      <div className="p-3 pb-8 space-y-4 max-w-lg mx-auto">

        {/* ── 1. 가족 인증키 변경 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="🔑" title="가족 인증키 변경" />
          <p className="font-korean text-xs text-stone mb-3">
            새 인증키를 두 번 입력해서 확인해요. (4자 이상)
          </p>

          <div className="relative mb-2">
            <input
              type={showCode ? 'text' : 'password'}
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              placeholder="새 가족 인증키"
              className={`w-full bg-pixel-dark text-gold font-korean text-sm pr-10
                         border-4 px-3 py-2.5 focus:outline-none focus:border-gold
                         ${newCode && newCodeConfirm && !codeMatch ? 'border-rejected' : 'border-pixel-dark'}`}
            />
            <button type="button" onClick={() => setShowCode(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
              {showCode ? '🙈' : '👁️'}
            </button>
          </div>

          <div className="relative mb-2">
            <input
              type={showCodeConfirm ? 'text' : 'password'}
              value={newCodeConfirm}
              onChange={e => setNewCodeConfirm(e.target.value)}
              placeholder="인증키 확인"
              className={`w-full bg-pixel-dark text-gold font-korean text-sm pr-10
                         border-4 px-3 py-2.5 focus:outline-none focus:border-gold
                         ${newCodeConfirm && !codeMatch ? 'border-rejected' : 'border-pixel-dark'}`}
            />
            <button type="button" onClick={() => setShowCodeConfirm(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
              {showCodeConfirm ? '🙈' : '👁️'}
            </button>
          </div>

          {newCode && newCodeConfirm && (
            <p className={`font-korean text-xs mb-2 ${codeMatch ? 'text-approved' : 'text-rejected'}`}>
              {codeMatch ? '✓ 인증키가 일치해요' : '✗ 인증키가 일치하지 않아요'}
            </p>
          )}

          <button type="button" onClick={handleChangeCode} disabled={!codeMatch}
            className="w-full py-2 bg-purple border-4 border-pixel-dark font-korean text-sm font-bold
                       text-white hover:bg-purple/90 active:translate-y-0.5 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed">
            인증키 변경
          </button>
        </PixelCard>

        {/* ── 2. 가족 비밀 코드 설정 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="🔐" title="가족 비밀 코드 설정" />
          <p className="font-korean text-xs text-stone mb-3">
            다른 기기에서 가족을 찾을 때 사용하는 코드예요. 가족 구성원에게 알려주세요. (4자 이상)
          </p>

          {/* 현재 설정된 코드 표시 */}
          {currentSettings?.joinCode && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gold/10 border-2 border-gold/40">
              <span className="font-korean text-xs text-stone flex-1">현재 코드</span>
              <span className="font-korean text-sm font-bold text-pixel-dark flex-1 text-right">
                {showCurrentCode ? currentSettings.joinCode : '●'.repeat(currentSettings.joinCode.length)}
              </span>
              <button type="button" onClick={() => setShowCurrentCode(p => !p)}
                className="text-gold text-base flex-shrink-0">
                {showCurrentCode ? '🙈' : '👁️'}
              </button>
            </div>
          )}

          {!currentSettings?.joinCode && (
            <p className="font-korean text-xs text-hold mb-3 font-bold">
              ⚠️ 비밀 코드가 설정되지 않았어요. 다른 기기에서 가족을 찾을 수 없어요.
            </p>
          )}

          {/* 새 코드 입력 */}
          <div className="relative mb-2">
            <input
              type={showJoinCode ? 'text' : 'password'}
              value={newJoinCode}
              onChange={e => setNewJoinCode(e.target.value)}
              placeholder="새 비밀 코드 (4자 이상)"
              className={`w-full bg-pixel-dark text-gold font-korean text-sm pr-10
                         border-4 px-3 py-2.5 focus:outline-none focus:border-gold
                         ${newJoinCode && !joinCodeValid ? 'border-rejected' : 'border-pixel-dark'}`}
            />
            <button type="button" onClick={() => setShowJoinCode(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
              {showJoinCode ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="button" onClick={handleSetJoinCode} disabled={!joinCodeValid}
            className="w-full py-2 bg-purple border-4 border-pixel-dark font-korean text-sm font-bold
                       text-white hover:bg-purple/90 active:translate-y-0.5 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed">
            비밀 코드 설정
          </button>
        </PixelCard>

        {/* ── 3. 구성원 관리 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="👥" title={`구성원 관리 (${members.length}/4명)`} />

          {members.length === 0 ? (
            <p className="font-korean text-sm text-stone text-center py-4">
              {familyId ? '구성원을 불러오는 중...' : '가족 ID가 없어요'}
            </p>
          ) : (
            <div className="space-y-3">
              {/* 부모(DAD/MOM) 먼저, 그 다음 아이 */}
              {[...members].sort((a, b) => {
                const order = { DAD: 0, MOM: 1, CHILD: 2, OBSERVER: 3 }
                return (order[a.role] ?? 9) - (order[b.role] ?? 9)
              }).map(member => {
                const isParentMember = member.role === 'DAD' || member.role === 'MOM'
                // 부모는 표시용으로만 Lv.100 / EXP 99,999 표기
                const displayLevel = isParentMember ? 100 : member.level
                const displayExp   = isParentMember ? 99999 : member.exp
                return (
                <div key={member.id}
                  className={`border-b border-stone/20 pb-3 last:border-0 last:pb-0
                              ${!member.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <CharacterSprite
                      characterId={member.character.characterId}
                      role={member.role}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      {editingId === member.id ? (
                        <div className="flex gap-1 items-center">
                          <input
                            value={editNickname}
                            onChange={e => setEditNickname(e.target.value)}
                            maxLength={10}
                            autoFocus
                            className="flex-1 bg-pixel-dark text-gold font-korean text-sm
                                       border-2 border-gold px-2 py-1 focus:outline-none min-w-0"
                          />
                          <button onClick={() => handleNicknameSave(member)}
                            className="font-korean text-sm text-approved underline flex-shrink-0">저장</button>
                          <button onClick={() => setEditingId(null)}
                            className="font-korean text-sm text-stone underline flex-shrink-0">취소</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="font-korean text-sm font-bold text-pixel-dark">
                            {member.name}
                            {member.realName && member.realName !== member.name && (
                              <span className="text-stone font-normal ml-1 text-xs">({member.realName})</span>
                            )}
                          </p>
                          <button
                            onClick={() => { setEditingId(member.id); setEditNickname(member.name) }}
                            className="font-korean text-xs text-sky underline ml-1">
                            수정
                          </button>
                        </div>
                      )}
                      <p className="font-korean text-xs text-stone">
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
                      <button type="button" onClick={() => handleExpel(member)}
                        className="px-3 py-1.5 bg-rejected border-2 border-red-800 font-korean text-xs font-bold
                                   text-white hover:bg-red-600 active:translate-y-0.5 transition-all">
                        내보내기
                      </button>
                    )}
                    {!member.isActive && (
                      <button type="button" onClick={() => handleRestore(member)}
                        className="px-3 py-1.5 bg-approved border-2 border-green-800 font-korean text-xs font-bold
                                   text-white hover:bg-green-600 active:translate-y-0.5 transition-all">
                        복구
                      </button>
                    )}
                    {currentMember?.id === member.id && (
                      <span className="font-korean text-xs text-gold self-center">← 현재 접속 중</span>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </PixelCard>

        {/* ── 4. 게스트 접속 신청 관리 ── */}
        <PixelCard padding="sm">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon="👀" title="게스트 접속 신청" />
            <button type="button" onClick={loadObservers}
              className="font-korean text-xs text-stone underline">
              새로고침
            </button>
          </div>
          {observerLoading ? (
            <p className="font-korean text-xs text-stone text-center py-3">불러오는 중...</p>
          ) : observers.length === 0 ? (
            <p className="font-korean text-xs text-stone text-center py-3">
              대기 중인 게스트 신청이 없어요
            </p>
          ) : (
            <div className="space-y-3">
              {observers.map(s => (
                <div key={s.id} className="border-b border-stone/20 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="font-korean text-sm font-bold text-pixel-dark">
                        {s.name}
                        <span className="font-normal text-stone ml-1 text-xs">
                          {OBSERVER_TYPE_LABELS[s.type]}
                        </span>
                      </p>
                      <p className="font-korean text-xs text-stone">
                        전화 끝 4자리: {s.phoneLast4}
                      </p>
                    </div>
                    <span className="font-korean text-xs text-hold font-bold">대기중</span>
                  </div>
                  <div className="flex gap-2">
                    <PixelButton variant="success" size="sm"
                      onClick={() => handleApproveObserver(s)}>
                      ✅ 승인 (24h)
                    </PixelButton>
                    <PixelButton variant="danger" size="sm"
                      onClick={() => handleRejectObserver(s)}>
                      ❌ 거절
                    </PixelButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PixelCard>

        {/* ── 5. 두근두근 질문함 ── */}
        <PixelCard padding="sm">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon="💌" title={`두근두근 질문함 (총 ${ALL_QUESTIONS.length}개)`} />
          </div>
          <p className="font-korean text-xs text-stone mb-3">
            아이들이 매일 1개씩 질문에 답해요. 답변과 감정을 확인할 수 있어요.
          </p>
          <div className="space-y-2">
            {ALL_QUESTIONS.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-stone/20 last:border-0">
                <span className="font-pixel text-[8px] text-purple mt-0.5 flex-shrink-0">Q{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-korean text-xs text-pixel-dark">{item.q}</p>
                  <p className="font-korean text-[10px] text-approved mt-0.5">보상: {item.reward}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => navigate('/settings/question-answers')}
              className="flex-[2] py-2 font-korean text-sm font-bold text-pixel-dark
                         bg-gold border-4 border-yellow-600 hover:bg-yellow-400 active:translate-y-0.5 transition-all">
              답변 목록 보기 →
            </button>
            <button type="button" onClick={() => navigate('/settings/questions')}
              className="flex-1 py-2 font-korean text-sm font-bold text-pixel-dark
                         bg-cream border-4 border-pixel-dark hover:border-gold active:translate-y-0.5 transition-all">
              전체 질문 ({ALL_QUESTIONS.length}개)
            </button>
          </div>
        </PixelCard>

        {/* ── 5-b. 기념일·생일 관리 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="📅" title="기념일·생일 관리" />
          <p className="font-korean text-xs text-stone mb-3">
            생일·기념일·특별일을 등록하면 달력에 이모지로 표시돼요.
          </p>
          <button type="button" onClick={() => navigate('/settings/special-days')}
            className="w-full py-2 font-korean text-sm font-bold text-pixel-dark
                       bg-gold border-4 border-yellow-600 hover:bg-yellow-400 active:translate-y-0.5 transition-all">
            기념일·생일 관리 →
          </button>
        </PixelCard>

        {/* ── 6. 경쟁 시스템 설정 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="🥇" title="경쟁 시스템 설정" />
          <p className="font-korean text-xs text-stone mb-3">
            아이들 간의 주간·월간 왕관 경쟁을 ON/OFF 설정해요.
          </p>
          <div className="space-y-3">
            {[
              { label: '주간 경쟁 (은 왕관 🥈)', desc: '매주 미션 완료 1위 아이에게 수여', on: weeklyCompOn,  toggle: toggleWeekly },
              { label: '월간 경쟁 (금 왕관 🥇)', desc: '매달 누적 점수 1위 아이에게 수여', on: monthlyCompOn, toggle: toggleMonthly },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between gap-3
                                               py-2 border-b border-stone/20 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-korean text-sm font-bold text-pixel-dark">{item.label}</p>
                  <p className="font-korean text-xs text-stone">{item.desc}</p>
                </div>
                <button type="button" onClick={item.toggle}
                  className={`font-korean text-sm font-bold px-3 py-1.5 border-4 flex-shrink-0 transition-all active:translate-y-0.5
                              ${item.on ? 'bg-approved text-white border-green-800' : 'bg-cream text-stone border-stone'}`}>
                  {item.on ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </PixelCard>

        {/* ── 수동 보상 발송 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="🎁" title="보상 수동 발송" />
          <p className="font-korean text-xs text-stone mb-3">
            퀘스트 완료와 무관하게 직접 보상을 발송해요. 보상 탭에 이력이 누적돼요.
          </p>
          <div className="space-y-2">
            {/* 아이 선택 */}
            <select
              value={rewardMemberId}
              onChange={e => setRewardMemberId(e.target.value)}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold">
              <option value="">아이 선택</option>
              {members.filter(m => m.role === 'CHILD').map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.realName})</option>
              ))}
            </select>
            {/* 보상 종류 */}
            <select
              value={rewardType}
              onChange={e => setRewardType(e.target.value)}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold">
              {[
                { v:'MONEY', l:'💰 용돈' },
                { v:'GAME_TIME', l:'🎮 게임시간' },
                { v:'PHONE_TIME', l:'📱 핸드폰시간' },
                { v:'GIFT', l:'🎁 선물' },
                { v:'DINING', l:'🍕 외식' },
                { v:'CUSTOM', l:'⭐ 기타' },
              ].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            {/* 금액/시간 */}
            <input
              value={rewardAmount}
              onChange={e => setRewardAmount(e.target.value.replace(/\D/g,''))}
              placeholder={rewardType === 'MONEY' ? '금액 (원)' : rewardType.includes('TIME') ? '시간 (분)' : '수량 (개)'}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold"
            />
            {/* 선물명/메모 */}
            {['GIFT','DINING','CUSTOM'].includes(rewardType) && (
              <input
                value={rewardLabel}
                onChange={e => setRewardLabel(e.target.value)}
                placeholder="선물 내용 (예: 나이키 운동화)"
                maxLength={30}
                className="w-full bg-pixel-dark text-gold font-korean text-sm
                           border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold"
              />
            )}
            <button type="button" onClick={handleSendReward}
              disabled={rewardSending || !rewardMemberId || !rewardAmount}
              className="w-full py-2 bg-gold border-4 border-yellow-600 font-korean text-sm font-bold
                         text-pixel-dark hover:bg-yellow-400 active:translate-y-0.5 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed">
              {rewardSending ? '발송 중...' : '🎁 보상 발송'}
            </button>
          </div>
        </PixelCard>

        {/* ── 공지사항 관리 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="📢" title="공지사항 관리" />
          <p className="font-korean text-xs text-stone mb-3">
            홈 화면 하단에 최근 5개 공지사항이 아코디언으로 표시돼요.
          </p>
          {/* 작성 폼 */}
          <div className="space-y-2 mb-4">
            <input
              value={noticeTitle}
              onChange={e => setNoticeTitle(e.target.value)}
              placeholder="제목"
              maxLength={30}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold"
            />
            <textarea
              value={noticeContent}
              onChange={e => setNoticeContent(e.target.value)}
              placeholder="내용 (최대 5줄 표시)"
              rows={3}
              maxLength={300}
              className="w-full bg-pixel-dark text-gold font-korean text-sm resize-none
                         border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold"
            />
            <button type="button" onClick={handleAddNotice}
              disabled={noticeSaving || !noticeTitle.trim() || !noticeContent.trim()}
              className="w-full py-2 bg-purple border-4 border-pixel-dark font-korean text-sm font-bold
                         text-white hover:bg-purple/90 active:translate-y-0.5 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed">
              {noticeSaving ? '등록 중...' : '공지 등록'}
            </button>
          </div>
          {/* 기존 공지 목록 */}
          {notices.length > 0 && (
            <div className="space-y-2">
              <p className="font-korean text-xs font-bold text-stone">등록된 공지 ({notices.length}개)</p>
              {notices.map(n => (
                <div key={n.id} className="flex items-center gap-2 py-1.5 border-b border-stone/20 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-korean text-xs font-bold text-pixel-dark truncate">{n.title}</p>
                    <p className="font-korean text-[10px] text-stone">
                      {n.createdAt.toLocaleDateString()} · {n.authorName}
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => confirm(`"${n.title}" 공지를 삭제할까요?`, () => handleDeleteNotice(n.id))}
                    className="px-2 py-1 font-korean text-xs font-bold text-white bg-rejected
                               border-2 border-red-800 hover:bg-red-600 active:translate-y-0.5 flex-shrink-0">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </PixelCard>

        {/* ── 7. 보상 종류 관리 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="💰" title="보상 종류 관리" />
          <p className="font-korean text-xs text-stone mb-3">
            커스텀 보상을 최대 10종까지 등록할 수 있어요.
          </p>
          <div className="space-y-2">
            {[
              { emoji: '💰', label: '용돈',       unit: '100원 단위' },
              { emoji: '🎮', label: '게임시간',   unit: '10분 단위' },
              { emoji: '📱', label: '핸드폰시간', unit: '10분 단위' },
              { emoji: '🎁', label: '선물',       unit: '텍스트 입력' },
              { emoji: '🍕', label: '외식',       unit: '텍스트 입력' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-stone/20 last:border-0">
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-korean text-sm font-bold text-pixel-dark">{item.label}</p>
                  <p className="font-korean text-[10px] text-stone">{item.unit}</p>
                </div>
                <span className="font-korean text-xs text-approved font-bold flex-shrink-0">사용중</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => navigate('/settings/reward-types')}
            className="w-full mt-3 py-2 font-korean text-sm font-bold text-pixel-dark
                       bg-cream border-4 border-pixel-dark hover:border-gold active:translate-y-0.5 transition-all">
            전체 보상 관리 →
          </button>
        </PixelCard>

        {/* ── 앱 정보 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="ℹ️" title="앱 정보" />
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-korean text-xs text-stone">버전</span>
              <span className="font-korean text-xs font-bold text-gold">v{APP_VERSION}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-korean text-xs text-stone">서비스명</span>
              <span className="font-korean text-xs text-pixel-dark">패밀리 퀘스트</span>
            </div>
            <div className="flex justify-between">
              <span className="font-korean text-xs text-stone">최대 구성원</span>
              <span className="font-korean text-xs text-pixel-dark">4명</span>
            </div>
          </div>
        </PixelCard>

        {/* ── 롤백 (스냅샷 저장/복원) ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="💾" title="상태 저장 & 롤백" />
          <p className="font-korean text-xs text-stone mb-3">
            현재 상태를 저장하고, 이전 시점으로 복원할 수 있어요. (최대 5개 보관)
          </p>
          <button type="button" onClick={saveSnapshot}
            className="w-full mb-3 py-2 font-korean text-sm font-bold text-pixel-dark
                       bg-gold border-4 border-yellow-600 hover:bg-yellow-400 active:translate-y-0.5 transition-all">
            💾 지금 상태 저장
          </button>
          {snapshots.length > 0 ? (
            <div className="space-y-2">
              <p className="font-korean text-xs font-bold text-purple">저장된 스냅샷</p>
              {snapshots.map((snap, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-stone/20 last:border-0">
                  <span className="font-korean text-xs text-pixel-dark flex-1">{snap.label}</span>
                  <button type="button"
                    onClick={() => confirm(`"${snap.label}" 기준으로 복원할까요?\n앱이 재시작됩니다.`, () => restoreSnapshot(snap))}
                    className="px-2 py-1 font-korean text-xs font-bold text-white bg-sky border-2 border-blue-700
                               hover:bg-blue-500 active:translate-y-0.5 transition-all flex-shrink-0">
                    복원
                  </button>
                  <button type="button"
                    onClick={() => confirm(`"${snap.label}" 스냅샷을 삭제할까요?`, () => deleteSnapshot(i))}
                    className="px-2 py-1 font-korean text-xs font-bold text-white bg-rejected border-2 border-red-800
                               hover:bg-red-600 active:translate-y-0.5 transition-all flex-shrink-0">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-korean text-xs text-stone text-center">저장된 스냅샷이 없어요</p>
          )}
        </PixelCard>

        {/* ── 앱 초기화 ── */}
        <PixelCard padding="sm">
          <SectionHeader icon="🔄" title="앱 초기화" />
          <p className="font-korean text-xs text-stone mb-3">
            로그인 정보와 로컬 캐시를 전부 삭제해요.<br/>
            새로 가입하거나 다른 계정으로 시작할 때 사용해요.
          </p>

          {!showResetPin ? (
            <button type="button"
              onClick={() => { setShowResetPin(true); setResetPinInput(''); setResetPinError('') }}
              className="w-full py-3 bg-rejected border-4 border-red-800 font-korean text-sm font-bold
                         text-white hover:bg-red-600 active:translate-y-0.5 transition-all">
              앱 데이터 초기화
            </button>
          ) : (
            <div className="space-y-2">
              <p className="font-korean text-xs font-bold text-rejected">
                ⚠️ 되돌릴 수 없어요. PIN을 입력하고 확인해주세요.
              </p>
              <input
                type="password"
                value={resetPinInput}
                onChange={e => setResetPinInput(e.target.value)}
                placeholder={currentMember?.pinHash ? '현재 PIN 입력' : 'PIN 확인 불필요'}
                maxLength={8}
                className="w-full bg-pixel-dark text-gold font-korean text-sm
                           border-4 border-rejected px-3 py-2 focus:outline-none"
              />
              {resetPinError && (
                <p className="font-korean text-xs text-rejected font-bold">{resetPinError}</p>
              )}
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setShowResetPin(false)}
                  className="flex-1 py-2.5 border-4 border-pixel-dark font-korean text-sm font-bold
                             text-pixel-dark bg-cream hover:bg-yellow-50 active:translate-y-0.5 transition-all">
                  취소
                </button>
                <button type="button"
                  onClick={handleAppReset}
                  disabled={resetLoading || (!!currentMember?.pinHash && !resetPinInput)}
                  className="flex-1 py-2.5 bg-rejected border-4 border-red-800 font-korean text-sm font-bold
                             text-white hover:bg-red-700 active:translate-y-0.5 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed">
                  {resetLoading ? '초기화 중...' : '완전 초기화'}
                </button>
              </div>
            </div>
          )}
        </PixelCard>

      </div>
    </div>
  )
}
