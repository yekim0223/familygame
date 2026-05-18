// Design Ref: §2.3 Application Layer — 옵저버 비회원 접속 유스케이스
// 개선: familyId 직접 입력 제거 → localStorage 자동 감지, 상태 확인 기능 추가
import { startAnonymousSession } from '@/infrastructure/firebase/auth'
import { fsAdd, fsGet, fsQuery, fsUpdate, where } from '@/infrastructure/firebase/firestore'

export type ObserverType =
  | 'GRANDMA' | 'GRANDPA' | 'DAD_FRIEND' | 'MOM_FRIEND'
  | 'CHILD1_FRIEND' | 'CHILD2_FRIEND' | 'PASSING_DOG'
  | 'CLEANING_CAT' | 'PUYO_JELLY' | 'MAGPIE' | 'PIANO_MONKEY'

export const OBSERVER_TYPE_LABELS: Record<ObserverType, string> = {
  GRANDMA:       '👵 할머니',
  GRANDPA:       '👴 할아버지',
  DAD_FRIEND:    '👔 아빠 친구',
  MOM_FRIEND:    '👩 엄마 친구',
  CHILD1_FRIEND: '👧 하윤 친구',
  CHILD2_FRIEND: '👧 서윤 친구',
  PASSING_DOG:   '🐕 지나가는 개',
  CLEANING_CAT:  '🐈 청소하는 고양이',
  PUYO_JELLY:    '🟢 뿌요뿌요 젤리',
  MAGPIE:        '🐦 물까치',
  PIANO_MONKEY:  '🐒 피아노치는 원숭이',
}

export interface ObserverSession {
  id: string
  name: string
  phoneLast4: string
  type: ObserverType
  familyId: string
  uid: string
  isPending: boolean   // 승인 대기
  isActive: boolean    // 승인됨 + 활성
  isRejected: boolean  // 거절됨
  expiresAt: number    // 24시간 만료 타임스탬프
  createdAt: number
}

export type ObserverStatus = 'pending' | 'approved' | 'expired' | 'rejected' | 'not-found'

function colPath(familyId: string) {
  return `families/${familyId}/observer-sessions`
}

// ── 접속 신청 ─────────────────────────────────────────────────
// familyId는 localStorage에서 자동 읽기 (사용자 입력 불필요)
export async function requestObserverAccess(input: {
  name: string
  phoneLast4: string
  type: ObserverType
}): Promise<{ success: boolean; sessionId: string | null; error: string | null }> {

  const familyId = localStorage.getItem('familyId')
  if (!familyId) {
    return {
      success: false, sessionId: null,
      error: '가족 ID를 찾을 수 없어요. 가족 구성원의 기기에서 접속해주세요.',
    }
  }

  const { uid, error: sessionError } = await startAnonymousSession()
  if (!uid || sessionError) return { success: false, sessionId: null, error: sessionError }

  const now = Date.now()
  const expiresAt = now + 24 * 60 * 60 * 1000

  // 이미 동일 신청이 있는지 확인 (같은 이름+전화뒤4자리)
  const { data: existing } = await fsQuery<any>(
    colPath(familyId),
    [where('phoneLast4', '==', input.phoneLast4), where('isPending', '==', true)]
  )
  if (existing.length > 0) {
    return {
      success: false, sessionId: existing[0].id, error: null,
      // 이미 신청 중 → 성공으로 처리해 상태 확인 화면 표시
    } as any
  }

  const { id, error } = await fsAdd(colPath(familyId), {
    name: input.name,
    phoneLast4: input.phoneLast4,
    type: input.type,
    familyId,
    uid,
    isPending: true,
    isActive: false,
    isRejected: false,
    expiresAt,
    createdAt: now,
  })

  if (error || !id) return { success: false, sessionId: null, error }
  return { success: true, sessionId: id, error: null }
}

// ── 승인 상태 확인 ────────────────────────────────────────────
export async function checkObserverStatus(phoneLast4: string): Promise<{
  status: ObserverStatus
  session: ObserverSession | null
  error: string | null
}> {
  const familyId = localStorage.getItem('familyId')
  if (!familyId) return { status: 'not-found', session: null, error: null }

  const { data, error } = await fsQuery<any>(
    colPath(familyId),
    [where('phoneLast4', '==', phoneLast4)]
  )
  if (error) return { status: 'not-found', session: null, error }
  if (!data || data.length === 0) return { status: 'not-found', session: null, error: null }

  // 최신 신청 기준
  const session = data.sort((a: any, b: any) => b.createdAt - a.createdAt)[0] as ObserverSession
  const now = Date.now()

  if (session.isRejected) return { status: 'rejected', session, error: null }
  if (session.isActive && session.expiresAt > now) return { status: 'approved', session, error: null }
  if (session.isActive && session.expiresAt <= now) return { status: 'expired', session, error: null }
  return { status: 'pending', session, error: null }
}

// ── 부모: 모든 신청 목록 조회 ─────────────────────────────────
export async function getPendingObservers(familyId: string): Promise<ObserverSession[]> {
  const { data } = await fsQuery<any>(
    colPath(familyId),
    [where('isPending', '==', true)]
  )
  return (data ?? []) as ObserverSession[]
}

// ── 부모: 승인 ────────────────────────────────────────────────
export async function approveObserver(
  familyId: string,
  sessionId: string
): Promise<{ error: string | null }> {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000
  return fsUpdate(`${colPath(familyId)}/${sessionId}`, {
    isPending: false,
    isActive: true,
    isRejected: false,
    expiresAt,
  })
}

// ── 부모: 거절 ────────────────────────────────────────────────
export async function rejectObserver(
  familyId: string,
  sessionId: string
): Promise<{ error: string | null }> {
  return fsUpdate(`${colPath(familyId)}/${sessionId}`, {
    isPending: false,
    isActive: false,
    isRejected: true,
  })
}
