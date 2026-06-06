// Design Ref: §5.3 SCR-20 SettingsPage — v5.0 NavRow+AccordionSection 전면 통일
import { useState, useEffect, useCallback, type ReactNode } from 'react'
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
import { audioManager } from '@/infrastructure/audio/audioManager'
import { clearAllFamilyMessages } from '@/infrastructure/firebase/collections/messages'
import { clearGameScores } from '@/infrastructure/firebase/collections/gameScores'
import type { Member } from '@/domain/entities/Member'
import { APP_VERSION } from '@/config/version'
// import { ChildSelector } from '@/presentation/components/settings/ChildSelector'

const INPUT_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'

interface AccordionSectionProps {
  icon: string
  title: string
  description: string
  badge?: string
  danger?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}

function IconCell({ icon, danger }: { icon: string; danger?: boolean }) {
  return (
    <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border-2
      ${danger ? 'bg-rejected/20 border-rejected/40' : 'bg-panel-mid border-panel-border'}`}>
      {icon.startsWith('/') ? (
        <img src={icon} alt="" draggable={false}
          style={{ width: 28, height: 28, imageRendering: 'pixelated', objectFit: 'contain' }} />
      ) : (
        <span className="text-2xl">{icon}</span>
      )}
    </div>
  )
}

function AccordionSection({ icon, title, description, badge, danger, open, onToggle, children }: AccordionSectionProps) {
  const borderCls = danger ? 'border-rejected/50' : open ? 'border-gold/60' : 'border-panel-border'
  return (
    <div className={`border-2 ${borderCls} bg-panel-darkest transition-colors`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-3 select-none active:bg-panel-mid transition-colors"
      >
        <IconCell icon={icon} danger={danger} />

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-korean text-sm font-bold ${danger ? 'text-rejected' : 'text-cream'}`}>
              {title}
            </span>
            {badge && (
              <span className="font-pixel text-xs text-rejected">{badge}</span>
            )}
          </div>
          <span className="font-korean text-xs text-panel-sub truncate block">{description}</span>
        </div>

        <span className={`font-pixel text-xs flex-shrink-0 transition-transform duration-200 ${open ? 'text-gold rotate-90' : 'text-panel-sub'}`}>
          ▶
        </span>
      </button>

      {open && (
        <div className="border-t-2 border-panel-border px-3 pt-3 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

function NavRow({ icon, title, description, onClick, badge }: {
  icon: string; title: string; description: string; onClick: () => void; badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 border-2 border-panel-border
                 bg-panel-darkest active:bg-panel-mid transition-colors select-none"
    >
      <IconCell icon={icon} />
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-korean text-sm font-bold text-cream">{title}</span>
          {badge && <span className="font-pixel text-xs text-gold">{badge}</span>}
        </div>
        <span className="font-korean text-xs text-panel-sub truncate block">{description}</span>
      </div>
      <span className="font-pixel text-xs text-panel-sub flex-shrink-0">▶</span>
    </button>
  )
}

type Snapshot = { ts: string; label: string; data: any }
const LS_SNAPSHOTS = 'fq_snapshots'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { currentMember, familyId, clearSession } = useAuthStore()

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  const isDad = currentMember?.role === 'DAD'

  const [members, setMembers] = useState<Member[]>([])

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ message: string; onYes: () => void } | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editLoginId, setEditLoginId] = useState('')

  const [stickerTarget, setStickerTarget] = useState<string>('')
  const [stickerType, setStickerType] = useState<StickerType>('well_done')
  const [stickerMsg, setStickerMsg] = useState('')
  const [stickerSending, setStickerSending] = useState(false)
  const [stickerToast, setStickerToast] = useState<string | null>(null)
  const [_stickerCoins, setStickerCoins] = useState(false)

  const [openSection, setOpenSection] = useState<string | null>(null)
  const toggleSection = (key: string) => setOpenSection(p => p === key ? null : key)

  const defaultTS = (): TournamentSettings => ({
    active: false, title: '천하제일 가족 게임 대회', roundNumber: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    difficulty: 3,
  })
  const [tournament, setTournament] = useState<TournamentSettings>(defaultTS())
  const [tournamentScs, setTournamentScs] = useState<TournamentScore[]>([])
  const [tSaving, setTSaving] = useState(false)

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_SNAPSHOTS) ?? '[]') } catch { return [] }
  })

  const [currentSettings, setCurrentSettings] = useState<{ familyCodeHash?: string; joinCode?: string } | null>(null)
  const [showResetPin, setShowResetPin] = useState(false)
  const [resetPinInput, setResetPinInput] = useState('')
  const [resetPinError, setResetPinError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

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

  const confirm = (message: string, onYes: () => void) => setConfirmModal({ message, onYes })
  void members.filter(m => m.role === 'CHILD' && m.isActive)  // 미사용: _children
  // 스티커 대상: 나를 제외한 모든 활성 구성원
  const stickerTargets = members.filter(m => m.id !== currentMember?.id && m.isActive)

  const handleLogout = async () => {
    await signOut()
    clearSession()
    clearAllLocalData()
    navigate('/login')
  }

  // ── 엔진 새로고침 (아이/부모 공통) ───────────────────────────────
  const handleEngineRefresh = async () => {
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
  }

  // ── 스티커 전송 (아이/부모 공통 — early return 앞에 정의 필수) ───
  const handleSendSticker = async () => {
    if (!familyId || !stickerTarget || !currentMember) return
    setStickerSending(true)
    const { error } = await sendPraiseSticker(
      familyId, currentMember.id, currentMember.name,
      stickerTarget, stickerType, stickerMsg.trim()
    )
    setStickerSending(false)
    if (error) { setStickerToast('발송 실패: ' + error) }
    else {
      audioManager.coinCollect()
      setStickerMsg('')
      setStickerToast('칭찬 스티커를 붙여줬어요! 🌟')
      setStickerCoins(true)
      setTimeout(() => setStickerCoins(false), 1200)
    }
    setTimeout(() => setStickerToast(null), 3000)
  }

  // ── 공통 스티커 패널 렌더 함수 ───────────────────────────────────
  const _renderStickerPanel = () => (
    <>
      <p className="font-korean text-xs font-bold text-panel-sub mb-2">누구에게?</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {stickerTargets.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setStickerTarget(m.id)}
            className={[
              'px-3 py-1.5 border-2 font-korean text-sm transition-colors',
              stickerTarget === m.id
                ? 'border-gold bg-gold/10 text-gold font-bold'
                : 'border-panel-border text-panel-sub hover:border-gold/40',
            ].join(' ')}
          >
            {m.name}
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
            <img src={info.svg} alt={info.label} width={24} height={24} style={{ imageRendering: 'pixelated' }} />
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
        {stickerSending ? '붙이는 중...' : '화이트보드에 붙여주기'}
      </PixelButton>
      {stickerToast && (
        <p className="font-korean text-xs text-gold text-center mt-2">{stickerToast}</p>
      )}
    </>
  )

  // ── 아이 전용 작업공간 ────────────────────────────────────────────
  if (!isParent) {
    return (
      <div className="p-3 space-y-3">
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9990] px-4 py-2
            border-4 font-korean text-sm ${toast.type === 'success' ? 'border-approved text-approved bg-panel-darkest' : 'border-rejected text-rejected bg-panel-darkest'}`}>
            {toast.message}
          </div>
        )}
        <PixelModal open={!!confirmModal} title="확인" onClose={() => setConfirmModal(null)} size="sm">
          <p className="font-korean text-sm text-cream text-center mb-5 whitespace-pre-line">{confirmModal?.message}</p>
          <div className="flex gap-3">
            <PixelButton variant="ghost" className="flex-1" onClick={() => setConfirmModal(null)}>취소</PixelButton>
            <PixelButton variant="danger" className="flex-1" onClick={() => { confirmModal?.onYes(); setConfirmModal(null) }}>실행</PixelButton>
          </div>
        </PixelModal>

        <h1 className="t-heading text-gold t-pixel-shadow px-1">작업공간</h1>

        {/* 칭찬 스티커 보내기 */}
        <AccordionSection
          icon="/assets/icons/star.svg"
          title="칭찬 스티커 보내기"
          description="가족에게 칭찬 스티커 발송"
          open={openSection === 'sticker'}
          onToggle={() => toggleSection('sticker')}
        >
          {_renderStickerPanel()}
        </AccordionSection>

        {/* 기념일·생일 관리 */}
        <NavRow
          icon="/assets/icons/calendar.svg"
          title="기념일·생일 관리"
          description="달력에 기념일을 표시해요"
          onClick={() => navigate('/settings/special-days')}
        />

        {/* 엔진 완전 새로고침 */}
        <AccordionSection
          icon="/assets/icons/lightning.svg"
          title="엔진 완전 새로고침"
          description="앱 꼬임 해결, 세션 유지"
          open={openSection === 'cache'}
          onToggle={() => toggleSection('cache')}
        >
          <p className="t-micro text-panel-sub mb-3">SW 캐시 + localStorage 꼬임 해결. 세션은 유지됩니다.</p>
          <PixelButton variant="danger" size="lg" fullWidth onClick={handleEngineRefresh}>
            캐시 강제 초기화 + 재시작
          </PixelButton>
        </AccordionSection>

        {/* 로그아웃 */}
        <PixelButton variant="danger" size="lg" fullWidth onClick={handleLogout}>
          로그아웃
        </PixelButton>
      </div>
    )
  }

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

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'] as const
  const roundScores = tournamentScs
    .filter(s => s.roundNumber === tournament.roundNumber)
    .slice(0, 5)

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="p-3 pb-4 space-y-2">

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

      <h1 className="t-heading text-gold t-pixel-shadow px-1">⚙️ 설정</h1>

      {/* ════ 1: 가족 구성원 — AccordionSection ════════════════════════ */}
      <AccordionSection
        icon="/assets/pets/rabbit.svg"
        title={`가족 구성원 (${members.length}명)`}
        description="구성원 정보·loginID 편집"
        open={openSection === 'members'}
        onToggle={() => toggleSection('members')}
      >
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
      </AccordionSection>

      {/* ════ 2: 메뉴 4종 — NavRow ══════════════════════════════════════ */}
      <NavRow icon="/assets/icons/gift.svg"     title="아이들 보상주기"  description="미션 완료 보상을 아이들에게" onClick={() => navigate('/settings/rewards-send')} />
      <NavRow icon="/assets/icons/begging.svg"  title="조르기 요청 관리" description="아이들의 조르기 요청 검토" onClick={() => navigate('/begging/manage')} />
      <NavRow icon="/assets/icons/letter.svg"   title="두근두근 질문함"  description="아이들의 답변 확인" onClick={() => navigate('/settings/question-answers')} />
      <NavRow icon="/assets/icons/calendar.svg" title="기념일·생일 관리" description="달력에 기념일을 표시해요" onClick={() => navigate('/settings/special-days')} />

      {/* ════ 3: 칭찬 스티커 (가족 모두 서로 보낼 수 있음) ══════════════ */}
      {stickerTargets.length > 0 && (
        <AccordionSection
          icon="/assets/icons/star.svg"
          title="칭찬 스티커 보내기"
          description="가족에게 칭찬 스티커 발송"
          open={openSection === 'sticker'}
          onToggle={() => toggleSection('sticker')}
        >
          {_renderStickerPanel()}
        </AccordionSection>
      )}

      {/* ════ 4: 아빠 작업방 — NavRow + AccordionSection (DAD 전용) ═════ */}
      {isDad && (
        <>
          <NavRow
            icon="/assets/icons/megaphone.svg"
            title="공지사항 관리"
            description="가족에게 공지를 올리고 편집해요"
            onClick={() => navigate('/settings/notices')}
          />

          <AccordionSection
            icon="/assets/icons/trophy.svg"
            title="주간 대회 제어판"
            description="게임 경쟁 시작·종료·랭킹 설정"
            badge={tournament.active ? '🔴 LIVE' : undefined}
            open={openSection === 'tournament'}
            onToggle={() => toggleSection('tournament')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`px-2 py-1 border ${tournament.active ? 'border-gold bg-gold/10' : 'border-panel-border bg-panel-darkest'}`}>
                <p className="font-pixel text-xs text-gold">
                  {tournament.active ? '🔴 LIVE' : '⚪ 대기'} — 제{tournament.roundNumber}회
                </p>
                <p className="font-korean text-xs text-cream">{tournament.title}</p>
              </div>
              <PixelButton
                size="sm"
                variant={tournament.active ? 'danger' : 'success'}
                onClick={handleTournamentToggle}
              >
                {tournament.active ? '⏹ 종료' : '▶ 시작'}
              </PixelButton>
            </div>
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
                    <span key={l} className={`font-korean text-xs ${tournament.difficulty === i + 1 ? 'text-gold font-bold' : 'text-panel-sub'}`}>
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <PixelButton variant="gold" size="md" className="flex-1" disabled={tSaving} onClick={handleTournamentSave}>
                {tSaving ? '저장 중...' : '저장'}
              </PixelButton>
              <PixelButton variant="sky" size="md" className="flex-1"
                onClick={() => confirm('새 회차를 시작할까요?\n기존 랭킹은 유지돼요.', handleNewRound)}>
                ⏭ 다음 회차
              </PixelButton>
            </div>
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
          </AccordionSection>

          <AccordionSection
            icon="/assets/icons/lightning.svg"
            title="엔진 완전 새로고침"
            description="SW 캐시·localStorage 꼬임 해결, 세션 유지"
            open={openSection === 'cache'}
            onToggle={() => toggleSection('cache')}
          >
            <p className="t-micro text-panel-sub mb-3">SW 캐시 + localStorage 꼬임 해결. 세션은 유지됩니다.</p>
            <PixelButton variant="danger" size="lg" fullWidth onClick={handleEngineRefresh}>
              캐시 강제 초기화 + 재시작
            </PixelButton>
          </AccordionSection>

          <AccordionSection
            icon="/assets/icons/gamepad.svg"
            title="게임 랭크 초기화"
            description="게임별 순위 기록 전체 삭제"
            danger
            open={openSection === 'clearrank'}
            onToggle={() => toggleSection('clearrank')}
          >
            <p className="t-micro text-panel-sub mb-3">선택한 게임의 점수 기록을 모두 삭제합니다. 되돌릴 수 없어요.</p>
            <div className="flex flex-col gap-2">
              {([
                { id: 'galaga',     label: '갤러그' },
                { id: 'ponpoko',    label: '슈퍼점핑' },
                { id: 'minesweeper', label: '마이펫 찾기' },
                { id: 'whacamole',  label: '아빠잡기' },
                { id: 'sudoku',     label: '언도쿠' },
              ] as const).map(game => (
                <PixelButton
                  key={game.id}
                  variant="danger" size="sm" fullWidth
                  onClick={() => confirm(`${game.label} 랭크 기록을 모두 삭제할까요?\n되돌릴 수 없어요.`, async () => {
                    if (!familyId) return
                    try {
                      await clearGameScores(familyId, game.id)
                      showToast(`${game.label} 랭크가 초기화됐어요`, 'success')
                    } catch {
                      showToast('삭제 실패', 'error')
                    }
                  })}
                >
                  {game.label} 랭크 삭제
                </PixelButton>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            icon="/assets/icons/trash.svg"
            title="채팅 기록 삭제"
            description="그룹 채팅 전체 기록을 영구 삭제"
            danger
            open={openSection === 'clearchat'}
            onToggle={() => toggleSection('clearchat')}
          >
            <p className="t-micro text-panel-sub mb-3">그룹채팅 메시지를 모두 삭제합니다. 1:1 대화는 유지됩니다. 되돌릴 수 없어요.</p>
            <PixelButton
              variant="danger" size="lg" fullWidth
              onClick={() => confirm('그룹채팅 기록을 모두 삭제할까요?\n되돌릴 수 없어요.', async () => {
                if (!familyId) return
                const { error } = await clearAllFamilyMessages(familyId)
                if (error) showToast('삭제 실패: ' + error, 'error')
                else showToast('채팅 기록이 삭제됐어요', 'success')
              })}
            >
              💬 채팅 기록 전체 삭제
            </PixelButton>
          </AccordionSection>

          <AccordionSection
            icon="/assets/icons/save.svg"
            title={`상태 저장 & 롤백 ${snapshots.length > 0 ? `(${snapshots.length})` : ''}`}
            description="현재 상태를 저장하고 이전 시점으로 복원"
            danger
            open={openSection === 'snapshot'}
            onToggle={() => toggleSection('snapshot')}
          >
            <p className="t-micro text-panel-sub mb-3">로컬 세션 정보(로그인·즐겨찾기)만 저장해요. 서버 데이터는 영향 없음. (최대 5개)</p>
            <PixelButton variant="gold" size="md" fullWidth className="mb-3" onClick={saveSnapshot}>
              지금 상태 저장
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
          </AccordionSection>

          <AccordionSection
            icon="/assets/icons/skull.svg"
            title="앱 완전 초기화"
            description="모든 데이터 영구 삭제 — 되돌릴 수 없어요"
            danger
            open={openSection === 'reset'}
            onToggle={() => toggleSection('reset')}
          >
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
          </AccordionSection>
        </>
      )}

      {/* ════ 5: 로그아웃 및 앱 버전 정보 ════════════════════════════════ */}
      <div className="pt-2">
        <PixelButton variant="ghost" size="lg" fullWidth onClick={handleLogout}>
          로그아웃 (현재 세션 종료)
        </PixelButton>
        <div className="text-center mt-4">
          <p className="font-pixel text-xs text-panel-sub tracking-wider">
            FAMILY QUEST · {familyId ?? 'UNKNOWN'}
          </p>
          <p className="font-pixel text-xs text-panel-sub/60 mt-0.5">
            v{APP_VERSION} · PUBLISHED BY KIM
          </p>
        </div>
      </div>

    </div>
  )
}
