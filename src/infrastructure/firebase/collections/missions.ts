// Design Ref: §4.1 Firestore — missions 컬렉션 CRUD + 구독
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsGet, fsUpdate, fsQuery, fsSubscribe, fsDelete, toDate } from '../firestore'
import type { Mission, MissionStatus, DaySlot } from '@/domain/entities/Mission'

function col(familyId: string) { return `families/${familyId}/missions` }
function doc(familyId: string, missionId: string) { return `families/${familyId}/missions/${missionId}` }

function toMission(raw: any): Mission {
  return {
    ...raw,
    startDate:  toDate(raw.startDate),
    endDate:    toDate(raw.endDate),
    createdAt:  toDate(raw.createdAt),
    statusHistory: (raw.statusHistory ?? []).map((h: any) => ({
      ...h,
      changedAt: toDate(h.changedAt),
    })),
  } as Mission
}

// 가족 전체 미션 구독 (미션 목록)
export function subscribeMissions(
  familyId: string,
  onData: (missions: Mission[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toMission))
  )
}

// 특정 구성원의 미션 구독
export function subscribeMemberMissions(
  familyId: string,
  memberId: string,
  onData: (missions: Mission[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('targetMemberIds', 'array-contains', memberId), orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toMission))
  )
}

// 승인 대기 미션 구독 — 부모 공유: 생성자 무관하게 전체 PENDING 구독
export function subscribePendingMissions(
  familyId: string,
  onData: (missions: Mission[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('status', '==', 'PENDING_APPROVAL')],
    raw => onData(raw.map(toMission))
  )
}

// 미션 단건 조회 (최신 상태 확인용 — 서버 검증에 사용)
export async function getMission(
  familyId: string,
  missionId: string
): Promise<{ data: Mission | null; error: string | null }> {
  const { data, error } = await fsGet<any>(doc(familyId, missionId))
  if (!data) return { data: null, error }
  return { data: toMission(data), error: null }
}

// 미션 생성
export async function createMission(
  familyId: string,
  mission: Omit<Mission, 'id' | 'createdAt'>
): Promise<{ id: string | null; error: string | null }> {
  return fsAdd(col(familyId), mission)
}

// 미션 상태 업데이트
export async function updateMissionStatus(
  familyId: string,
  missionId: string,
  status: MissionStatus,
  changedBy: string,
  note?: string
): Promise<{ error: string | null }> {
  const now = new Date()
  return fsUpdate(doc(familyId, missionId), {
    status,
    [`statusHistory`]: [], // Firestore arrayUnion으로 추가 권장 (단순화)
    ...(status === 'PENDING_APPROVAL' ? { completedBy: changedBy } : {}),
  })
}

// 미션 즐겨찾기 토글
export async function toggleMissionFavorite(
  familyId: string,
  missionId: string,
  isFavorite: boolean
): Promise<{ error: string | null }> {
  return fsUpdate(doc(familyId, missionId), { isFavorite })
}

// 미션 수정
export async function updateMission(
  familyId: string,
  missionId: string,
  data: Partial<Mission>
): Promise<{ error: string | null }> {
  return fsUpdate(doc(familyId, missionId), data as any)
}

// Daily Slot 평가 — 아이별 날짜 G/B/H 기록
export async function updateDaySlot(
  familyId: string,
  missionId: string,
  memberId: string,
  dateKey: string,
  slot: DaySlot,
): Promise<{ error: string | null }> {
  return fsUpdate(doc(familyId, missionId), {
    [`slot_evaluations.${memberId}.${dateKey}`]: slot,
  })
}

// Daily Slot 취소 — 특정 날짜 평가 삭제
export async function removeDaySlot(
  familyId: string,
  missionId: string,
  memberId: string,
  dateKey: string,
  currentEvals: Record<string, Record<string, DaySlot>>
): Promise<{ error: string | null }> {
  const memberSlots = { ...(currentEvals[memberId] ?? {}) }
  delete memberSlots[dateKey]
  return fsUpdate(doc(familyId, missionId), {
    [`slot_evaluations.${memberId}`]: memberSlots,
  })
}

// 아이 확인 표시
export async function confirmQuestByChild(
  familyId: string,
  missionId: string
): Promise<{ error: string | null }> {
  return fsUpdate(doc(familyId, missionId), { confirmedByChild: true })
}

// 미션 삭제
export async function deleteMission(
  familyId: string,
  missionId: string
): Promise<{ error: string | null }> {
  return fsDelete(doc(familyId, missionId))
}
