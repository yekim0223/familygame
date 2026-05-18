// Design Ref: §2.3 Application — 미션 완료 신청 유스케이스
// 개별 승인: targetMemberIds에 여러 아이가 있어도 각자 독립적으로 완료/승인
import { getMission, updateMission } from '@/infrastructure/firebase/collections/missions'
import { getMembersByFamily, getMember } from '@/infrastructure/firebase/collections/members'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import type { StatusChange } from '@/domain/entities/Mission'

export async function completeMission(
  familyId: string,
  missionId: string,
  memberId: string,
  creatorId: string
): Promise<{ error: string | null }> {
  const { data: current, error: fetchError } = await getMission(familyId, missionId)
  if (fetchError) return { error: fetchError }
  if (!current) return { error: '미션을 찾을 수 없어요' }

  // 이 아이의 현재 memberStatus 확인 (개별 상태 우선, 없으면 전체 status 참조)
  const myStatus = current.memberStatuses?.[memberId] ?? current.status
  if (myStatus !== 'ACTIVE') {
    return { error: '이미 완료 신청이 접수된 미션이에요. 중복 접수는 불가해요 ⏳' }
  }

  const statusChange: StatusChange = {
    from: 'ACTIVE',
    to: 'PENDING_APPROVAL',
    changedBy: memberId,
    changedAt: new Date(),
  }

  // 아이별 memberStatuses 업데이트 + 전체 status도 업데이트 (하위호환)
  const updatedMemberStatuses = {
    ...(current.memberStatuses ?? {}),
    [memberId]: 'PENDING_APPROVAL' as const,
  }

  await updateMission(familyId, missionId, {
    status: 'PENDING_APPROVAL',    // 대표 상태 (알림 호환용)
    completedBy: memberId,
    memberStatuses: updatedMemberStatuses,
    statusHistory: [...(current.statusHistory ?? []), statusChange] as any,
  })

  // 신청자 이름 조회
  const { data: child } = await getMember(familyId, memberId)
  const childName = child?.name || child?.realName || '아이'

  // 부모 전원에게 MISSION_PENDING 알림 (1회)
  const { data: allMembers } = await getMembersByFamily(familyId)
  const parentIds = (allMembers ?? [])
    .filter(m => m.role === 'DAD' || m.role === 'MOM')
    .map(m => m.id)
  const notifyIds = parentIds.length > 0 ? parentIds : [creatorId]

  await Promise.all(
    notifyIds.map(pid =>
      createNotification(familyId, {
        type: 'MISSION_PENDING',
        targetMemberId: pid,
        content: `${childName}이(가) "${current.title}" 완료 신청을 보냈어요! ✅`,
        relatedId: missionId,
      })
    )
  )

  return { error: null }
}
