// Design Ref: §2.3 Application — 미션 개별 승인/보류/미승인
// 개별 승인: 여러 아이 중 한 명만 승인해도 다른 아이에게 영향 없음
import { updateMission } from '@/infrastructure/firebase/collections/missions'
import { getMember } from '@/infrastructure/firebase/collections/members'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import { grantReward } from '@/application/use-cases/rewards/grantReward'
import type { Mission, MissionStatus } from '@/domain/entities/Mission'

type ApproveAction = 'APPROVED' | 'ON_HOLD' | 'REJECTED'
interface ApproveResult { leveledUp: boolean; newLevel: number; error: string | null }

export async function approveMission(
  familyId: string,
  mission: Mission,
  action: ApproveAction,
  approverId: string,
  targetMemberId?: string   // 승인 대상 아이 ID (없으면 mission.completedBy 사용)
): Promise<ApproveResult> {

  const childId = targetMemberId ?? mission.completedBy!
  const newMemberStatus: MissionStatus =
    action === 'APPROVED' ? 'APPROVED' :
    action === 'ON_HOLD'  ? 'ON_HOLD'  : 'ACTIVE'   // REJECTED → ACTIVE (재도전)

  // memberStatuses 업데이트 (아이별 개별 상태)
  const updatedMemberStatuses = {
    ...(mission.memberStatuses ?? {}),
    [childId]: newMemberStatus,
  }

  // 전체 status 계산: 모든 아이가 APPROVED면 APPROVED, 하나라도 PENDING이면 PENDING_APPROVAL
  const allStatuses = mission.targetMemberIds.map(id => updatedMemberStatuses[id] ?? 'ACTIVE')
  const overallStatus: MissionStatus =
    allStatuses.every(s => s === 'APPROVED')         ? 'APPROVED'         :
    allStatuses.some(s  => s === 'PENDING_APPROVAL') ? 'PENDING_APPROVAL' :
    allStatuses.some(s  => s === 'ON_HOLD')          ? 'ON_HOLD'          : 'ACTIVE'

  const { error: updateError } = await updateMission(familyId, mission.id, {
    memberStatuses: updatedMemberStatuses,
    status: overallStatus,
    statusHistory: [
      ...mission.statusHistory,
      { from: mission.status, to: newMemberStatus, changedBy: approverId, changedAt: new Date() },
    ] as any,
  })
  if (updateError) return { leveledUp: false, newLevel: 0, error: updateError }

  let leveledUp = false
  let newLevel   = 0

  if (action === 'APPROVED') {
    // 이 아이에게만 보상 지급
    const { data: member } = await getMember(familyId, childId)
    if (member) {
      const result = await grantReward({
        familyId,
        missionId:  mission.id,
        member,
        rewards:    mission.rewards,
        expGain:    mission.difficulty,
        approvedBy: approverId,
      })
      leveledUp = result.leveledUp
      newLevel  = result.newLevel
      if (result.error) return { leveledUp, newLevel, error: result.error }
    }
    // 승인 알림은 발송하지 않음 (단순 완료 제외 정책)

  } else if (action === 'ON_HOLD') {
    await createNotification(familyId, {
      type: 'MISSION_HOLD',
      targetMemberId: childId,
      content: `🤔 "${mission.title}" 퀘스트 승인을 조금 더 고민할게요. 기다려봐요!`,
      relatedId: mission.id,
    })

  } else {
    await createNotification(familyId, {
      type: 'MISSION_REJECTED',
      targetMemberId: childId,
      content: `💪 "${mission.title}" 아직 완료되지 않았어요. 다시 도전해봐요!`,
      relatedId: mission.id,
    })
  }

  return { leveledUp, newLevel, error: null }
}
