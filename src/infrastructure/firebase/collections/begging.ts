// Design Ref: §3-5 조르기 시스템 — Firestore CRUD
// Plan FR-14: 주 1회 제한, 레벨 5마다 +1회, 부모 양쪽 승인
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsQuery, fsSubscribe, toDate } from '../firestore'

export type BeggingType = 'MISSION_ADD' | 'REWARD_UP' | 'GIFT' | 'SPECIAL'
export type BeggingStatus = 'PENDING' | 'DAD_APPROVED' | 'MOM_APPROVED' | 'APPROVED' | 'REJECTED'

export interface BeggingRequest {
  id: string
  familyId: string
  submitterId: string       // CHILD ID
  type: BeggingType
  content: string
  status: BeggingStatus
  dadApproved: boolean
  momApproved: boolean
  rejectedBy?: string
  createdAt: Date
  updatedAt: Date
}

export const BEGGING_TYPE_LABELS: Record<BeggingType, string> = {
  MISSION_ADD: '⚔️ 미션 추가 요청',
  REWARD_UP:   '💰 보상 증액 요청',
  GIFT:        '🎁 선물 요청',
  SPECIAL:     '⭐ 특별 요청',
}

function col(familyId: string) { return `families/${familyId}/begging` }

function toBegging(raw: any): BeggingRequest {
  return {
    ...raw,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt ?? raw.createdAt),
  } as BeggingRequest
}

// 내 조르기 요청 구독 (아이)
export function subscribeMyBegging(
  familyId: string,
  submitterId: string,
  onData: (items: BeggingRequest[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('submitterId', '==', submitterId), orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toBegging))
  )
}

// 전체 조르기 목록 구독 (부모)
export function subscribeAllBegging(
  familyId: string,
  onData: (items: BeggingRequest[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toBegging))
  )
}

// 조르기 요청 생성
export async function createBeggingRequest(
  familyId: string,
  submitterId: string,
  type: BeggingType,
  content: string
): Promise<{ id: string | null; error: string | null }> {
  return fsAdd(col(familyId), {
    familyId,
    submitterId,
    type,
    content,
    status: 'PENDING',
    dadApproved: false,
    momApproved: false,
  })
}

// 부모 승인/거절
export async function reviewBegging(
  familyId: string,
  beggingId: string,
  reviewerRole: 'DAD' | 'MOM',
  action: 'APPROVE' | 'REJECT',
  current: BeggingRequest
): Promise<{ error: string | null }> {
  const isDad = reviewerRole === 'DAD'

  if (action === 'REJECT') {
    return fsUpdate(`${col(familyId)}/${beggingId}`, {
      status: 'REJECTED',
      rejectedBy: reviewerRole,
    })
  }

  const newDadApproved = isDad ? true : current.dadApproved
  const newMomApproved = !isDad ? true : current.momApproved

  // 양쪽 모두 승인 시 → APPROVED
  const newStatus: BeggingStatus = (newDadApproved && newMomApproved)
    ? 'APPROVED'
    : isDad ? 'DAD_APPROVED' : 'MOM_APPROVED'

  return fsUpdate(`${col(familyId)}/${beggingId}`, {
    dadApproved: newDadApproved,
    momApproved: newMomApproved,
    status: newStatus,
  })
}
