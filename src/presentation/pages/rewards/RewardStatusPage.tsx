// Design Ref: §5.3 SCR-12 RewardStatusPage — 보상 현황 v5 (수동발송 + 경험치 탭, 일별 집계)
import { useState, useMemo } from 'react'
import { useRewards, filterRewardsByYearMonth } from '@/presentation/hooks/useRewards'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function getMembersFromCache(): Array<{ id: string; name: string; realName: string; role: string }> {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return []
    return JSON.parse(raw).members ?? []
  } catch { return [] }
}

function formatDate(date: Date | undefined): string {
  if (!date) return ''
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })
}
function formatTime(date: Date | undefined): string {
  if (!date) return ''
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function dayKey(date: Date | undefined): string {
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

function rewardLabel(r: any): string {
  if (r.rewardType === 'MONEY')      return `💰 ${(r.amount || 0).toLocaleString('ko-KR')}원`
  if (r.rewardType === 'GAME_TIME')  return `🎮 게임시간 ${r.amount}분`
  if (r.rewardType === 'PHONE_TIME') return `📱 핸드폰 ${r.amount}분`
  if (r.rewardType === 'GIFT')       return `🎁 ${r.customLabel || '선물'}`
  if (r.rewardType === 'DINING')     return `🍕 ${r.customLabel || '외식'}`
  return r.customLabel ? `${r.customLabel}` : '특별 보상'
}

function xpSourceLabel(source: string): string {
  if (source === 'xp_question') return '두근두근 질문'
  if (source === 'xp_quest')    return '퀘스트 완료'
  if (source === 'xp_game')     return '게임 1위'
  return '경험치'
}
function xpSourceIcon(source: string): string {
  if (source === 'xp_question') return '💌'
  if (source === 'xp_quest')    return '⚔️'
  if (source === 'xp_game')     return '🏆'
  return '⭐'
}

// 일별 그룹핑
function groupByDay<T extends { approvedAt: Date }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = dayKey(item.approvedAt)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

// ════════════════════════════════════════════════════════════════════
export default function RewardStatusPage() {
  const { rewards, isParent } = useRewards()
  const { currentMember }    = useAuthStore()

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [memberId, setMemberId] = useState<string | null>(null)
  const [tab, setTab] = useState<'manual' | 'xp'>('manual')

  const cacheMembers = useMemo(() => getMembersFromCache(), [])

  if (!currentMember) return null

  const childMembers = useMemo(
    () => cacheMembers.filter(m => m.role === 'CHILD'),
    [cacheMembers]
  )

  const byYearMonth = useMemo(
    () => filterRewardsByYearMonth(rewards, year, month),
    [rewards, year, month]
  )

  const forMember = useMemo(
    () => memberId ? byYearMonth.filter(r => r.memberId === memberId) : byYearMonth,
    [byYearMonth, memberId]
  )

  // 수동 발송만 (XP 제외, 조르기/미션 제외)
  const manualRewards = useMemo(
    () => forMember.filter(r =>
      r.rewardType !== 'XP' &&
      r.source !== 'begging' &&
      r.source !== 'mission'
    ),
    [forMember]
  )

  // 경험치만
  const xpRewards = useMemo(
    () => forMember.filter(r => r.rewardType === 'XP'),
    [forMember]
  )

  const monthMoney = manualRewards
    .filter(r => r.rewardType === 'MONEY')
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  const monthXP = xpRewards
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const manualByDay = useMemo(() => groupByDay(manualRewards as any[]), [manualRewards])
  const xpByDay     = useMemo(() => groupByDay(xpRewards as any[]),     [xpRewards])

  return (
    <div className="p-3 pb-4 space-y-3">

      <h1 className="t-heading text-gold t-pixel-shadow flex items-center gap-2">
        <img src="/assets/icons/trophy.svg" width={20} height={20} style={{ imageRendering: 'pixelated' }} />
        보상 현황
      </h1>

      {/* 아이 탭 (부모) */}
      {isParent && childMembers.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <PixelButton size="sm" variant={memberId === null ? 'gold' : 'ghost'}
            onClick={() => setMemberId(null)}>전체</PixelButton>
          {childMembers.map(m => (
            <PixelButton key={m.id} size="sm"
              variant={memberId === m.id ? 'purple' : 'ghost'}
              onClick={() => setMemberId(m.id)}>
              {m.name}
            </PixelButton>
          ))}
        </div>
      )}

      {/* 연/월 네비 */}
      <div className="flex items-center justify-between card-pixel px-3 py-2">
        <button type="button" onClick={prevMonth}
          className="font-pixel text-gold text-sm active:scale-90 px-2 py-1">◀</button>
        <div className="text-center">
          <p className="font-pixel text-xs text-gold">{year}년 {MONTH_LABELS[month]}</p>
          {isCurrentMonth && <p className="font-korean text-xs text-approved mt-0.5">● 이번 달</p>}
        </div>
        <button type="button" onClick={nextMonth}
          className="font-pixel text-gold text-sm active:scale-90 px-2 py-1">▶</button>
      </div>

      {/* 월 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card-highlight px-3 py-2 text-center">
          <p className="t-micro text-panel-sub">이달 수동 발송</p>
          <p className="t-heading text-gold">
            {monthMoney > 0 ? `💰 ${monthMoney.toLocaleString()}원` : '—'}
          </p>
          <p className="t-micro text-panel-sub mt-0.5">{manualRewards.length}건</p>
        </div>
        <div className="card-highlight px-3 py-2 text-center">
          <p className="t-micro text-panel-sub">이달 획득 XP</p>
          <p className="t-heading text-gold flex items-center justify-center gap-1">
            <img src="/assets/icons/star.svg" width={16} height={16} style={{ imageRendering: 'pixelated' }} />
            {monthXP} XP
          </p>
          <p className="t-micro text-panel-sub mt-0.5">{xpRewards.length}건</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-2 gap-1.5">
        <PixelButton variant={tab === 'manual' ? 'gold' : 'ghost'} size="md"
          onClick={() => setTab('manual')}>수동 발송</PixelButton>
        <PixelButton variant={tab === 'xp' ? 'purple' : 'ghost'} size="md"
          onClick={() => setTab('xp')}>경험치</PixelButton>
      </div>

      {/* ── 수동 발송 탭 ── */}
      {tab === 'manual' && (
        manualByDay.length === 0 ? (
          <div className="card-pixel p-4 text-center">
            <p className="t-sub text-panel-sub">{MONTH_LABELS[month]}에 수동 발송 보상이 없어요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {manualByDay.map(([day, items]) => (
              <div key={day} className="card-pixel p-3 space-y-2">
                {/* 날짜 헤더 */}
                <p className="t-micro font-bold text-gold border-b border-panel-border pb-1">
                  📅 {formatDate((items[0] as any).approvedAt)}
                </p>
                {/* 당일 합계 */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(
                    items.reduce<Record<string, number>>((acc, r: any) => {
                      acc[r.rewardType] = (acc[r.rewardType] ?? 0) + r.amount
                      return acc
                    }, {})
                  ).map(([type, total]) => (
                    <span key={type} className="font-korean text-xs text-gold bg-gold/10 border border-gold/30 px-2 py-0.5">
                      {type === 'MONEY' ? `💰 ${total.toLocaleString()}원`
                       : type === 'GAME_TIME' ? `🎮 ${total}분`
                       : type === 'PHONE_TIME' ? `📱 ${total}분`
                       : `🎁 ${total}건`}
                    </span>
                  ))}
                </div>
                {/* 건별 */}
                {items.map((r: any, i) => (
                  <div key={r.id ?? i} className="flex items-start gap-2 border-t border-panel-border/50 pt-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-korean text-sm text-cream">{rewardLabel(r)}</p>
                    </div>
                    <p className="t-micro text-panel-sub flex-shrink-0">{formatTime(r.approvedAt)}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── 경험치 탭 ── */}
      {tab === 'xp' && (
        xpByDay.length === 0 ? (
          <div className="card-pixel p-4 text-center">
            <p className="t-sub text-panel-sub">{MONTH_LABELS[month]}에 획득한 경험치가 없어요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {xpByDay.map(([day, items]) => {
              const dayTotal = items.reduce((s: number, r: any) => s + (r.amount || 0), 0)
              return (
                <div key={day} className="card-pixel p-3 space-y-2">
                  {/* 날짜 헤더 + 일별 합계 */}
                  <div className="flex items-center justify-between border-b border-panel-border pb-1">
                    <p className="t-micro font-bold text-gold">
                      📅 {formatDate((items[0] as any).approvedAt)}
                    </p>
                    <span className="font-pixel text-xs text-gold flex items-center gap-0.5">
                      <img src="/assets/icons/star.svg" width={12} height={12} style={{ imageRendering: 'pixelated' }} />
                      +{dayTotal} XP
                    </span>
                  </div>
                  {/* 건별 */}
                  {items.map((r: any, i) => (
                    <div key={r.id ?? i} className="flex items-center gap-2 border-t border-panel-border/40 pt-1.5">
                      <span className="text-base flex-shrink-0">{xpSourceIcon(r.source)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-korean text-sm text-cream">{xpSourceLabel(r.source)}</p>
                        {r.customLabel && (
                          <p className="t-micro text-panel-sub truncate">{r.customLabel}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-pixel text-xs text-gold">+{r.amount} XP</p>
                        <p className="t-micro text-panel-sub">{formatTime(r.approvedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
