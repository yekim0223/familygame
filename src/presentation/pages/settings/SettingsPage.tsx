// Design Ref: §5.3 SCR-20 SettingsPage — v4.0 통합 설정 (MasterSettings 완전 흡수)
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers, updateMember } from '@/infrastructure/firebase/collections/members'
import { fsGet, fsSet, fsQuery, fsDelete } from '@/infrastructure/firebase/firestore'
import { hashPin, signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'
import {
  subscribeTournamentSettings, saveTournamentSettings, subscribeTournamentScores,
  type TournamentSettings, type TournamentScore,
} from '@/infrastructure/firebase/collections/tournament'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { formatNameWithAge } from '@/domain/services/KoreanAge'
import {
  sendPraiseSticker, STICKER_INFO, type StickerType,
} from '@/infrastructure/firebase/collections/praiseStickers'
import { sendCheerMessage } from '@/infrastructure/firebase/collections/cheerMessages'
import type { Member } from '@/domain/entities/Member'
import { APP_VERSION } from '@/config/version'

const INPUT_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'
const TEXTAREA_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub resize-none px-3 py-2.5 focus:outline-none focus:border-gold'

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <p className="t-sub font-bold text-gold t-pixel-shadow">{title}</p>
    </div>
  )
}

type Snapshot = { ts: string; label: string; data: any }
const LS_SNAPSHOTS = 'fq_snapshots'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { currentMember, familyId, clearSession } = useAuthStore()

  // ── 파생값 (hook 아님) ───────────────────────────────────────────
  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  const isDad = currentMember?.role === 'DAD'

  // ── 구성원 ───────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([])

  // ── 토스트 & 확인 팝업 ─────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ message: string; onYes: () => void } | null>(null)

  // ── 닉네임 + loginId 수정 ────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editLoginId, setEditLoginId] = useState('')

  // ── 칭찬 스티커 ─────────────────────────────────────────────────
  const [stickerTarget, setStickerTarget] = useState<string>('')
  const [stickerType, setStickerType] = useState<StickerType>('well_done')
  const [stickerMsg, setStickerMsg] = useState('')
  const [stickerSending, setStickerSending] = useState(false)
  const [stickerToast, setStickerToast] = useState<string | null>(null)

  // ── 원터치 격려 ─────────────────────────────────────────────────
  const [cheerTarget, setCheerTarget] = useState<string>('')
  const [cheerText, setCheerText] = useState('')
  const [cheerSending, setCheerSending] = useState(false)
  const [cheerToast, setCheerToast] = useState<string | null>(null)

  // ── 주간 대회 ───────────────────────────────────────────────────
  const defaultTS = (): TournamentSettings => ({
    active: false, title: '천하제일 가족 게임 대회', roundNumber: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    difficulty: 3,
  })
  const [tournament, setTournament] = useState<TournamentSettings>(defaultTS())
  const [tournamentScs, setTournamentScs] = useState<TournamentScore[]>([])
  const [tSaving, setTSaving] = useState(false)

  // ── 롤백 스냅샷 ─────────────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_SNAPSHOTS) ?? '[]') } catch { return [] }
  })

  // ── 앱 초기화 ───────────────────────────────────────────────────
  const [currentSettings, setCurrentSettings] = useState<{ familyCodeHash?: string; joinCode?: string } | null>(null)
  const [showResetPin, setShowResetPin] = useState(false)
  const [resetPinInput, setResetPinInput] = useState('')
  const [resetPinError, setResetPinError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // ── showToast helper ────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 롤백 useCallback (hook — early return 이전에 위치) ───────────
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
    const next = [snap, ...snapshots].slice(0, 5)
    setSnapshots(next)
    localStorage.setItem(LS_SNAPSHOTS, JSON.stringify(next))
    showToast('현재 상태가 저장됐어요', 'success')
  }, [snapshots]) // eslint-disable-line react-hooks/exhaustive-deps

  const restoreSnapshot = useCallback((snap: Snapshot) => {
    if (snap.data.members) localStorage.setItem('fq_member_cache', snap.data.members)
    if (snap.data.familyId) localStorage.setItem('familyId', snap.data.familyId)
    if (snap.data.lastLogin) localStorage.setItem('fq_last_login', snap.data.lastLogin)
    if (snap.data.favOrder) localStorage.setItem('fq_fav_order', snap.data.favOrder)
    showToast(`${snap.label} 기준으로 복원됐어요. 앱을 다시 시작해주세요`, 'success')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteSnapshot = useCallback((index: number) => {
    const next = snapshots.filter((_, i) => i !== index)
    setSnapshots(next)
    localStorage.setItem(LS_SNAPSHOTS, JSON.stringify(next))
    showToast('스냅샷이 삭제됐어요', 'success')
  }, [snapshots]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── useEffect (hook — early return 이전) ────────────────────────
  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  useEffect(() => {
    if (!familyId || !isDad) return
    const u1 = subscribeTournamentSettings(familyId, s => { if (s) setTournament(s) })
    const u2 = subscribeTournamentScores(familyId, setTournamentScs)
    fsGet<any>(`families/${familyId}/config/settings`).then(({ data }) => setCurrentSettings(data))
    return () => { u1(); u2() }
  }, [familyId, isDad])

  // ── 비부모 얼리 리턴 ────────────────────────────────────────────
  if (!isParent) {
    return (
      <div className="p-4">
        <p className="font-korean text-sm text-panel-sub text-center">부모만 볼 수 있어요</p>
      </div>
    )
  }

  // ── confirm helper ──────────────────────────────────────────────
  const confirm = (message: string, onYes: () => void) => setConfirmModal({ message, onYes })

  const children = members.filter(m => m.role === 'CHILD' && m.isActive)

  // ── 로그아웃 ────────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOut()
    clearSession()
    clearAllLocalData()
    navigate('/login')
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

  // ── 칭찬 스티커 ─────────────────────────────────────────────────
  const handleSendSticker = async () => {
    if (!familyId || !stickerTarget || !currentMember) return
    setStickerSending(true)
    const { error } = await sendPraiseSticker(
      familyId, currentMember.id, currentMember.name,
      stickerTarget, stickerType, stickerMsg.trim()
    )
    setStickerSending(false)
    if (error) { setStickerToast('발송 실패: ' + error) }
    else { setStickerMsg(''); setStickerToast('칭찬 스티커를 붙여줬어요! 🌟') }
    setTimeout(() => setStickerToast(null), 3000)
  }

  // ── 원터치 격려 ─────────────────────────────────────────────────
  const handleSendCheer = async () => {
    if (!familyId || !cheerTarget || !cheerText.trim() || !currentMember) return
    setCheerSending(true)
    const { error } = await sendCheerMessage(
      familyId, currentMember.id, currentMember.name, currentMember.role,
      currentMember.character.characterId, cheerTarget, cheerText.trim()
    )
    setCheerSending(false)
    if (error) { setCheerToast('발송 실패: ' + error) }
    else { setCheerText(''); setCheerToast('응원 팝업을 전송했어요! 💖') }
    setTimeout(() => setCheerToast(null), 3000)
  }

  // ── 주간 대회 핸들러 ────────────────────────────────────────────
  const handleTournamentToggle = async () => {
    if (!familyId) return
    const next = { ...tournament, active: !tournament.active }
    setTournament(next)
    const { error } = await saveTournamentSettings(familyId, next)
    if (error) { showToast('토글 실패', 'error'); setTournament(tournament) }
    else showToast(next.active ? '🏆 대회가 시작됐어요!' : '대회가 종료됐어요', 'success')
  }

  const handleTournamentSave = async () => {
    if (!familyId) return
    setTSaving(true)
    const { error } = await saveTournamentSettings(familyId, tournament)
    setTSaving(false)
    if (error) showToast('저장 실패: ' + error, 'error')
    else showToast('대회 설정이 저장됐어요', 'success')
  }

  const handleNewRound = async () => {
    if (!familyId) return
    const next: TournamentSettings = {
      ...tournament, active: true,
      roundNumber: tournament.roundNumber + 1,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    }
    setTournament(next)
    await saveTournamentSettings(familyId, next)
    showToast(`제${next.roundNumber}회 대회가 시작됐어요!`, 'success')
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

  // ── 대회 랭킹 헬퍼 ──────────────────────────────────────────────
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'] as const
  const roundScores = tournamentScs
    .filter(s => s.roundNumber === tournament.roundNumber)
    .slice(0, 5)

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="p-3 pb-4 space-y-3">

      {/* ── 토스트 팝업 ──────────────────────────────────────────── */}
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

      {/* ── 확인 팝업 ─────────────────────────────────────────────── */}
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

      <h1 className="t-heading text-gold t-pixel-shadow">⚙️ 설정</h1>

      {/* ════ 1단: 가족 구성원 프로필 ════════════════════════════════════ */}
      <div className="card-pixel p-3">
        <SectionLabel icon="👥" title={`가족 구성원 (${members.length}명)`} />
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id}
              className={`card-pixel p-3 ${!member.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <CharacterSprite
                  characterId={member.character.characterId}
                  role={member.role}
                  size="sm"
                  weapon={null}
                  petId={null}
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
                        placeholder="로그인 ID (영문+숫자, 새 기기용)"
                        className={INPUT_CLS}
                      />
                      <div className="flex gap-1.5">
                        <PixelButton size="sm" variant="gold" onClick={() => handleNicknameSave(member)}>저장</PixelButton>
                        <PixelButton size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</PixelButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="t-sub font-bold text-cream">
                          {formatNameWithAge(member.name, member.birthDate)}
                        </p>
                        {(member as any).loginId && (
                          <span className="font-korean text-xs text-sky border border-sky px-1">
                            ID: {(member as any).loginId}
                          </span>
                        )}
                      </div>
                      <p className="t-micro text-panel-sub">
                        {member.role === 'DAD' ? '아빠' : member.role === 'MOM' ? '엄마' : '자녀'}
                        {member.role === 'CHILD' && ` · Lv.${member.level}`}
                      </p>
                    </>
                  )}
                </div>
                {/* 부모는 자신 외 모든 구성원 닉네임/ID 수정 가능 */}
                {isParent && editingId !== member.id && member.id !== currentMember?.id && (
                  <PixelButton size="sm" variant="ghost"
                    onClick={() => {
                      setEditingId(member.id)
                      setEditNickname(member.name)
                      setEditLoginId((member as any).loginId ?? '')
                    }}>
                    수정
                  </PixelButton>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="t-micro text-panel-sub text-center py-2">구성원을 불러오는 중...</p>
          )}
        </div>
      </div>

      {/* ════ 2단: 칭찬 스티커 & 원터치 응원 ════════════════════════════ */}
      {children.length > 0 && (
        <>
          {/* 📌 칭찬 스티커 */}
          <div className="card-pixel p-3">
            <SectionLabel icon="📌" title="칭찬 스티커 보내기" />
            <p className="font-korean text-xs font-bold text-panel-sub mb-1">누구에게?</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {children.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setStickerTarget(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-2 font-korean text-sm font-bold transition-colors
                    ${stickerTarget === c.id
                      ? 'border-gold bg-gold/20 text-gold'
                      : 'border-panel-border bg-panel-darkest text-cream hover:border-gold/50'}`}
                >
                  <CharacterSprite
                    characterId={c.character.characterId}
                    role={c.role}
                    size="sm"
                    weapon={null}
                    petId={null}
                    className="pointer-events-none"
                  />
                  {c.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {(Object.entries(STICKER_INFO) as [StickerType, typeof STICKER_INFO[StickerType]][]).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStickerType(key)}
                  className={`flex flex-col items-center gap-0.5 py-2 border-2 transition-colors
                    ${stickerType === key ? `${info.border} bg-gold/10` : 'border-panel-border bg-panel-darkest hover:border-gold/40'}`}
                >
                  <span className="text-2xl">{info.emoji}</span>
                  <span className="font-korean text-xs text-cream leading-tight text-center">{info.label}</span>
                </button>
              ))}
            </div>
            <input
              value={stickerMsg}
              onChange={e => setStickerMsg(e.target.value)}
              placeholder="짧은 칭찬 메시지... (선택)"
              maxLength={30}
              className={`${INPUT_CLS} mb-3`}
            />
            <PixelButton variant="gold" size="lg" fullWidth
              disabled={!stickerTarget || stickerSending}
              onClick={handleSendSticker}
            >
              {stickerSending ? '붙이는 중...' : '📌 화이트보드에 붙여주기'}
            </PixelButton>
            {stickerToast && (
              <p className="font-korean text-xs text-gold text-center mt-2">{stickerToast}</p>
            )}
          </div>

          {/* 💖 원터치 응원 */}
          <div className="card-pixel p-3">
            <SectionLabel icon="💖" title="원터치 응원 보내기" />
            <p className="font-korean text-xs font-bold text-panel-sub mb-1">누구에게?</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {children.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCheerTarget(c.id)}
                  className={`px-3 py-1.5 border-2 font-korean text-sm font-bold transition-colors
                    ${cheerTarget === c.id
                      ? 'border-pink bg-pink/20 text-pink'
                      : 'border-panel-border bg-panel-darkest text-cream hover:border-pink/50'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 mb-3">
              {[
                '포기하지 마! 엄마가 항상 응원해! 🔥',
                '할 수 있어! 넌 최고야 💖',
                '오늘도 파이팅! 엄마가 사랑해 🌟',
                '힘내! 힘들면 쉬어도 돼, 하지만 포기는 금지야 🌈',
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCheerText(preset)}
                  className={`text-left px-3 py-2 border-2 font-korean text-sm transition-colors
                    ${cheerText === preset
                      ? 'border-pink bg-pink/20 text-cream'
                      : 'border-panel-border bg-panel-darkest text-panel-sub hover:border-pink/40'}`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              value={cheerText}
              onChange={e => setCheerText(e.target.value)}
              placeholder="직접 입력..."
              maxLength={60}
              className={`${INPUT_CLS} mb-3`}
            />
            <PixelButton variant="purple" size="lg" fullWidth
              disabled={!cheerTarget || !cheerText.trim() || cheerSending}
              onClick={handleSendCheer}
            >
              {cheerSending ? '전송 중...' : '💌 응원 팝업 발송'}
            </PixelButton>
            {cheerToast && (
              <p className="font-korean text-xs text-gold text-center mt-2">{cheerToast}</p>
            )}
          </div>
        </>
      )}

      {/* ════ 3단: 완공 자산 4종 다이렉트 라우팅 ════════════════════════ */}
      <div className="card-pixel p-3">
        <SectionLabel icon="🔗" title="메뉴" />
        <div className="space-y-2">
          {[
            { icon: '🎁', label: '아이들 보상주기', to: '/settings/rewards-send' },
            { icon: '🙏', label: '조르기 요청 관리', to: '/begging/manage' },
            { icon: '💌', label: '두근두근 질문함', to: '/settings/question-answers' },
            { icon: '📅', label: '기념일·생일 관리', to: '/settings/special-days' },
          ].map(item => (
            <PixelButton key={item.to} variant="gold" size="lg" fullWidth
              onClick={() => navigate(item.to)}>
              {item.icon} {item.label}
            </PixelButton>
          ))}
        </div>
      </div>

      {/* ════ 4단: 아빠 전용 마스터 격리 제어판 ════════════════════════ */}
      {isDad && (
        <div className="card-pixel p-3 border-gold/40">
          <SectionLabel icon="⛏" title="아빠 작업방" />

          {/* 📢 공지사항 관리 */}
          <div className="mb-4">
            <PixelButton variant="gold" size="md" fullWidth onClick={() => navigate('/settings/notices')}>
              📢 공지사항 관리 →
            </PixelButton>
          </div>

          {/* 🏆 주간 대회 제어판 */}
          <div className="mb-4 pb-4 border-b border-panel-border">
            <div className="flex items-center justify-between mb-3">
              <p className="t-sub font-bold text-gold t-pixel-shadow">🏆 주간 대회 제어판</p>
              <PixelButton
                size="sm"
                variant={tournament.active ? 'danger' : 'success'}
                onClick={handleTournamentToggle}
              >
                {tournament.active ? '⏹ 종료' : '▶ 시작'}
              </PixelButton>
            </div>

            {/* 현재 대회 상태 */}
            <div className={`px-3 py-2 mb-3 border-2 ${tournament.active ? 'border-gold bg-gold/10' : 'border-panel-border bg-panel-darkest'}`}>
              <p className="font-pixel text-xs text-gold">
                {tournament.active ? '🔴 LIVE' : '⚪ 대기'} — 제{tournament.roundNumber}회
              </p>
              <p className="font-korean text-sm font-bold text-cream mt-0.5">{tournament.title}</p>
              <p className="font-korean text-xs text-panel-sub">{tournament.startDate} ~ {tournament.endDate}</p>
            </div>

            {/* 대회 설정 폼 */}
            <div className="space-y-2 mb-3">
              <input
                value={tournament.title}
                onChange={e => setTournament(p => ({ ...p, title: e.target.value }))}
                maxLength={30}
                placeholder="대회 이름"
                className={INPUT_CLS}
              />
              <div className="flex gap-2">
                <input type="date"
                  value={tournament.startDate}
                  onChange={e => setTournament(p => ({ ...p, startDate: e.target.value }))}
                  className={`${INPUT_CLS} flex-1`}
                />
                <input type="date"
                  value={tournament.endDate}
                  onChange={e => setTournament(p => ({ ...p, endDate: e.target.value }))}
                  className={`${INPUT_CLS} flex-1`}
                />
              </div>
              {/* 난이도 슬라이더 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="t-micro text-panel-sub">게임 기본 난이도</p>
                  <p className="font-pixel text-xs text-gold">
                    {'★'.repeat(tournament.difficulty)}{'☆'.repeat(5 - tournament.difficulty)}
                    {' '}Lv.{tournament.difficulty}
                  </p>
                </div>
                <input
                  type="range" min={1} max={5} step={1}
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

            <div className="flex gap-2 mb-3">
              <PixelButton variant="gold" size="md" className="flex-1" disabled={tSaving} onClick={handleTournamentSave}>
                {tSaving ? '저장 중...' : '💾 저장'}
              </PixelButton>
              <PixelButton variant="sky" size="md" className="flex-1"
                onClick={() => confirm('새 회차를 시작할까요?\n기존 랭킹은 유지돼요.', handleNewRound)}>
                ⏭ 다음 회차
              </PixelButton>
            </div>

            {/* 현 회차 Top5 */}
            {roundScores.length > 0 && (
              <div>
                <p className="t-micro text-panel-sub font-bold mb-2">📊 제{tournament.roundNumber}회 Top5</p>
                <div className="space-y-1">
                  {roundScores.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 px-2 py-1 card-pixel">
                      <span className="text-sm">{medals[i]}</span>
                      <span className="font-korean text-xs text-cream flex-1 truncate">
                        {s.memberName}
                        <span className="text-panel-sub ml-1">
                          ({s.gameId === 'galaga' ? '갤러그' : s.gameId === 'ponpoko' ? '너구리' : '지뢰찾기'})
                        </span>
                      </span>
                      <span className="font-pixel text-xs text-gold">{s.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ⚡ 캐시 강제 초기화 */}
          <div className="mb-4 pb-4 border-b border-panel-border">
            <p className="t-sub font-bold text-gold mb-1">⚡ 엔진 완전 새로고침</p>
            <p className="t-micro text-panel-sub mb-3">SW 캐시 + localStorage 꼬임 해결. 세션은 유지됩니다.</p>
            <PixelButton
              variant="danger" size="lg" fullWidth
              onClick={async () => {
                if ('caches' in window) {
                  const keys = await window.caches.keys()
                  await Promise.all(keys.map(k => window.caches.delete(k)))
                }
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations()
                  await Promise.all(regs.map(r => r.unregister()))
                }
                sessionStorage.clear()
                const preserveKeys = [
                  'familyId', 'fq_last_login', 'fq_login_at', 'fq_member_cache',
                  'fq_fav_order', 'fq_weekly_comp', 'fq_monthly_comp',
                  'fq_bgm_theme', 'fq_inv_weapon', 'fq_inv_skin', 'fq_inv_pet', 'fq_inv_xp',
                  'fq_snapshots',
                ]
                Object.keys(localStorage)
                  .filter(k => !preserveKeys.includes(k))
                  .forEach(k => localStorage.removeItem(k))
                window.location.reload()
              }}
            >
              ⚡ 캐시 강제 초기화 + 재시작
            </PixelButton>
          </div>

          {/* 💾 상태 저장 & 롤백 */}
          <div className="mb-4 pb-4 border-b border-panel-border">
            <p className="t-sub font-bold text-gold mb-1">💾 상태 저장 & 롤백</p>
            <p className="t-micro text-panel-sub mb-3">현재 상태를 저장하고 이전 시점으로 복원해요. (최대 5개)</p>
            <PixelButton variant="gold" size="md" fullWidth className="mb-3" onClick={saveSnapshot}>
              💾 지금 상태 저장
            </PixelButton>
            {snapshots.length > 0 ? (
              <div className="space-y-2">
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
              <p className="t-micro text-panel-sub text-center py-2">저장된 스냅샷이 없습니다.</p>
            )}
          </div>

          {/* 💥 앱 완전 초기화 (위험 구역) */}
          <div className="pb-2">
            <p className="t-sub font-bold text-rejected mb-1">💀 앱 완전 초기화</p>
            <p className="t-micro text-panel-sub mb-3">모든 미션, 보상, 메시지, 구성원 정보를 영구 삭제하고 초기화합니다.</p>

            {showResetPin ? (
              <div className="space-y-2 animate-fade-in">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={resetPinInput}
                  onChange={e => setResetPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="보안을 위해 아빠 PIN 번호 4자리를 입력하세요"
                  maxLength={4}
                  className={INPUT_CLS}
                />
                {resetPinError && (
                  <p className="font-korean text-xs text-rejected font-bold">{resetPinError}</p>
                )}
                <div className="flex gap-2">
                  <PixelButton variant="danger" size="md" className="flex-1" disabled={resetLoading} onClick={handleAppReset}>
                    {resetLoading ? '폭파 중...' : '💥 초기화 실행'}
                  </PixelButton>
                  <PixelButton variant="ghost" size="md" className="flex-1" onClick={() => { setShowResetPin(false); setResetPinInput('') }}>
                    취소
                  </PixelButton>
                </div>
              </div>
            ) : (
              <PixelButton variant="danger" size="lg" fullWidth onClick={() => setShowResetPin(true)}>
                🚨 데이터베이스 완전 폭파 및 앱 초기화
              </PixelButton>
            )}
          </div>
        </div>
      )}

      {/* ════ 5단: 로그아웃 및 앱 버전 정보 ════════════════════════════ */}
      <div className="pt-2">
        <PixelButton variant="ghost" size="lg" fullWidth onClick={handleLogout}>
          🚪 로그아웃 (현재 세션 종료)
        </PixelButton>
        <div className="text-center mt-4">
          <p className="font-pixel text-[10px] text-panel-sub tracking-wider">
            FAMILY QUEST FAMILY_ID: {familyId ?? 'UNKNOWN'}
          </p>
          <p className="font-pixel text-[9px] text-panel-sub/60 mt-0.5">
            SYSTEM VERSION v{APP_VERSION} · PUBLISHED BY KIM
          </p>
        </div>
      </div>

    </div>
  )
}