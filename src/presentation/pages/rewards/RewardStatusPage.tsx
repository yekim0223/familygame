// Design Ref: §5.3 SCR-12 RewardStatusPage — 보상 현황 (v4.0 슬림화)
import { useState, useMemo } from 'react'
import { useRewards, filterRewardsByYearMonth } from '@/presentation/hooks/useRewards'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'

const REWARD_ICONS: Record<string, string> = {
  MONEY: '💰', GAME_TIME: '🎮', PHONE_TIME: '📱',
  GIFT: '🎁', DINING: '🍕', CUSTOM: '⭐',
}

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function getMembersFromCache(): Array<{ id: string; name: string; realName: string; role: string }> {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return []
    return JSON.parse(raw).members ?? []
  } catch { return [] }
}

function getDisplayName(memberId: string, cache: ReturnType<typeof getMembersFromCache>): string {
  const m = cache.find(m => m.id === memberId)
  if (!m) return ''
  return m.name !== m.realName ? `${m.name} (${m.realName})` : m.name
}

function formatDateTime(date: Date | undefined): string {
  if (!date) return ''
  return date.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function rewardLabel(r: any): string {
  if (r.rewardType === 'MONEY')      return `💰 ${(r.amount || 0).toLocaleString('ko-KR')}원`
  if (r.rewardType === 'GAME_TIME')  return `🎮 게임시간 ${r.amount}분`
  if (r.rewardType === 'PHONE_TIME') return `📱 핸드폰 ${r.amount}분`
  if (r.rewardType === 'GIFT')       return `🎁 ${r.customLabel || '선물'}`
  if (r.rewardType === 'DINING')     return `🍕 ${r.customLabel || '외식'}`
  return r.customLabel ? `⭐ ${r.customLabel}` : '⭐ 특별 보상'
}

function sourceBadge(r: any, mission: any) {
  if (mission?.title) return null
  if (r.source === 'begging' || (r.customLabel as string)?.startsWith('[조르기]'))
    return <span className="font-korean text-xs text-sky border border-sky px-1">🙏 조르기 승인</span>
  return <span className="font-korean text-xs text-hold border border-hold px-1">🎁 수동 발송</span>
}

// ── 상세 모달 ──────────────────────────────────────────────────────
function DetailModal({ reward, mission, cache, onClose }: {
  reward: any; mission: any; cache: ReturnType<typeof getMembersFromCache>; onClose: () => void
}) {
  const approverName  = getDisplayName(reward.approvedBy, cache)
  const performerName = getDisplayName(reward.memberId, cache)
  const submittedAt   = mission?.statusHistory?.find((h: any) => h.to === 'PENDING_APPROVAL')?.changedAt

  return (
    <PixelModal title="📋 보상 상세" onClose={onClose}>
      <div className="space-y-3 pb-2">
        {/* 보상 내용 */}
        <div className="card-pixel p-3 text-center">
          <p className="text-3xl mb-1">{REWARD_ICONS[reward.rewardType] ?? '⭐'}</p>
          <p className="t-heading text-gold">{rewardLabel(reward)}</p>
          {mission?.title && (
            <p className="font-korean text-sm text-cream mt-1">📜 {mission.title}</p>
          )}
          {sourceBadge(reward, mission) && (
            <div className="flex justify-center mt-1">{sourceBadge(reward, mission)}</div>
          )}
        </div>
        {/* 메타 */}
        <div className="space-y-1.5">
          {approverName  && <p className="t-micro text-panel-sub">📋 등록: <span className="text-cream">{approverName}</span></p>}
          {performerName && <p className="t-micro text-panel-sub">⚔️ 수행: <span className="text-cream">{performerName}</span></p>}
          {submittedAt   && <p className="t-micro text-panel-sub">📩 접수: <span className="text-cream">{formatDateTime(submittedAt)}</span></p>}
          <p className="t-micro text-panel-sub">✅ 승인: <span className="text-cream">{formatDateTime(reward.approvedAt)}</span></p>
        </div>
        <PixelButton variant="ghost" fullWidth onClick={onClose}>닫기</PixelButton>
      </div>
    </PixelModal>
  )
}

// ════════════════════════════════════════════════════════════════════
export default function RewardStatusPage() {
  const { rewards, isParent } = useRewards()
  const { currentMember }    = useAuthStore()
  const { getMissionById }   = useMissionStore()

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())   // 0-based
  const [memberId, setMemberId] = useState<string | null>(null)
  const [detail, setDetail]     = useState<any | null>(null)

  const cacheMembers = useMemo(() => getMembersFromCache(), [])

  if (!currentMember) return null

  // 아이 멤버 목록 (부모 전용 탭)
  const childMembers = useMemo(
    () => cacheMembers.filter(m => m.role === 'CHILD'),
    [cacheMembers]
  )

  const byYearMonth = useMemo(
    () => filterRewardsByYearMonth(rewards, year, month),
    [rewards, year, month]
  )

  const filtered = useMemo(
    () => memberId ? byYearMonth.filter(r => r.memberId === memberId) : byYearMonth,
    [byYearMonth, memberId]
  )

  const totals = useMemo(
    () => filtered.reduce<Record<string, number>>((acc, r) => {
      acc[r.rewardType] = (acc[r.rewardType] ?? 0) + r.amount
      return acc
    }, {}),
    [filtered]
  )

  const monthTotal = filtered
    .filter(r => r.rewardType === 'MONEY')
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  // ── 연/월 네비게이션 ─────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* 상단 타이틀 */}
      <h1 className="t-heading text-gold t-pixel-shadow">🏆 보상 현황</h1>

      {/* 아이 멤버 탭 (부모 전용) */}
      {isParent && childMembers.length > 0 && (
        <div className="flex gap-1.5">
          <PixelButton size="sm"
            variant={memberId === null ? 'gold' : 'ghost'}
            onClick={() => setMemberId(null)}>
            전체
          </PixelButton>
          {childMembers.map(m => (
            <PixelButton key={m.id} size="sm"
              variant={memberId === m.id ? 'purple' : 'ghost'}
              onClick={() => setMemberId(m.id)}>
              {m.name}
            </PixelButton>
          ))}
        </div>
      )}

      {/* ◀ 연/월 ▶ 미니 패널 */}
      <div className="flex items-center justify-between card-pixel px-3 py-2">
        <button type="button" onClick={prevMonth}
          className="font-pixel text-gold text-sm active:scale-90 transition-transform px-2 py-1">
          ◀
        </button>
        <div className="text-center">
          <p className="font-pixel text-xs text-gold">{year}년 {MONTH_LABELS[month]}</p>
          {isCurrentMonth && (
            <p className="font-korean text-xs text-approved mt-0.5">● 이번 달</p>
          )}
        </div>
        <button type="button" onClick={nextMonth}
          className="font-pixel text-gold text-sm active:scale-90 transition-transform px-2 py-1">
          ▶
        </button>
      </div>

      {/* 당월 총합 */}
      {filtered.length > 0 && (
        <div className="card-highlight px-4 py-3 flex items-center justify-between">
          <p className="t-sub font-bold text-cream">{MONTH_LABELS[month]} 총합</p>
          <div className="text-right">
            {monthTotal > 0 && (
              <p className="t-heading text-gold">💰{monthTotal.toLocaleString('ko-KR')}원</p>
            )}
            <p className="t-micro text-panel-sub">{filtered.length}건 보상</p>
          </div>
        </div>
      )}

      {/* 보상 종류별 합계 */}
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(totals).map(([type, amount]) => (
            <div key={type}
              className="card-pixel flex flex-col items-center justify-center px-2 py-1.5 min-w-[56px]">
              <span className="text-base leading-none">{REWARD_ICONS[type] ?? '⭐'}</span>
              <span className="t-micro text-gold font-bold mt-0.5">
                {type === 'MONEY'
                  ? `${amount.toLocaleString()}원`
                  : type === 'GAME_TIME' || type === 'PHONE_TIME'
                  ? `${amount}분`
                  : `${amount}개`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 보상 목록 — 탭하면 상세 모달 */}
      {filtered.length === 0 ? (
        <div className="card-pixel p-4 text-center">
          <p className="t-sub text-panel-sub">
            {year}년 {MONTH_LABELS[month]}에 받은 보상이 없어요
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(r => {
            const mission = getMissionById(r.missionId)
            return (
              <button
                key={r.id}
                type="button"
                className="card-pixel p-3 w-full text-left active:opacity-70 transition-opacity"
                onClick={() => setDetail({ reward: r, mission })}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg flex-shrink-0">
                    {REWARD_ICONS[r.rewardType] ?? '⭐'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="t-body font-bold text-cream truncate">{rewardLabel(r)}</p>
                    {mission?.title
                      ? <p className="t-micro text-panel-sub truncate">📜 {mission.title}</p>
                      : <p className="t-micro text-panel-sub">
                          {r.source === 'begging' ? '🙏 조르기 승인' : '🎁 수동 발송'}
                        </p>
                    }
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="t-micro text-panel-sub">{formatDateTime(r.approvedAt).slice(5, 16)}</p>
                    <p className="font-pixel text-[9px] text-gold/60 mt-0.5">▶ 상세</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 상세 모달 */}
      {detail && (
        <DetailModal
          reward={detail.reward}
          mission={detail.mission}
          cache={cacheMembers}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
