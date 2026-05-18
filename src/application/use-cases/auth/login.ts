// Design Ref: §2.3 Application Layer — 로그인 유스케이스
// Plan SC: SC-01 가족 4명 모두 각자 로그인 가능
import { hashPin, startAnonymousSession } from '@/infrastructure/firebase/auth'
import { getMember } from '@/infrastructure/firebase/collections/members'
import type { Member } from '@/domain/entities/Member'

interface LoginResult {
  success: boolean
  member: Member | null
  error: string | null
}

export async function login(
  familyId: string,
  memberId: string,
  pin: string
): Promise<LoginResult> {
  // 1. Firebase 익명 세션 먼저 확보 (Firestore 보안 규칙: request.auth != null)
  const { uid, error: sessionError } = await startAnonymousSession()
  if (!uid || sessionError) {
    return { success: false, member: null, error: sessionError }
  }

  // 2. 구성원 조회 (auth 있으므로 보안 규칙 통과)
  const { data: member, error: fetchError } = await getMember(familyId, memberId)
  if (fetchError) return { success: false, member: null, error: fetchError }
  if (!member) return { success: false, member: null, error: '구성원을 찾을 수 없어요' }
  if (!member.isActive) return { success: false, member: null, error: '비활성화된 계정이에요' }

  // 3. PIN 검증
  const pinHash = await hashPin(pin)
  if (pinHash !== member.pinHash) {
    return { success: false, member: null, error: 'PIN이 맞지 않아요 🔒' }
  }

  return { success: true, member, error: null }
}
