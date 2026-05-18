// Design Ref: §2.3 Application — 보상 적립 + EXP 적립 유스케이스
// Plan SC: SC-07 미션 승인 시 보상 즉시 적립 + 레벨 EXP 동시 적립
import { createRewardRecord } from '@/infrastructure/firebase/collections/rewards'
import { updateMember } from '@/infrastructure/firebase/collections/members'
import { getLevelFromExp } from '@/domain/services/ExpCalc'
import type { Reward } from '@/domain/entities/Mission'
import type { Member } from '@/domain/entities/Member'

interface GrantRewardInput {
  familyId: string
  missionId: string
  member: Member
  rewards: Reward[]
  expGain: number      // mission.difficulty × 1점
  approvedBy: string
}

interface GrantRewardResult {
  leveledUp: boolean
  newLevel: number
  error: string | null
}

export async function grantReward(input: GrantRewardInput): Promise<GrantRewardResult> {
  const { familyId, missionId, member, rewards, expGain, approvedBy } = input

  // 1. 보상 기록 생성 (각 보상 종류별)
  for (const reward of rewards) {
    const { error } = await createRewardRecord(familyId, {
      missionId,
      memberId: member.id,
      rewardType: reward.type,
      amount: reward.amount,
      approvedBy,
      approvedAt: new Date(),
      isPaid: false,
      ...(reward.customLabel ? { customLabel: reward.customLabel } : {}),
    } as any)
    if (error) return { leveledUp: false, newLevel: member.level, error }
  }

  // 2. EXP 적립 + 레벨 계산
  const oldLevel = member.level
  const newExp = member.exp + expGain
  const newLevel = getLevelFromExp(newExp)
  const leveledUp = newLevel > oldLevel

  const { error: updateError } = await updateMember(familyId, member.id, {
    exp: newExp,
    level: newLevel,
  })
  if (updateError) return { leveledUp: false, newLevel: oldLevel, error: updateError }

  return { leveledUp, newLevel, error: null }
}
