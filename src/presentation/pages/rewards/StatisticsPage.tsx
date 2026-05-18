// Design Ref: §5.3 SCR-14 StatisticsPage — 통계 (부모 전용)
// Plan UI Checklist: 이번 달 요약, 레벨 현황, 미션 달성률, 6개월 트렌드, 경쟁 현황
import { useMemo } from 'react'
import { useRewards, filterRewardsByYearMonth } from '@/presentation/hooks/useRewards'
import { useMissions } from '@/presentation/hooks/useMissions'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { PixelBarChart } from '@/presentation/components/charts/PixelBarChart'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'

// 6개월 월 이름
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
    return <div className="p-4"><p className="font-korean text-stone text-center">부모만 볼 수 있어요</p></div>
  }

  // 이번 달 요약
  const thisMonthRewards = filterRewardsByYearMonth(rewards, now.getFullYear(), now.getMonth())
  const totalMoney = thisMonthRewards.filter(r => r.rewardType === 'MONEY').reduce((s, r) => s + r.amount, 0)
  const totalGame = thisMonthRewards.filter(r => r.rewardType === 'GAME_TIME').reduce((s, r) => s + r.amount, 0)
  const thisMonthMissions = missions.filter(m => {
    const d = m.createdAt
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const approvedCount = thisMonthMissions.filter(m => m.status === 'APPROVED').length

  // 6개월 보상 트렌드 (용돈)
  const last6 = getLast6Months()
  const trendData = last6.map(({ year, month, label }) => ({
    label,
    value: filterRewardsByYearMonth(rewards, year, month)
             .filter(r => r.rewardType === 'MONEY')
             .reduce((s, r) => s + r.amount, 0),
    color: '#7B5EA7',
  }))

  // 미션 달성률
  const approvalRate = thisMonthMissions.length > 0
    ? Math.round((approvedCount / thisMonthMissions.length) * 100)
    : 0

  return (
    <div className="p-3 pb-4 space-y-3">
      <h1 className="font-pixel text-[9px] text-gold">📊 통계</h1>

      {/* 이번 달 요약 */}
      <PixelCard padding="sm">
        <p className="font-pixel text-[8px] text-purple mb-2">이번 달 요약</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-korean text-xl">📋</p>
            <p className="font-pixel text-[8px] text-pixel-dark">{thisMonthMissions.length}</p>
            <p className="font-korean text-[9px] text-stone">총 미션</p>
          </div>
          <div>
            <p className="font-korean text-xl">✅</p>
            <p className="font-pixel text-[8px] text-pixel-dark">{approvedCount}</p>
            <p className="font-korean text-[9px] text-stone">승인됨</p>
          </div>
          <div>
            <p className="font-korean text-xl">💰</p>
            <p className="font-pixel text-[8px] text-pixel-dark">{totalMoney.toLocaleString()}원</p>
            <p className="font-korean text-[9px] text-stone">용돈</p>
          </div>
        </div>
      </PixelCard>

      {/* 미션 달성률 */}
      <PixelCard padding="sm">
        <div className="flex items-center justify-between mb-1">
          <p className="font-pixel text-[8px] text-purple">미션 달성률</p>
          <span className="font-pixel text-[8px] text-gold">{approvalRate}%</span>
        </div>
        <div className="exp-bar">
          <div className="exp-bar-fill" style={{ width: `${approvalRate}%` }} />
        </div>
        <p className="font-korean text-[10px] text-stone mt-1">
          이번 달 {approvedCount}/{thisMonthMissions.length}개 승인
        </p>
      </PixelCard>

      {/* 6개월 보상 트렌드 */}
      <PixelCard padding="sm">
        <p className="font-pixel text-[8px] text-purple mb-3">📈 최근 6개월 용돈 트렌드</p>
        <PixelBarChart data={trendData} unit="원" height={100} />
      </PixelCard>

      {/* 게임시간 통계 */}
      <PixelCard padding="sm">
        <p className="font-pixel text-[8px] text-purple mb-2">🎮 이번 달 게임시간</p>
        <p className="font-korean text-xl text-pixel-dark">{totalGame}분</p>
        <p className="font-korean text-xs text-stone">{Math.floor(totalGame / 60)}시간 {totalGame % 60}분</p>
      </PixelCard>
    </div>
  )
}
