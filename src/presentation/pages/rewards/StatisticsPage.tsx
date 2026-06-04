// Design Ref: §5.3 SCR-14 StatisticsPage — 통계 (부모 전용)
import { useRewards, filterRewardsByYearMonth } from '@/presentation/hooks/useRewards'
import { useMissions } from '@/presentation/hooks/useMissions'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { PixelBarChart } from '@/presentation/components/charts/PixelBarChart'

function getLast6Months(): { year: number; month: number; label: string }[] {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ year: d.getFullYear(), month: d.getMonth(), label: `${d.getMonth() + 1}월` })
  }
  return result
}

export default function StatisticsPage() {
  const { rewards } = useRewards()
  const { missions } = useMissions()
  const { currentMember } = useAuthStore()
  const now = new Date()
  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  if (!isParent) {
    return <div className="p-4"><p className="font-korean text-sm text-panel-sub text-center">부모만 볼 수 있어요</p></div>
  }

  const thisMonthRewards = filterRewardsByYearMonth(rewards, now.getFullYear(), now.getMonth())
  const totalMoney = thisMonthRewards.filter(r => r.rewardType === 'MONEY').reduce((s, r) => s + r.amount, 0)
  const totalGame  = thisMonthRewards.filter(r => r.rewardType === 'GAME_TIME').reduce((s, r) => s + r.amount, 0)
  const thisMonthMissions = missions.filter(m => {
    const d = m.createdAt
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const approvedCount = thisMonthMissions.filter(m => m.status === 'APPROVED').length

  const last6 = getLast6Months()
  const trendData = last6.map(({ year, month, label }) => ({
    label,
    value: filterRewardsByYearMonth(rewards, year, month)
             .filter(r => r.rewardType === 'MONEY')
             .reduce((s, r) => s + r.amount, 0),
    color: '#7B5EA7',
  }))

  const approvalRate = thisMonthMissions.length > 0
    ? Math.round((approvedCount / thisMonthMissions.length) * 100)
    : 0

  return (
    <div className="p-3 pb-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">📊</span>
        <h1 className="t-sub font-bold text-gold t-pixel-shadow">통계</h1>
      </div>

      {/* 이번 달 요약 */}
      <div className="card-pixel p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📋</span>
          <p className="t-sub font-bold text-gold t-pixel-shadow">이번 달 요약</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-korean text-xl">📋</p>
            <p className="font-pixel text-xs text-gold">{thisMonthMissions.length}</p>
            <p className="font-korean text-xs text-panel-sub">총 미션</p>
          </div>
          <div>
            <p className="font-korean text-xl">✅</p>
            <p className="font-pixel text-xs text-gold">{approvedCount}</p>
            <p className="font-korean text-xs text-panel-sub">승인됨</p>
          </div>
          <div>
            <p className="font-korean text-xl">💰</p>
            <p className="font-pixel text-xs text-gold">{totalMoney.toLocaleString()}원</p>
            <p className="font-korean text-xs text-panel-sub">용돈</p>
          </div>
        </div>
      </div>

      {/* 미션 달성률 */}
      <div className="card-pixel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <p className="t-sub font-bold text-gold t-pixel-shadow">미션 달성률</p>
          </div>
          <span className="font-pixel text-xs text-gold">{approvalRate}%</span>
        </div>
        <div className="exp-bar">
          <div className="exp-bar-fill" style={{ width: `${approvalRate}%` }} />
        </div>
        <p className="font-korean text-xs text-panel-sub mt-1">
          이번 달 {approvedCount}/{thisMonthMissions.length}개 승인
        </p>
      </div>

      {/* 6개월 보상 트렌드 */}
      <div className="card-pixel p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📈</span>
          <p className="t-sub font-bold text-gold t-pixel-shadow">최근 6개월 용돈 트렌드</p>
        </div>
        <PixelBarChart data={trendData} unit="원" height={100} />
      </div>

      {/* 게임시간 통계 */}
      <div className="card-pixel p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🎮</span>
          <p className="t-sub font-bold text-gold t-pixel-shadow">이번 달 게임시간</p>
        </div>
        <p className="font-korean text-2xl text-cream font-bold">{totalGame}분</p>
        <p className="font-korean text-xs text-panel-sub">{Math.floor(totalGame / 60)}시간 {totalGame % 60}분</p>
      </div>
    </div>
  )
}
