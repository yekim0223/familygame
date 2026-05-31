// 아이 측 미션 수락/거절 유스케이스
// 수락: childAccepted[memberId] = true, 부모는 수락 후 수정 불가
// 거절: status → CHILD_REJECTED, 부모에게 알림 → 수정/삭제 가능
import { getMission, updateMission } from '@/infrastructure/firebase/collections/missions'
import { getMembersByFamily } from '@/infrastructure/firebase/collections/members'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'

export async function acceptMission(
  familyId: string,
  missionId: string,
  memberId: string,
  _memberName: string
): Promise<{ error: string | null }> {
  const { data: mission } = await getMission(familyId, missionId)
  if (!mission) return { error: '미션을 찾을 수 없어요' }

  // 이미 수락됐으면 무시
  if (mission.childAccepted?.[memberId]) return { error: null }

  const updatedAccepted = { ...(mission.childAccepted ?? {}), [memberId]: true }
  await updateMission(familyId, missionId, { childAccepted: updatedAccepted })
  return { error: null }
}

export async function rejectMission(
  familyId: string,
  missionId: string,
  memberId: string,
  memberName: string
): Promise<{ error: string | null }> {
  const { data: mission } = await getMission(familyId, missionId)
  if (!mission) return { error: '미션을 찾을 수 없어요' }

  // memberStatuses에서 이 아이만 CHILD_REJECTED로 설정
  const updatedStatuses = {
    ...(mission.memberStatuses ?? {}),
    [memberId]: 'CHILD_REJECTED' as const,
  }
  // 전체 status: 다른 아이들이 모두 CHILD_REJECTED면 전체도 CHILD_REJECTED
  const allRejected = mission.targetMemberIds.every(
    id => updatedStatuses[id] === 'CHILD_REJECTED'
  )

  await updateMission(familyId, missionId, {
    memberStatuses: updatedStatuses,
    status: allRejected ? 'CHILD_REJECTED' : mission.status,
  })

  // 부모에게 알림
  const { data: allMembers } = await getMembersByFamily(familyId)
  const parentIds = (allMembers ?? [])
    .filter(m => m.role === 'DAD' || m.role === 'MOM')
    .map(m => m.id)

  await Promise.all(
    parentIds.map(pid =>
      createNotification(familyId, {
        type: 'MISSION_REJECTED',
        targetMemberId: pid,
        content: `❌ ${memberName}이(가) "${mission.title}" 퀘스트를 거절했어요. 수정하거나 삭제해줘요.`,
        relatedId: missionId,
      })
    )
  )

  return { error: null }
}
