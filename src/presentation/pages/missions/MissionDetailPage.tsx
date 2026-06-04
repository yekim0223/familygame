// Design Ref: §5.3 SCR-06 MissionDetailPage — Daily Slot 시스템 (Phase 3-2 다크 테마)
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  deleteMission, updateDaySlot, removeDaySlot, confirmQuestByChild, updateMission,
} from '@/infrastructure/firebase/collections/missions'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import { subscribeMembers, updateMember, getMember } from '@/infrastructure/firebase/collections/members'
import { getLevelFromExp } from '@/domain/services/ExpCalc'
import { recordXPReward } from '@/infrastructure/firebase/collections/rewards'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { StatusBadge } from '@/presentation/components/missions/StatusBadge'
import { DIFFICULTY_INFO, CATEGORY_LABELS } from '@/domain/entities/Mission'
import { audioManager } from '@/infrastructure/audio/audioManager'
import type { MissionStatus, DaySlot } from '@/domain/entities/Mission'
import type { Member } from '@/domain/entities/Member'
import { toDateKey } from '@/utils/dateUtils'
import { EffectOverlay } from '@/presentation/components/effects/EffectOverlay'
import type { EffectType } from '@/presentation/components/effects/EffectOverlay'

// 이력 텍스트 전용 레이블 — 상태 배지 표시는 StatusBadge 컴포넌트 사용 (규칙 21)
const STATUS_LABEL: Record<MissionStatus, string> = {
  ACTIVE:           '진행중',
  PENDING_APPROVAL: '완료신청',
  ON_HOLD:          '보류중',
  APPROVED:         '완료',
  REJECTED:         '미승인',
  EXPIRED:          '소멸됨',
  CHILD_REJECTED:   '거절됨',
}

// G/B/H 슬롯 스타일 — btnCls 제거(PixelButton variant 사용), rowCls 불투명도 /20으로 확보
const SLOT_STYLE: Record<DaySlot, { label: string; icon: string; badgeCls: string; rowCls: string }> = {
  GOOD: { label: 'Good', icon: '⭐', badgeCls: 'bg-approved/20 text-approved border-approved', rowCls: 'bg-approved/20 border-l-4 border-l-approved' },
  BAD:  { label: 'Bad',  icon: '❌', badgeCls: 'bg-rejected/20 text-rejected border-rejected', rowCls: 'bg-rejected/20 border-l-4 border-l-rejected' },
  HOLD: { label: 'Hold', icon: '⏸', badgeCls: 'bg-hold/20    text-hold    border-hold',       rowCls: 'bg-hold/20    border-l-4 border-l-hold'    },
}

const SLOT_VARIANT: Record<DaySlot, 'success' | 'danger' | 'hold'> = {
  GOOD: 'success',
  BAD:  'danger',
  HOLD: 'hold',
}

