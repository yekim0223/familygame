// Design Ref: §3-5 조르기 — 아이 요청 제출 유스케이스
// 주간 리셋: 월요일 0시 기준으로 beggingLeft 자동 복원
import { createBeggingRequest, type BeggingType } from '@/infrastructure/firebase/collections/begging'
import { updateMember, getMembersByFamily } from '@/infrastructure/firebase/collections/members'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import type { Member } from '@/domain/entities/Member'

// 레벨 기반 이번 주 조르기 허용 횟수: 기본 3회 + 레벨당 +1
export function calcBeggingLimit(level: number): number {
  return 3 + (level - 1)   // Lv.1=3, Lv.2=4, Lv.3=5 ...
}

// ISO 주 키 (yyyy-Www) — 월요일 시작 기준
function getISOWeekKey(): string {
  const now = new Date()
  const d   = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))   // 목요일 기준
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo    = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

interface SubmitResult { success: boolean; error: string | null }

export async function submitBegging(
  familyId: string,
  member: Member,
  type: BeggingType,
  content: string,
  dadId: string,
  momId: string
): Promise<SubmitResult> {
  if (!content.trim()) return { success: false, error: '내용을 입력해줘요!' }

  const currentWeek = getISOWeekKey()
  const memberWeek  = (member as any).beggingWeek as string | undefined
  const limit       = calcBeggingLimit(member.level)

  let beggingLeft = member.beggingLeft

  // ── 주간 리셋: 새 주라면 카운트 복원 ──────────────────────────
  if (!memberWeek || memberWeek !== currentWeek) {
    beggingLeft = limit
    await updateMember(familyId, member.id, {
      beggingLeft: limit,
      beggingWeek: currentWeek,
    } as any)
  }

  // ── 횟수 체크 ─────────────────────────────────────────────────
  if (beggingLeft <= 0) {
    return {
      success: false,
      error: `이번 주 조르기를 모두 사용했어요! 다음 주 월요일에 다시 도전해봐요 🙏 (주 ${limit}회 제한)`,
    }
  }

  // ── 요청 생성 ─────────────────────────────────────────────────
  const { id, error } = await createBeggingRequest(familyId, member.id, type, content.trim())
  if (error || !id) return { success: false, error }

  // 즉시 차감 + 주 키 기록
  await updateMember(familyId, member.id, {
    beggingLeft:  Math.max(0, beggingLeft - 1),
    beggingWeek:  currentWeek,
  } as any)

  // 부모 전원에게 알림
  const { data: allMembers } = await getMembersByFamily(familyId)
  const parentIds = (allMembers ?? [])
    .filter(m => m.role === 'DAD' || m.role === 'MOM')
    .map(m => m.id)

  await Promise.all(
    parentIds.map(pid =>
      createNotification(familyId, {
        type: 'BEGGING_REQUEST',
        targetMemberId: pid,
        content: `${member.name}이(가) 조르기 요청을 보냈어요! 확인해봐요 🙏`,
        relatedId: id,
      })
    )
  )

  return { success: true, error: null }
}
