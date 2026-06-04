// Design Ref: §4.1 Firestore — rewards 컬렉션 (보상 적립 기록)
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsQuery, fsSubscribe, toDate } from '../firestore'
import type { RewardRecord } from '@/domain/entities/Reward'

function col(familyId: string) { return `families/${familyId}/rewards` }

function toRecord(raw: any): RewardRecord {
  return {
    ...raw,
    approvedAt: toDate(raw.approvedAt),
    paidAt: raw.paidAt ? toDate(raw.paidAt) : undefined,
  } as RewardRecord
}

// 구성원 보상 구독
export function subscribeRewards(
  familyId: string,
  memberId: string,
  onData: (records: RewardRecord[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('memberId', '==', memberId), orderBy('approvedAt', 'desc')],
    raw => onData(raw.map(toRecord))
  )
}

// 전체 보상 조회 (부모용)
export async function getAllRewards(
  familyId: string
): Promise<{ data: RewardRecord[]; error: string | null }> {
  const result = await fsQuery<any>(col(familyId), [orderBy('approvedAt', 'desc')])
  if (result.error) return { data: [], error: result.error }
  return { data: result.data.map(toRecord), error: null }
}

// 보상 기록 생성
export async function createRewardRecord(
  familyId: string,
  record: Omit<RewardRecord, 'id'>
): Promise<{ id: string | null; error: string | null }> {
  return fsAdd(col(familyId), record)
}

// 관리자 수동 보상 발송 (missionId 없이)
export async function sendManualReward(
  familyId: string,
  memberId: string,
  approvedBy: string,
  rewardType: string,
  amount: number,
  customLabel?: string
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), {
    missionId: null,
    memberId,
    approvedBy,
    rewardType,
    amount,
    customLabel: customLabel ?? '',
    isPaid: false,
    approvedAt: new Date(),
  })
  return { error }
}

// XP 보상 기록 (경험치 지급 이력 — rewardType='XP', source='xp_*')
export async function recordXPReward(
  familyId: string,
  memberId: string,
  amount: number,
  source: 'xp_question' | 'xp_quest' | 'xp_game',
  customLabel: string,
  approvedBy = 'system'
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), {
    missionId:   null,
    memberId,
    approvedBy,
    rewardType:  'XP',
    amount,
    customLabel,
    isPaid:      true,
    approvedAt:  new Date(),
    source,
  })
  return { error }
}

// 지급 완료 처리
export async function markRewardPaid(
  familyId: string,
  rewardId: string
): Promise<{ error: string | null }> {
  return fsUpdate(`${col(familyId)}/${rewardId}`, {
    isPaid: true,
    paidAt: new Date(),
  })
}