// ── 헬퍼 ──────────────────────────────────────────────────────────
function getDateRange(start: Date, end: Date): string[] {
  const keys: string[] = []
  const cur = new Date(start); cur.setHours(0, 0, 0, 0)
  const fin = new Date(end);   fin.setHours(23, 59, 59, 999)
  while (cur <= fin) { keys.push(toDateKey(cur)); cur.setDate(cur.getDate() + 1) }
  return keys
}
function formatDate(key: string): string {
  const [, m, d] = key.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

// ──────────────────────────────────────────────────────────────────
export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentMember, familyId } = useAuthStore()
  // 규칙 10: Zustand 셀렉터로 미션 구독 (즉시 갱신)
  const mission = useMissionStore(state => state.missions.find(m => m.id === id))

  // ── 모든 useState/useEffect 를 조건부 return 전에 선언 (React hooks 규칙) ──
  const [members,          setMembers]          = useState<Member[]>([])
  const [toast,            setToast]            = useState<{ message: string; type: 'success'|'error'|'info' }|null>(null)
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(false)
  const [deleting,         setDeleting]          = useState(false)
  const [slotLoading,      setSlotLoading]       = useState<string|null>(null)
  const [selectedChild,    setSelectedChild]     = useState('')
  const [confirming,       setConfirming]        = useState(false)
  const [expiring,         setExpiring]          = useState(false)
  const [goodFlash,        setGoodFlash]         = useState<string|null>(null)
  const [activeEffect,     setActiveEffect]      = useState<EffectType|null>(null)

  // 규칙 11: subscribeMembers로 실시간 구독
  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  // selectedChild 초기화 (mission 로드 후)
  useEffect(() => {
    if (mission && !selectedChild && mission.targetMemberIds.length > 0) {
      setSelectedChild(mission.targetMemberIds[0])
    }
  }, [mission?.id])

  const getMemberName = (memberId: string) => {
    const m = members.find(m => m.id === memberId)
    return m ? (m.name || m.realName || memberId.slice(0, 6)) : memberId.slice(0, 6)
  }

  const showToast = (message: string, type: 'success'|'error'|'info' = 'success') => {
    setToast({ message, type })
    if (type !== 'error') setTimeout(() => setToast(null), 3000)
  }

  // ── Early return (hooks 이후에만 허용) ──────────────────────────
  if (!mission || !currentMember || !familyId) {
    return (
      <div className="p-4 text-center">
        <p className="font-korean text-panel-sub">퀘스트를 찾을 수 없어요</p>
        <PixelButton variant="ghost" onClick={() => navigate(-1)} className="mt-3">◀ 뒤로</PixelButton>
      </div>
    )
  }

  // ── 파생 값 (mission이 non-null인 이후에 계산) ─────────────────
  const isParent   = currentMember.role === 'DAD' || currentMember.role === 'MOM'
  const diffInfo   = DIFFICULTY_INFO[mission.difficulty]
  const dateRange  = getDateRange(mission.startDate, mission.endDate)
  const todayKey   = toDateKey(new Date())
  const evals      = mission.slot_evaluations ?? {}
  const multiChild = mission.targetMemberIds.length > 1

  const activeChildId    = multiChild ? (selectedChild || mission.targetMemberIds[0]) : (mission.targetMemberIds[0] ?? currentMember.id)
  const activeChildSlots : Record<string, DaySlot> = evals[activeChildId] ?? {}

  const goodCount = Object.values(activeChildSlots).filter(v => v === 'GOOD').length
  const badCount  = Object.values(activeChildSlots).filter(v => v === 'BAD').length
  const holdCount = Object.values(activeChildSlots).filter(v => v === 'HOLD').length
  const totalEval = dateRange.length

  // ── 이벤트 핸들러 ────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (confirming) return
    setConfirming(true)
    const { error } = await confirmQuestByChild(familyId, mission.id)
    if (error) { setConfirming(false); showToast(error, 'error'); return }

    const childName = currentMember.name || currentMember.realName || '아이'
    const parentIds = members.filter(m => m.role === 'DAD' || m.role === 'MOM').map(m => m.id)
    await Promise.all(
      parentIds.map(pid =>
        createNotification(familyId, {
          type: 'MISSION_CONFIRMED',
          targetMemberId: pid,
          content: `${childName}이(가) 퀘스트 "${mission.title}"을(를) 확인했어요 ✅`,
          relatedId: mission.id,
        })
      )
    )
    setConfirming(false)
    audioManager.missionConfirm()
    setActiveEffect('confetti')
    showToast('✅ 퀘스트를 확인했어요!', 'success')
  }

  const handleSlot = async (dateKey: string, slot: DaySlot) => {
    if (slotLoading) return
    if (slot === 'GOOD') {
      setGoodFlash(`${activeChildId}::${dateKey}`)
      setTimeout(() => setGoodFlash(null), 550)
      audioManager.slotApproval()
      setActiveEffect('stars')
    }
    setSlotLoading(`${activeChildId}::${dateKey}`)
    const { error } = await updateDaySlot(familyId, mission.id, activeChildId, dateKey, slot)
    setSlotLoading(null)
    if (error) { showToast(error, 'error'); return }
    showToast(`${getMemberName(activeChildId)} · ${formatDate(dateKey)} ${SLOT_STYLE[slot].icon} ${SLOT_STYLE[slot].label}`, 'success')
  }

  const handleRemoveSlot = async (dateKey: string) => {
    if (slotLoading) return
    setSlotLoading(`${activeChildId}::${dateKey}`)
    const { error } = await removeDaySlot(familyId, mission.id, activeChildId, dateKey, evals)
    setSlotLoading(null)
    if (error) { showToast(error, 'error'); return }
    showToast(`${formatDate(dateKey)} 평가 취소됨`, 'info')
  }

  const handleExpire = async () => {
    if (expiring) return
    setExpiring(true)
    const { error } = await updateMission(familyId, mission.id, { status: 'EXPIRED' } as any)

    // 퀘스트 완료 XP: 난이도 × 10 (difficulty 1→10, 5→50)
    const xpGain = mission.difficulty * 10
    for (const childId of mission.targetMemberIds) {
      const { data: child } = await getMember(familyId, childId)
      if (!child) continue
      const newExp   = (child.exp ?? 0) + xpGain
      const newLevel = getLevelFromExp(newExp)
      await updateMember(familyId, childId, { exp: newExp, level: newLevel } as any)
      await recordXPReward(familyId, childId, xpGain, 'xp_quest',
        `퀘스트 완료: ${mission.title}`, familyId)
    }

    setExpiring(false)
    if (error) { showToast(error, 'error'); return }
    showToast('퀘스트를 종료했어요', 'info')
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    const { error } = await deleteMission(familyId, mission.id)
    if (error) {
      setDeleting(false)
      setShowDeleteConfirm(false)
      showToast(error, 'error')
      return
    }
    setShowDeleteConfirm(false)
    showToast('삭제했습니다.', 'success')
    setTimeout(() => navigate('/missions'), 1500)
  }

  // 토스트 모달 표시용 파생값
  const toastTitle = toast?.type === 'error' ? '오류' : toast?.type === 'info' ? '안내' : '완료'
  const toastColor = toast?.type === 'error' ? 'text-rejected' : toast?.type === 'info' ? 'text-sky' : 'text-approved'

  // ── 렌더 ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-3 pb-8">
      {activeEffect && (
        <EffectOverlay
          type={activeEffect}
          count={activeEffect === 'stars' ? 20 : 28}
          onEnd={() => setActiveEffect(null)}
        />
      )}

      {/* ── 알림 토스트 (PixelModal) ── */}
      <PixelModal
        open={!!toast}
        onClose={() => setToast(null)}
        title={toastTitle}
        size="sm"
      >
        <p className={`font-korean text-base font-bold text-center leading-snug ${toastColor}`}>
          {toast?.message}
        </p>
        <PixelButton variant="ghost" fullWidth className="mt-4" onClick={() => setToast(null)}>
          확인
        </PixelButton>
      </PixelModal>

      {/* ── 삭제 확인 (PixelModal) ── */}
      <PixelModal
        open={showDeleteConfirm}
        onClose={() => !deleting && setShowDeleteConfirm(false)}
        title="퀘스트 삭제"
        size="sm"
      >
        <p className="font-korean text-sm text-panel-sub text-center mb-1 leading-snug">
          아래 퀘스트를 삭제할까요?
        </p>
        <p className="font-korean text-base text-cream font-bold text-center mb-4">
          "{mission.title}"
        </p>
        <div className="flex gap-2">
          <PixelButton
            variant="ghost"
            fullWidth
            disabled={deleting}
            onClick={() => setShowDeleteConfirm(false)}
          >
            취소
          </PixelButton>
          <PixelButton
            variant="danger"
            fullWidth
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? '삭제 중...' : '🗑️ 삭제'}
          </PixelButton>
        </div>
      </PixelModal>

      {/* ── 미션 헤더 (highlight — 상단 강조 카드) ── */}
      <PixelCard variant="highlight">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 border-2 border-panel-border ${diffInfo.color} flex items-center justify-center flex-shrink-0`}>
            <span className="font-pixel text-xs text-white">{mission.difficulty}</span>
          </div>
          <span className="font-korean text-xs text-panel-sub flex-1">{CATEGORY_LABELS[mission.category]}</span>
          <StatusBadge status={mission.status} />
        </div>
        <h1 className="font-korean text-lg font-bold text-cream">
          {mission.emoji} {mission.title}
        </h1>
        {mission.description && (
          <p className="font-korean text-sm text-panel-sub mt-1">{mission.description}</p>
        )}
      </PixelCard>

      {/* ── 미션 정보 ── */}
      <PixelCard variant="dark">
        <div className="space-y-2 font-korean text-sm">
          <div className="flex justify-between">
            <span className="text-panel-sub">기간</span>
            <span className="text-cream text-xs">
              {mission.startDate.toLocaleDateString()} ~ {mission.endDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-panel-sub">유형</span>
            <span className="text-cream">
              {mission.type === 'DAILY' ? '일일' : mission.type === 'WEEKLY' ? '주간'
               : mission.type === 'MONTHLY' ? '월간' : '기간'} 미션
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-panel-sub">난이도</span>
            <span className="text-cream">{diffInfo.label} (+{diffInfo.exp}점)</span>
          </div>
          <div>
            <span className="text-panel-sub">보상</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {mission.rewards.map((r, i) => (
                <span key={i} className="bg-gold/20 border border-gold px-2.5 py-1 font-korean text-base text-cream font-bold">
                  {r.type === 'MONEY'      ? `💰 ${(r.amount||0).toLocaleString()}원` :
                   r.type === 'GAME_TIME'  ? `🎮 ${r.amount}분` :
                   r.type === 'PHONE_TIME' ? `📱 ${r.amount}분` :
                   r.type === 'GIFT'       ? `🎁 ${r.customLabel||'선물'}` :
                   r.type === 'DINING'     ? `🍕 ${r.customLabel||'외식'}` :
                   `⭐ ${r.customLabel}`}
                </span>
              ))}
            </div>
          </div>
          {mission.targetMemberIds.length > 0 && (
            <div className="flex justify-between">
              <span className="text-panel-sub">대상</span>
              <span className="text-cream text-xs">
                {mission.targetMemberIds.map(tid =>
                  members.length > 0 ? getMemberName(tid) : '...'
                ).join(', ')}
              </span>
            </div>
          )}
        </div>
      </PixelCard>

      {/* ── 아이 전용: 확인 버튼 ── */}
      {!isParent && (
        <PixelCard variant="dark" padding="sm">
          {mission.confirmedByChild ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-xl">✅</span>
              <p className="font-korean text-sm font-bold text-approved">퀘스트 확인 완료!</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-korean text-xs text-panel-sub text-center">
                퀘스트를 확인하면 부모님께 알림이 가요
              </p>
              <PixelButton
                variant="gold"
                fullWidth
                disabled={confirming}
                onClick={handleConfirm}
              >
                {confirming ? '처리 중...' : '✅ 퀘스트 확인하기'}
              </PixelButton>
            </div>
          )}
        </PixelCard>
      )}

      {/* ── 부모 전용: Daily Slot 평가 ── */}
      {isParent && (
        <PixelCard variant="dark" padding="sm">
          {/* 아이 선택 탭 (다자녀인 경우) — bg-panel-darkest + 활성 gold 라인 */}
          {multiChild && (
            <div className="flex gap-1 mb-3 border-b-2 border-panel-border pb-0">
              {mission.targetMemberIds.map(mId => (
                <button key={mId} type="button"
                  onClick={() => setSelectedChild(mId)}
                  className={[
                    'flex-1 py-2 font-korean text-xs font-bold transition-all border-b-4 -mb-0.5',
                    activeChildId === mId
                      ? 'bg-panel-surface text-cream border-gold'
                      : 'bg-panel-darkest text-panel-sub border-transparent hover:text-cream',
                  ].join(' ')}>
                  {members.length > 0 ? getMemberName(mId) : mId.slice(0, 6)}
                </button>
              ))}
            </div>
          )}

          {/* G/B/H 누적 카운터 */}
          <div className="grid grid-cols-3 gap-2 mb-3 mt-2">
            {[
              { label: '⭐ Good', count: goodCount, cls: 'text-approved border-approved bg-approved/20' },
              { label: '❌ Bad',  count: badCount,  cls: 'text-rejected border-rejected bg-rejected/20' },
              { label: '⏸ Hold', count: holdCount, cls: 'text-hold border-hold bg-hold/20' },
            ].map(item => (
              <div key={item.label} className={`border-2 ${item.cls} text-center py-2`}>
                <p className="font-pixel text-lg font-bold">{item.count}</p>
                <p className="font-korean text-xs font-bold">{item.label}</p>
                <p className="font-korean text-xs text-panel-sub">{totalEval}일 중</p>
              </div>
            ))}
          </div>

          {/* 날짜 슬롯 (역순) */}
          <p className="font-korean text-xs font-bold text-gold mb-2">날짜별 평가</p>
          <div className="space-y-1.5">
            {[...dateRange].reverse().map(dateKey => {
              const evaluated = activeChildSlots[dateKey] as DaySlot | undefined
              const isFuture  = dateKey > todayKey
              const isLoading = slotLoading === `${activeChildId}::${dateKey}`
              const rowStyle  = evaluated ? SLOT_STYLE[evaluated].rowCls : ''

              return (
                <div key={dateKey}
                  className={`flex items-center gap-2 px-2 py-2 rounded-sm transition-colors ${rowStyle}`}>
                  <span className="font-korean text-xs text-panel-sub w-14 flex-shrink-0 font-bold">
                    {formatDate(dateKey)}
                  </span>

                  {isFuture ? (
                    <span className="font-korean text-xs text-panel-sub flex-1">미래</span>
                  ) : evaluated ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`font-korean text-xs font-bold px-2 py-0.5 border-2 ${SLOT_STYLE[evaluated].badgeCls}`}>
                        {SLOT_STYLE[evaluated].icon} {SLOT_STYLE[evaluated].label}
                      </span>
                      <PixelButton
                        variant="ghost"
                        size="sm"
                        disabled={!!slotLoading}
                        onClick={() => handleRemoveSlot(dateKey)}
                      >
                        수정
                      </PixelButton>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 flex-1">
                      {(['GOOD', 'BAD', 'HOLD'] as DaySlot[]).map(slot => (
                        <div key={slot} className="relative flex-1 overflow-visible">
                          <PixelButton
                            variant={SLOT_VARIANT[slot]}
                            size="sm"
                            disabled={!!slotLoading}
                            fullWidth
                            onClick={() => handleSlot(dateKey, slot)}
                          >
                            {SLOT_STYLE[slot].icon} {isLoading ? '...' : SLOT_STYLE[slot].label}
                          </PixelButton>
                          {/* G슬롯 골드 파티클 */}
                          {slot === 'GOOD' && goodFlash === `${activeChildId}::${dateKey}` && (
                            <div className="absolute inset-0 pointer-events-none overflow-visible">
                              {(['-14px', '0px', '14px'] as const).map((px, i) => (
                                <span
                                  key={i}
                                  className="absolute top-0 left-1/2 text-xs animate-gold-particle select-none"
                                  style={{ '--px': px, marginLeft: '-6px' } as React.CSSProperties}
                                >
                                  ⭐
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </PixelCard>
      )}

      {/* ── 부모 액션 버튼 ── */}
      {isParent && (
        <div className="flex gap-2">
          {mission.status !== 'EXPIRED' && mission.status !== 'APPROVED' && (
            <PixelButton
              variant="ghost"
              fullWidth
              disabled={expiring}
              onClick={handleExpire}
            >
              ⏹ {expiring ? '처리 중...' : '종료'}
            </PixelButton>
          )}
          <PixelButton
            variant="danger"
            fullWidth
            onClick={() => setShowDeleteConfirm(true)}
          >
            🗑️ 삭제
          </PixelButton>
        </div>
      )}

      {/* ── 변경 이력 ── */}
      {mission.statusHistory.length > 0 && (
        <PixelCard variant="dark" padding="sm">
          <p className="font-korean text-sm font-bold text-gold mb-2">변경 이력</p>
          <div className="space-y-2">
            {mission.statusHistory.slice(0, 5).map((h, i) => {
              const byName = members.find(m => m.id === h.changedBy)?.name ?? h.changedBy.slice(0, 6)
              const timeStr = h.changedAt.toLocaleString('ko-KR', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
              })
              const fromLabel = STATUS_LABEL[h.from as MissionStatus] ?? h.from
              const toLabel   = STATUS_LABEL[h.to as MissionStatus] ?? h.to
              return (
                <div key={i} className="flex items-start gap-2 pb-1.5 border-b border-panel-border last:border-0">
                  <span className="text-sm flex-shrink-0">🔄</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-korean text-xs font-bold text-cream">
                      {fromLabel} → {toLabel}
                    </p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="font-korean text-xs text-gold">{byName}</span>
                      <span className="font-korean text-xs text-panel-sub">{timeStr}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </PixelCard>
      )}
    </div>
  )
}
