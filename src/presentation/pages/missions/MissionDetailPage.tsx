// Design Ref: §5.3 SCR-06 MissionDetailPage — Daily Slot 시스템 (아이별 탭)
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  deleteMission, updateDaySlot, removeDaySlot, confirmQuestByChild, updateMission,
} from '@/infrastructure/firebase/collections/missions'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { DIFFICULTY_INFO, CATEGORY_LABELS } from '@/domain/entities/Mission'
import type { MissionStatus, DaySlot } from '@/domain/entities/Mission'
import type { Member } from '@/domain/entities/Member'

// ── 상태 레이블 ────────────────────────────────────────────────────
const STATUS_LABEL: Record<MissionStatus, { label: string; color: string }> = {
  ACTIVE:           { label: '진행중',   color: 'text-approved' },
  PENDING_APPROVAL: { label: '완료신청', color: 'text-sky' },
  ON_HOLD:          { label: '보류중',   color: 'text-hold' },
  APPROVED:         { label: '완료',     color: 'text-purple' },
  REJECTED:         { label: '미승인',   color: 'text-rejected' },
  EXPIRED:          { label: '종료됨',   color: 'text-rejected font-bold' },
  CHILD_REJECTED:   { label: '거절됨',   color: 'text-rejected' },
}

// ── 슬롯 스타일 ────────────────────────────────────────────────────
const SLOT_STYLE: Record<DaySlot, { label: string; btnCls: string; badgeCls: string; rowCls: string; icon: string }> = {
  GOOD: {
    label: 'Good',
    btnCls:   'bg-cream text-approved border-approved hover:bg-approved/10',
    badgeCls: 'bg-approved/10 text-approved border-approved',
    rowCls:   'bg-approved/8 border-l-4 border-l-approved',
    icon: '⭐',
  },
  BAD: {
    label: 'Bad',
    btnCls:   'bg-cream text-rejected border-rejected hover:bg-rejected/10',
    badgeCls: 'bg-rejected/10 text-rejected border-rejected',
    rowCls:   'bg-rejected/8 border-l-4 border-l-rejected',
    icon: '❌',
  },
  HOLD: {
    label: 'Hold',
    btnCls:   'bg-cream text-hold border-hold hover:bg-hold/10',
    badgeCls: 'bg-hold/10 text-hold border-hold',
    rowCls:   'bg-hold/8 border-l-4 border-l-hold',
    icon: '⏸',
  },
}

// ── 헬퍼 ──────────────────────────────────────────────────────────
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
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

