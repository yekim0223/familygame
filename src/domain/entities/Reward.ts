export interface RewardRecord {
  id: string
  familyId: string
  missionId: string | null   // null = 수동발송/조르기/질문함
  memberId: string
  rewardType: string
  amount: number
  customLabel?: string       // 선물/외식/기타 라벨
  approvedBy: string
  approvedAt: Date
  isPaid: boolean
  paidAt?: Date
  source?: 'mission' | 'manual' | 'begging' | 'question' | 'xp_question' | 'xp_quest' | 'xp_game'
}
