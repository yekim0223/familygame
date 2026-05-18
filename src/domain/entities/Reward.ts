export interface RewardRecord {
  id: string
  familyId: string
  missionId: string
  memberId: string
  rewardType: string
  amount: number
  approvedBy: string
  approvedAt: Date
  isPaid: boolean
  paidAt?: Date
}
