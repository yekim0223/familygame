// Design Ref: §2.3 Application — 미션 생성 유스케이스
// Plan SC: FR-04 미션 생성 (제목·카테고리·유형·난이도·대상·보상·반복 설정)
import { createMission as dbCreate } from '@/infrastructure/firebase/collections/missions'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import type { Mission, MissionType, MissionCategory, Difficulty, Reward } from '@/domain/entities/Mission'

interface CreateMissionInput {
  familyId: string
  creatorId: string
  title: string
  description?: string
  category: MissionCategory
  type: MissionType
  difficulty: Difficulty
  targetMemberIds: string[]
  rewards: Reward[]
  emoji?: string
  repeatEnabled: boolean
  startDate: Date
  endDate: Date
}

export async function createMission(input: CreateMissionInput): Promise<{ id: string | null; error: string | null }> {
  const mission: Omit<Mission, 'id' | 'createdAt'> = {
    familyId: input.familyId,
    title: input.title,
    description: input.description,
    category: input.category,
    type: input.type,
    difficulty: input.difficulty,
    targetMemberIds: input.targetMemberIds,
    creatorId: input.creatorId,
    rewards: input.rewards,
    status: 'ACTIVE',
    emoji: input.emoji,
    isFavorite: false,
    repeatEnabled: input.repeatEnabled,
    startDate: input.startDate,
    endDate: input.endDate,
    statusHistory: [],
  }

  const { id, error } = await dbCreate(input.familyId, mission)
  if (error || !id) return { id: null, error }

  return { id, error: null }
}

// 미션 생성 완료 후 대상 아이들에게 알림 발송 (배치 생성 시 1회만 호출)
export async function notifyNewMission(
  familyId: string,
  targetMemberIds: string[],
  title: string,
  relatedId: string,
  creatorName: string,
  splitCount: number,
): Promise<void> {
  const countStr = splitCount > 1 ? ` (총 ${splitCount}개)` : ''
  const content = `${creatorName}이(가) 새 퀘스트를 등록했어요! ⚔️ "${title}"${countStr}`
  await Promise.all(
    targetMemberIds.map(memberId =>
      createNotification(familyId, {
        type: 'NEW_MISSION',
        targetMemberId: memberId,
        content,
        relatedId,
      })
    )
  )
}
