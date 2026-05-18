// 기념일·생일·특별일 Firestore 컬렉션
import { orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsSubscribe, toDate } from '../firestore'
import { fsQuery } from '../firestore'

export type SpecialDayType = 'birthday' | 'anniversary' | 'holiday' | 'other'

export interface SpecialDayDoc {
  id: string
  name: string       // 표시 이름 (예: "하윤 생일", "결혼기념일")
  type: SpecialDayType
  month: number      // 1~12
  day: number        // 1~31
  isLunar: boolean   // 음력 여부
  emoji: string      // 표시 이모지
  createdAt: Date
}

export const SPECIAL_DAY_TYPE_LABELS: Record<SpecialDayType, string> = {
  birthday:    '🎂 생일',
  anniversary: '💑 기념일',
  holiday:     '✈️ 여행',
  other:       '📅 기타',
}

// 2줄 × 8개 = 16개 — 생일·기념일·여행 관련 이모지
export const SPECIAL_DAY_EMOJIS: string[] = [
  // 1행: 생일·축하
  '🎂','🎁','🎉','🎈','🥳','🍰','💝','🎀',
  // 2행: 여행·기념·자연
  '✈️','🏖️','🗺️','💑','🌸','⭐','🏆','🌟',
]

function col(familyId: string) {
  return `families/${familyId}/special_days`
}

function toDoc(raw: any): SpecialDayDoc {
  return {
    ...raw,
    createdAt: toDate(raw.createdAt),
  } as SpecialDayDoc
}

// 실시간 구독
export function subscribeSpecialDays(
  familyId: string,
  cb: (days: SpecialDayDoc[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [orderBy('month', 'asc'), orderBy('day', 'asc')],
    docs => cb(docs.map(toDoc)),
    () => cb([])
  )
}

// 추가
export async function addSpecialDay(
  familyId: string,
  data: Omit<SpecialDayDoc, 'id' | 'createdAt'>
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), data)
  return { error }
}

// 삭제 (soft: isActive=false 대신 fsUpdate로 표시)
export async function removeSpecialDay(
  familyId: string,
  id: string
): Promise<{ error: string | null }> {
  return fsUpdate(`${col(familyId)}/${id}`, { deleted: true })
}

// 일회성 조회 (CalendarPage 초기 로드용)
export async function getSpecialDays(familyId: string): Promise<SpecialDayDoc[]> {
  const { data } = await fsQuery<any>(col(familyId), [orderBy('month', 'asc'), orderBy('day', 'asc')])
  return data.filter((d: any) => !d.deleted).map(toDoc)
}
