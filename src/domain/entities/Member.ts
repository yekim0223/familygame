// Design Ref: §3 Domain Entities — Member 타입 정의
export type Role = 'DAD' | 'MOM' | 'CHILD' | 'OBSERVER'

// UI 전용 역할 선택 (하윤/서윤 구분)
export type UIRole = 'DAD' | 'MOM' | 'HAYOON' | 'SEOYOON' | 'OBSERVER'

export const UI_ROLE_TO_ROLE: Record<UIRole, Role> = {
  DAD: 'DAD', MOM: 'MOM', HAYOON: 'CHILD', SEOYOON: 'CHILD', OBSERVER: 'OBSERVER',
}

export const UI_ROLE_TO_REAL_NAME: Record<UIRole, string> = {
  DAD: '아빠', MOM: '엄마', HAYOON: '하윤', SEOYOON: '서윤', OBSERVER: '옵저버',
}

export const UI_ROLE_LABELS: Record<UIRole, string> = {
  DAD: '아빠',
  MOM: '엄마',
  HAYOON: '하윤',
  SEOYOON: '서윤',
  OBSERVER: '옵저버',
}

export interface CharacterInfo {
  characterId: string
  petId: string
  equipment: string[]
  worldBanner: string
}

export interface Member {
  id: string
  familyId: string
  name: string             // 닉네임
  realName: string         // 실제 이름 (하윤, 서윤, 아빠, 엄마 등)
  loginId?: string         // 새 기기 로그인용 개인 ID (선택)
  role: Role
  calendarType: '양력' | '음력'
  birthDate: Date
  koreanAge: number        // 자동 계산
  pinHash: string
  level: number
  exp: number
  character: CharacterInfo
  beggingLeft: number      // 이번 주 조르기 남은 횟수
  isActive: boolean
  createdAt: Date
}

// 회원가입 입력 타입 (birthHour 제거)
export interface RegisterInput {
  name: string             // 닉네임
  realName: string         // 실제 이름
  familyCode: string
  familyId?: string        // DAD가 아닌 경우 필수
  birthYear: number
  birthMonth: number
  birthDay: number
  calendarType: '양력' | '음력'
  role: Role
  uiRole: UIRole
  pin: string
  characterId: string
}

// 로그인 입력 타입
export interface LoginInput {
  memberId: string
  pin: string
}

// Firestore 저장용 타입
export type MemberFirestore = Omit<Member, 'birthDate' | 'createdAt' | 'koreanAge'> & {
  birthDate: any
  createdAt: any
}
