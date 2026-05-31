// Design Ref: §3 Domain Entities — Mission 타입 정의
export type MissionType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
export type MissionStatus =
  | 'ACTIVE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ON_HOLD'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CHILD_REJECTED'
export type DaySlot = 'GOOD' | 'BAD' | 'HOLD'
export type Difficulty = 1 | 2 | 3 | 4 | 5
export type MissionCategory =
  | 'STUDY' | 'TUTORING' | 'CLEANING' | 'MEAL'
  | 'HOMEWORK' | 'EXERCISE' | 'READING'
  | 'BEHAVIOR' | 'CREATIVE' | 'ETC'

export type RewardType =
  | 'MONEY' | 'GAME_TIME' | 'PHONE_TIME'
  | 'GIFT' | 'DINING' | 'CUSTOM'

export interface Reward {
  type: RewardType
  amount: number
  customLabel?: string        // CUSTOM 타입일 때 라벨
}

export interface StatusChange {
  from: MissionStatus
  to: MissionStatus
  changedBy: string
  changedAt: Date
  note?: string
}

export interface Mission {
  id: string
  familyId: string
  title: string
  description?: string
  category: MissionCategory
  type: MissionType
  difficulty: Difficulty
  targetMemberIds: string[]
  creatorId: string
  rewards: Reward[]
  status: MissionStatus                           // 대표 상태 (하위호환)
  completedBy?: string                            // 대표 완료자 (하위호환)
  memberStatuses?: Record<string, MissionStatus>
  childAccepted?: Record<string, boolean>
  status_by_date?: Record<string, DaySlot>         // (레거시) 단일 아이 날짜 평가
  slot_evaluations?: Record<string, Record<string, DaySlot>>  // 아이별 날짜 평가 { memberId: { 'YYYY-MM-DD': slot } }
  confirmedByChild?: boolean                        // 아이가 퀘스트 수신 확인 여부
  emoji?: string
  isSpecial?: boolean                               // 특별 퀘스트 여부
  isFavorite: boolean
  repeatEnabled: boolean
  startDate: Date
  endDate: Date
  statusHistory: StatusChange[]
  createdAt: Date
}

// 카테고리 한글 레이블 맵
export const CATEGORY_LABELS: Record<MissionCategory, string> = {
  STUDY: '📚 공부',
  TUTORING: '🏫 학원',
  CLEANING: '🧹 청소',
  MEAL: '🍽️ 식사',
  HOMEWORK: '✏️ 숙제',
  EXERCISE: '💪 운동',
  READING: '📖 독서',
  BEHAVIOR: '😊 행동고치기',
  CREATIVE: '🎨 창작',
  ETC: '⭐ 기타',
}

// 난이도 한글 레이블 및 EXP
export const STATUS_LABEL: Record<MissionStatus, { label: string; color: string }> = {
  ACTIVE:           { label: '진행중',   color: 'text-approved' },
  PENDING_APPROVAL: { label: '완료신청', color: 'text-sky' },
  ON_HOLD:          { label: '보류중',   color: 'text-hold' },
  APPROVED:         { label: '승인됨',   color: 'text-purple' },
  REJECTED:         { label: '미승인',   color: 'text-rejected' },
  EXPIRED:          { label: '소멸됨',   color: 'text-stone' },
  CHILD_REJECTED:   { label: '거절됨',   color: 'text-rejected' },
}

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; exp: number; color: string }> = {
  1: { label: '아주 쉬움', exp: 10, color: 'bg-sky' },
  2: { label: '쉬움',     exp: 20, color: 'bg-approved' },
  3: { label: '보통',     exp: 30, color: 'bg-gold' },
  4: { label: '높음',     exp: 40, color: 'bg-hold' },
  5: { label: '매우 높음', exp: 50, color: 'bg-rejected' },
}