// ── 팝업 ──────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: {
  message: string; type: 'success' | 'error' | 'info'; onClose?: () => void
}) {
  const bg = type === 'success' ? 'bg-approved' : type === 'error' ? 'bg-rejected' : 'bg-sky'
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
      <div className={`w-full max-w-xs px-5 py-5 border-4 border-pixel-dark shadow-pixel text-center ${bg}`}
           onClick={e => e.stopPropagation()}>
        <p className="font-korean text-sm text-white font-bold leading-snug">{message}</p>
        {onClose && (
          <button type="button" onClick={onClose}
            className="mt-3 font-korean text-xs text-white/80 border border-white/40 px-4 py-1">
            확인
          </button>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentMember, familyId } = useAuthStore()

  // ── 미션을 Zustand 셀렉터로 구독 (즉시 갱신) ──────────────────
  const mission = useMissionStore(state => state.missions.find(m => m.id === id))

  // ── 가족 구성원 (멤버 이름 표시용) ────────────────────────────
  const [members, setMembers] = useState<Member[]>([])
  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])
  const getMemberName = (memberId: string) => {
    const m = members.find(m => m.id === memberId)
    return m ? (m.name || m.realName || memberId.slice(0, 6)) : memberId.slice(0, 6)
  }

  // ── 로컬 UI 상태 ────────────────────────────────────────────────
  const [toast,            setToast]            = useState<{ message: string; type: 'success'|'error'|'info' }|null>(null)
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(false)
  const [deleting,         setDeleting]          = useState(false)
  const [slotLoading,      setSlotLoading]       = useState<string|null>(null)  // 'memberId::dateKey'
  const [selectedChild,    setSelectedChild]     = useState('')

  const showToast = (message: string, type: 'success'|'error'|'info' = 'success') => {
    setToast({ message, type })
    if (type !== 'error') setTimeout(() => setToast(null), 3000)
  }

  // selectedChild 초기화 (mission 로드 후)
  useEffect(() => {
    if (mission && !selectedChild && mission.targetMemberIds.length > 0) {
      setSelectedChild(mission.targetMemberIds[0])
    }
  }, [mission?.id])

  if (!mission || !currentMember || !familyId) {
    return (
      <div className="p-4 text-center">
        <p className="font-korean text-stone">퀘스트를 찾을 수 없어요</p>
        <PixelButton variant="ghost" onClick={() => navigate(-1)} className="mt-3">◀ 뒤로</PixelButton>
      </div>
    )
  }

  const isParent  = currentMember.role === 'DAD' || currentMember.role === 'MOM'
  const diffInfo  = DIFFICULTY_INFO[mission.difficulty]
  const dateRange = getDateRange(mission.startDate, mission.endDate)
  const todayKey  = toDateKey(new Date())
  const evals     = mission.slot_evaluations ?? {}
  const multiChild = mission.targetMemberIds.length > 1

  // 현재 선택된 아이의 슬롯
  const activeChildId   = multiChild ? (selectedChild || mission.targetMemberIds[0]) : (mission.targetMemberIds[0] ?? currentMember.id)
  const activeChildSlots: Record<string, DaySlot> = evals[activeChildId] ?? {}

  // G/B/H 누적 (선택된 아이 기준)
  const goodCount = Object.values(activeChildSlots).filter(v => v === 'GOOD').length
  const badCount  = Object.values(activeChildSlots).filter(v => v === 'BAD').length
  const holdCount = Object.values(activeChildSlots).filter(v => v === 'HOLD').length
  const totalEval = dateRange.length

  // ── 아이 확인 ────────────────────────────────────────────────
  const [confirming, setConfirming] = useState(false)
  const handleConfirm = async () => {
    if (confirming) return
    setConfirming(true)
    const { error } = await confirmQuestByChild(familyId, mission.id)
    setConfirming(false)
    if (error) { showToast(error, 'error'); return }
    showToast('✅ 퀘스트를 확인했어요!', 'success')
  }

  // ── 슬롯 평가 ────────────────────────────────────────────────
  const handleSlot = async (dateKey: string, slot: DaySlot) => {
    const key = `${activeChildId}::${dateKey}`
    if (slotLoading) return
    setSlotLoading(key)
    const { error } = await updateDaySlot(familyId, mission.id, activeChildId, dateKey, slot)
    setSlotLoading(null)
    if (error) { showToast(error, 'error'); return }
    showToast(`${getMemberName(activeChildId)} · ${formatDate(dateKey)} ${SLOT_STYLE[slot].icon} ${SLOT_STYLE[slot].label}`, 'success')
  }

  // ── 슬롯 취소 ────────────────────────────────────────────────
  const handleRemoveSlot = async (dateKey: string) => {
    const key = `${activeChildId}::${dateKey}`
    if (slotLoading) return
    setSlotLoading(key)
    const { error } = await removeDaySlot(familyId, mission.id, activeChildId, dateKey, evals)
    setSlotLoading(null)
    if (error) { showToast(error, 'error'); return }
    showToast(`${formatDate(dateKey)} 평가 취소됨`, 'info')
  }

  // ── 종료 처리 ────────────────────────────────────────────────
  const [expiring, setExpiring] = useState(false)
  const handleExpire = async () => {
    if (expiring) return
    setExpiring(true)
    const { error } = await updateMission(familyId, mission.id, { status: 'EXPIRED' } as any)
    setExpiring(false)
    if (error) { showToast(error, 'error'); return }
    showToast('퀘스트를 종료했어요', 'info')
  }

  // ── 삭제 처리 (단일 팝업) ─────────────────────────────────────
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

  const statusInfo = STATUS_LABEL[mission.status] ?? { label: mission.status, color: 'text-stone' }

  return (
    <div className="p-4 space-y-3 pb-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 삭제 확인 팝업 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-xs px-5 py-5 border-4 border-pixel-dark bg-cream text-center">
            <p className="font-korean text-sm font-bold text-pixel-dark mb-1">퀘스트를 삭제할까요?</p>
            <p className="font-korean text-xs text-stone mb-4 leading-snug">"{mission.title}"</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 py-2.5 border-4 border-pixel-dark font-korean text-sm font-bold
                           text-pixel-dark bg-cream active:translate-y-0.5 transition-all disabled:opacity-40">
                취소
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 border-4 border-red-800 font-korean text-sm font-bold
                           text-white bg-rejected active:translate-y-0.5 transition-all disabled:opacity-50">
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 미션 헤더 ── */}
      <PixelCard>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 border-2 border-pixel-dark ${diffInfo.color} flex items-center justify-center flex-shrink-0`}>
            <span className="font-pixel text-[9px] text-white">{mission.difficulty}</span>
          </div>
          <span className="font-korean text-xs text-stone flex-1">{CATEGORY_LABELS[mission.category]}</span>
          <span className={`font-korean text-xs font-bold flex-shrink-0 ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <h1 className="font-korean text-lg font-bold text-pixel-dark">
          {mission.emoji} {mission.title}
        </h1>
        {mission.description && (
          <p className="font-korean text-sm text-stone mt-1">{mission.description}</p>
        )}
      </PixelCard>

      {/* ── 미션 정보 ── */}
      <PixelCard>
        <div className="space-y-2 font-korean text-sm">
          <div className="flex justify-between">
            <span className="text-stone">기간</span>
            <span className="text-pixel-dark text-xs">
              {mission.startDate.toLocaleDateString()} ~ {mission.endDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone">유형</span>
            <span className="text-pixel-dark">
              {mission.type === 'DAILY' ? '일일' : mission.type === 'WEEKLY' ? '주간'
               : mission.type === 'MONTHLY' ? '월간' : '기간'} 미션
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone">난이도</span>
            <span className="text-pixel-dark">{diffInfo.label} (+{diffInfo.exp}점)</span>
          </div>
          <div>
            <span className="text-stone">보상</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {mission.rewards.map((r, i) => (
                <span key={i} className="bg-gold/20 border border-gold px-2 py-0.5 font-korean text-xs text-pixel-dark">
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
              <span className="text-stone">대상</span>
              <span className="text-pixel-dark text-xs">
                {mission.targetMemberIds.map(id =>
                  members.length > 0 ? getMemberName(id) : '...'
                ).join(', ')}
              </span>
            </div>
          )}
        </div>
      </PixelCard>

      {/* ── 아이 전용: 확인 버튼 ── */}
      {!isParent && (
        <PixelCard padding="sm">
          {mission.confirmedByChild ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-xl">✅</span>
              <p className="font-korean text-sm font-bold text-approved">퀘스트 확인 완료!</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-korean text-xs text-stone text-center">
                퀘스트를 확인하면 부모님께 알림이 가요
              </p>
              <button type="button" onClick={handleConfirm} disabled={confirming}
                className="w-full py-3 bg-gold border-4 border-yellow-600 font-korean text-sm font-bold
                           text-pixel-dark hover:bg-yellow-400 active:translate-y-0.5 transition-all
                           disabled:opacity-50">
                {confirming ? '처리 중...' : '✅ 퀘스트 확인하기'}
              </button>
            </div>
          )}
        </PixelCard>
      )}

      {/* ── 부모 전용: Daily Slot 평가 ── */}
      {isParent && (
        <PixelCard padding="sm">
          {/* 아이 선택 탭 (다자녀인 경우) */}
          {multiChild && (
            <div className="flex gap-1 mb-3 border-b border-stone/20 pb-2">
              {mission.targetMemberIds.map(mId => (
                <button key={mId} type="button"
                  onClick={() => setSelectedChild(mId)}
                  className={[
                    'flex-1 py-1.5 font-korean text-xs font-bold border-2 transition-all',
                    activeChildId === mId
                      ? 'bg-purple text-white border-purple'
                      : 'bg-cream text-stone border-stone hover:border-purple',
                  ].join(' ')}>
                  {members.length > 0 ? getMemberName(mId) : mId.slice(0, 6)}
                </button>
              ))}
            </div>
          )}

          {/* G/B/H 누적 카운터 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: '⭐ Good', count: goodCount, cls: 'text-approved border-approved bg-approved/10' },
              { label: '❌ Bad',  count: badCount,  cls: 'text-rejected border-rejected bg-rejected/10' },
              { label: '⏸ Hold', count: holdCount, cls: 'text-hold border-hold bg-hold/10' },
            ].map(item => (
              <div key={item.label} className={`border-2 ${item.cls} text-center py-2`}>
                <p className="font-pixel text-lg font-bold">{item.count}</p>
                <p className="font-korean text-[9px] font-bold">{item.label}</p>
                <p className="font-korean text-[8px] text-stone">{totalEval}일 중</p>
              </div>
            ))}
          </div>

          {/* 날짜 슬롯 (역순) */}
          <p className="font-korean text-xs font-bold text-purple mb-2">날짜별 평가</p>
          <div className="space-y-1.5">
            {[...dateRange].reverse().map(dateKey => {
              const evaluated = activeChildSlots[dateKey] as DaySlot | undefined
              const isFuture  = dateKey > todayKey
              const isLoading = slotLoading === `${activeChildId}::${dateKey}`
              const rowStyle  = evaluated ? SLOT_STYLE[evaluated].rowCls : ''

              return (
                <div key={dateKey}
                  className={`flex items-center gap-2 px-2 py-2 rounded-sm transition-colors ${rowStyle}`}>
                  <span className="font-korean text-xs text-stone w-14 flex-shrink-0 font-bold">
                    {formatDate(dateKey)}
                  </span>

                  {isFuture ? (
                    <span className="font-korean text-[10px] text-stone/50 flex-1">미래</span>
                  ) : evaluated ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`font-korean text-xs font-bold px-2 py-0.5 border-2 ${SLOT_STYLE[evaluated].badgeCls}`}>
                        {SLOT_STYLE[evaluated].icon} {SLOT_STYLE[evaluated].label}
                      </span>
                      <button type="button" onClick={() => handleRemoveSlot(dateKey)}
                        disabled={!!slotLoading}
                        className="font-korean text-[10px] text-stone underline disabled:opacity-40">
                        수정
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 flex-1">
                      {(['GOOD', 'BAD', 'HOLD'] as DaySlot[]).map(slot => (
                        <button key={slot} type="button"
                          onClick={() => handleSlot(dateKey, slot)}
                          disabled={!!slotLoading}
                          className={[
                            'flex-1 py-1.5 border-2 font-korean text-[10px] font-bold',
                            'active:translate-y-0.5 transition-all disabled:opacity-40',
                            SLOT_STYLE[slot].btnCls,
                          ].join(' ')}>
                          {SLOT_STYLE[slot].icon} {isLoading ? '...' : SLOT_STYLE[slot].label}
                        </button>
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
            <button type="button" onClick={handleExpire} disabled={expiring}
              className="flex-1 py-2 bg-stone/20 border-4 border-stone font-korean text-sm
                         font-bold text-pixel-dark active:translate-y-0.5 transition-all disabled:opacity-50">
              ⏹ 종료
            </button>
          )}
          <button type="button" onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 py-2 bg-rejected border-4 border-red-800 font-korean text-sm
                       font-bold text-white active:translate-y-0.5 transition-all">
            🗑️ 삭제
          </button>
        </div>
      )}

      {/* 변경 이력 */}
      {mission.statusHistory.length > 0 && (
        <PixelCard padding="sm">
          <p className="font-korean text-sm font-bold text-purple mb-2">변경 이력</p>
          <div className="space-y-2">
            {mission.statusHistory.slice(0, 5).map((h, i) => {
              const byName = members.find(m => m.id === h.changedBy)?.name ?? h.changedBy.slice(0, 6)
              const timeStr = h.changedAt.toLocaleString('ko-KR', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
              })
              const fromLabel = STATUS_LABEL[h.from as MissionStatus]?.label ?? h.from
              const toLabel   = STATUS_LABEL[h.to as MissionStatus]?.label ?? h.to
              return (
                <div key={i} className="flex items-start gap-2 pb-1.5 border-b border-stone/15 last:border-0">
                  <span className="text-sm flex-shrink-0">🔄</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-korean text-xs font-bold text-pixel-dark">
                      {fromLabel} → {toLabel}
                    </p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="font-korean text-[10px] text-purple">{byName}</span>
                      <span className="font-korean text-[10px] text-stone">{timeStr}</span>
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
