// Design Ref: §3-15 통계 & 정산 — 보상 구독 훅
import { useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useRewardStore } from '@/infrastructure/stores/rewardStore'
import { subscribeRewards, getAllRewards } from '@/infrastructure/firebase/collections/rewards'
import type { RewardRecord } from '@/domain/entities/Reward'

// 아이: 본인 보상만 / 부모: 전체 (getAllRewards)
export function useRewards() {
  const { familyId, currentMember } = useAuthStore()
  const { rewards, setRewards } = useRewardStore()
  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  useEffect(() => {
    if (!familyId || !currentMember) return
    if (isParent) {
      // 부모: 전체 보상 1회 로드 (실시간 대신 수동 갱신)
      getAllRewards(familyId).then(({ data }) => data && setRewards(data))
      return
    }
    const unsub = subscribeRewards(familyId, currentMember.id, setRewards)
    return unsub
  }, [familyId, currentMember?.id])

  return { rewards, isParent }
}

// 연도·월 필터 헬퍼
export function filterRewardsByYearMonth(
  rewards: RewardRecord[], year: number, month?: number
): RewardRecord[] {
  return rewards.filter(r => {
    const d = r.approvedAt
    if (d.getFullYear() !== year) return false
    if (month !== undefined && d.getMonth() !== month) return false
    return true
  })
}

// 이번 달 보상 합계
export function calcMonthlyTotal(rewards: RewardRecord[]): { money: number; gameTime: number } {
  const now = new Date()
  const thisMonth = filterRewardsByYearMonth(rewards, now.getFullYear(), now.getMonth())
  return {
    money:    thisMonth.filter(r => r.rewardType === 'MONEY').reduce((s, r) => s + r.amount, 0),
    gameTime: thisMonth.filter(r => r.rewardType === 'GAME_TIME').reduce((s, r) => s + r.amount, 0),
  }
}
