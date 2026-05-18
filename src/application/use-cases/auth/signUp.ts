// Design Ref: §2.3 Application Layer — 회원가입 유스케이스
// Plan SC: SC-01 가족 4명 모두 회원가입
import { hashPin, hashFamilyCode, startAnonymousSession } from '@/infrastructure/firebase/auth'
import {
  createMemberWithId, createMember,
  createFamilySettings, getFamilySettings, getMember, getMemberByName,
  getMembersByFamily,
} from '@/infrastructure/firebase/collections/members'
import { isFirebaseReady } from '@/infrastructure/firebase/config'
import { buildBirthDate } from '@/domain/services/KoreanAge'
import type { RegisterInput, Role } from '@/domain/entities/Member'

// 기본 가족 인증키 (마스터 설정에서 변경 가능)
export const DEFAULT_FAMILY_CODE = '20180903'

interface SignUpResult {
  success: boolean
  memberId: string | null
  familyId: string | null
  error: string | null
}

export async function signUp(input: RegisterInput): Promise<SignUpResult> {
  // Firebase 설정 확인
  if (!isFirebaseReady) {
    return {
      success: false, memberId: null, familyId: null,
      error: '.env.local 파일에 Firebase 설정이 없어요. VITE_FIREBASE_API_KEY 등을 입력해주세요',
    }
  }

  // 기본 검증
  if (!input.name.trim())
    return { success: false, memberId: null, familyId: null, error: '닉네임을 입력해주세요' }
  if (!input.pin || input.pin.length < 2)
    return { success: false, memberId: null, familyId: null, error: 'PIN은 2자리 이상이어야 해요' }
  if (input.pin.length > 8)
    return { success: false, memberId: null, familyId: null, error: 'PIN은 최대 8자리예요' }

  // Firebase Anonymous 세션
  const { uid, error: sessionError } = await startAnonymousSession()
  if (!uid || sessionError) {
    console.error('[signUp] Auth failed:', sessionError)
    return { success: false, memberId: null, familyId: null, error: sessionError ?? '세션을 시작할 수 없어요' }
  }

  // 해시 처리
  const pinHash = await hashPin(input.pin)
  const codeHash = await hashFamilyCode(input.familyCode)

  // 구성원 기본 데이터 (familyId는 아래에서 결정)
  const birthDate = buildBirthDate(input.birthYear, input.birthMonth, input.birthDay)
  const buildMemberData = (familyId: string) => ({
    familyId,
    name: input.name.trim(),
    realName: input.realName,
    role: input.role as Role,
    calendarType: input.calendarType,
    birthDate,
    pinHash,
    level: 1,
    exp: 0,
    character: {
      characterId: input.characterId,
      petId: 'dog',
      equipment: [],
      worldBanner: 'overworld',
    },
    beggingLeft: 3,   // Lv.1 기본 3회 (calcBeggingLimit(1) = 3)
    isActive: true,
    createdAt: new Date(),
  })

  if (input.role === 'DAD') {
    // ── DAD 가입: uid == familyId == memberId ─────────────────
    const familyId = uid

    // 이미 가입된 DAD인지 먼저 확인 (uid = familyId = memberId)
    const { data: existingDad } = await getMember(familyId, uid)
    if (existingDad) {
      localStorage.setItem('familyId', familyId)
      // RegisterPage에서 로그인 처리를 위해 특수 에러 코드 반환
      return { success: false, memberId: uid, familyId, error: 'ALREADY_REGISTERED' }
    }

    // 1. 구성원 문서 먼저 생성 (uid == memberId로 고정)
    const { id: memberId, error: memberErr } = await createMemberWithId(
      familyId, uid, buildMemberData(familyId) as any
    )
    if (!memberId || memberErr) {
      return { success: false, memberId: null, familyId: null, error: `구성원 생성 실패: ${memberErr}` }
    }

    // 2. settings 생성 (이제 DAD 구성원이 있으므로 보안 규칙 통과)
    const { error: settingsErr } = await createFamilySettings(familyId, codeHash)
    if (settingsErr) {
      console.error('[signUp] createFamilySettings failed:', settingsErr)
      return { success: false, memberId: null, familyId: null, error: `가족 설정 생성 실패: ${settingsErr}` }
    }

    localStorage.setItem('familyId', familyId)
    return { success: true, memberId, familyId, error: null }

  } else {
    // ── 기존 가족 합류 (엄마/하윤/서윤) ────────────────────────
    // familyId: 폼 입력값 → localStorage 순으로 폴백 (가족ID 입력란 제거 대응)
    const existingFamilyId = input.familyId?.trim() || localStorage.getItem('familyId') || ''
    if (!existingFamilyId) {
      return { success: false, memberId: null, familyId: null, error: '아빠(대표)가 먼저 같은 기기에서 가입해야 해요' }
    }

    const familyId = existingFamilyId

    // 가족 코드 검증
    const { data: settings, error: settingsErr } = await getFamilySettings(familyId)
    if (settingsErr) {
      return { success: false, memberId: null, familyId: null, error: `가족 정보 조회 실패: ${settingsErr}` }
    }
    if (!settings) {
      return { success: false, memberId: null, familyId: null, error: '가족 ID를 찾을 수 없어요. 아빠에게 다시 확인해주세요' }
    }
    if (settings.familyCodeHash !== codeHash) {
      return { success: false, memberId: null, familyId: null, error: '가족 인증키가 맞지 않아요' }
    }

    // ── 가족 인원·역할 제한 체크 ─────────────────────────────────
    const FAMILY_MEMBER_LIMIT = 4
    const FAMILY_FULL_MSG = '이미 모든 가족 구성원이 등록되었습니다. 외부인은 가입할 수 없어요.'

    const { data: currentMembers, error: listErr } = await getMembersByFamily(familyId)
    if (listErr) {
      return { success: false, memberId: null, familyId: null, error: `멤버 조회 실패: ${listErr}` }
    }

    if (currentMembers.length >= FAMILY_MEMBER_LIMIT) {
      return { success: false, memberId: null, familyId: null, error: FAMILY_FULL_MSG }
    }

    // realName 중복 = 동일 역할 재가입 시도 (하윤/서윤/엄마 중복 방지)
    const roleConflict = currentMembers.some(m => m.realName === input.realName)
    if (roleConflict) {
      return { success: false, memberId: null, familyId: null, error: FAMILY_FULL_MSG }
    }

    // 닉네임 중복 확인
    const { data: existing } = await getMemberByName(familyId, input.name.trim())
    if (existing) {
      return { success: false, memberId: null, familyId: null, error: `"${input.name}" 닉네임은 이미 사용 중이에요` }
    }

    // 구성원 생성 (auto-id)
    const { id: memberId, error: memberErr } = await createMember(familyId, buildMemberData(familyId) as any)
    if (!memberId || memberErr) {
      return { success: false, memberId: null, familyId: null, error: `구성원 생성 실패: ${memberErr}` }
    }

    // familyId를 localStorage에 저장 (로그인 화면에서 구성원 목록 로드에 필요)
    localStorage.setItem('familyId', familyId)
    return { success: true, memberId, familyId, error: null }
  }
}
