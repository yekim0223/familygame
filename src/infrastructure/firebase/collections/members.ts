// Design Ref: §4.1 Firestore 컬렉션 — members 컬렉션 CRUD
import { where, orderBy } from 'firebase/firestore'
import { fsGet, fsSet, fsAdd, fsQuery, fsUpdate, fsSubscribe, toDate } from '../firestore'
import type { Member, MemberFirestore } from '@/domain/entities/Member'
import { calcKoreanAge } from '@/domain/services/KoreanAge'

function colPath(familyId: string) {
  return `families/${familyId}/members`
}

function docPath(familyId: string, memberId: string) {
  return `families/${familyId}/members/${memberId}`
}

// Firestore 문서 → Member 타입 변환
function toMember(raw: any): Member {
  const birthDate = toDate(raw.birthDate)
  return {
    ...raw,
    birthDate,
    createdAt: toDate(raw.createdAt),
    koreanAge: calcKoreanAge(birthDate),
    realName: raw.realName ?? raw.name,  // 구버전 호환: realName 없으면 name 사용
    calendarType: raw.calendarType ?? '양력',
  } as Member
}

// 가족 구성원 전체 구독 (로그인 화면에서 사용)
// orderBy 제거 → 복합 인덱스 의존성 없애고 클라이언트 정렬로 대체
export function subscribeMembers(
  familyId: string,
  onData: (members: Member[]) => void,
  onError?: () => void
): () => void {
  return fsSubscribe<Member>(
    colPath(familyId),
    [where('isActive', '==', true)],
    raw => {
      const sorted = raw
        .map(toMember)
        .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
      onData(sorted)
    },
    onError ? (_err: string) => onError() : undefined
  )
}

// 특정 구성원 조회
export async function getMember(
  familyId: string, memberId: string
): Promise<{ data: Member | null; error: string | null }> {
  const result = await fsGet<any>(docPath(familyId, memberId))
  if (result.error || !result.data) return result as any
  return { data: toMember(result.data), error: null }
}

// 이름으로 구성원 조회 (로그인 시 사용)
export async function getMemberByName(
  familyId: string, name: string
): Promise<{ data: Member | null; error: string | null }> {
  const result = await fsQuery<any>(colPath(familyId), [where('name', '==', name)])
  if (result.error) return { data: null, error: result.error }
  if (result.data.length === 0) return { data: null, error: null }
  return { data: toMember(result.data[0]), error: null }
}

// 가족 전체 구성원 조회 (인원 제한 체크용)
export async function getMembersByFamily(
  familyId: string
): Promise<{ data: Member[]; error: string | null }> {
  const result = await fsQuery<any>(colPath(familyId), [where('isActive', '==', true)])
  if (result.error) return { data: [], error: result.error }
  return { data: result.data.map(toMember), error: null }
}

// 새 구성원 생성 — uid를 documentId로 고정 (보안 규칙 통과를 위해 필수)
// 이렇게 해야 Firestore 규칙의 request.auth.uid == memberId 체크가 작동함
export async function createMemberWithId(
  familyId: string,
  uid: string,
  member: Omit<MemberFirestore, 'id'>
): Promise<{ id: string | null; error: string | null }> {
  const { error } = await fsSet(docPath(familyId, uid), member)
  if (error) return { id: null, error }
  return { id: uid, error: null }
}

// 새 구성원 생성 (auto-id — 비 DAD 구성원용)
export async function createMember(
  familyId: string,
  member: Omit<MemberFirestore, 'id'>
): Promise<{ id: string | null; error: string | null }> {
  return fsAdd(colPath(familyId), member)
}

// 구성원 정보 업데이트 (캐릭터, 레벨 등)
export async function updateMember(
  familyId: string, memberId: string,
  data: Partial<MemberFirestore>
): Promise<{ error: string | null }> {
  return fsUpdate(docPath(familyId, memberId), data)
}

// 가족 설정 문서 조회 (가족 코드 확인용)
export async function getFamilySettings(
  familyId: string
): Promise<{ data: any | null; error: string | null }> {
  return fsGet<any>(`families/${familyId}/config/settings`)
}

// 최초 가족 설정 생성 (아빠 회원가입 시)
export async function createFamilySettings(
  familyId: string,
  familyCodeHash: string
): Promise<{ error: string | null }> {
  return fsSet(`families/${familyId}/config/settings`, {
    familyCodeHash,
    rewardTypes: [],
    specialDays: [],
    notice: '',
  })
}

// 가족 코드 해시로 familyId 찾기
export async function findFamilyByCode(
  codeHash: string
): Promise<{ familyId: string | null; error: string | null }> {
  // 실제 구현: families 컬렉션을 직접 조회하는 대신
  // settings 문서의 familyCodeHash를 비교
  // 프로덕션에서는 Cloud Functions를 통해 처리 권장
  const result = await fsQuery<any>(
    'families',
    [where('settings.familyCodeHash', '==', codeHash)]
  )
  if (result.error) return { familyId: null, error: result.error }
  // families 컬렉션 구조상 직접 쿼리보다 클라이언트에 familyId를 전달하는 방식 사용
  // 단순화: 앱에 단일 가족만 존재하므로 familyId를 앱에 하드코딩하거나 설정으로 관리
  return { familyId: null, error: '가족 코드를 확인할 수 없어요' }
}
