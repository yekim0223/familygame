export type MessageType = 'CHAT' | 'CHEER' | 'SYSTEM'
export type NotificationType =
  | 'MISSION_PENDING'    // 아이 완료신청 → 부모에게
  | 'MISSION_APPROVED'   // 하위호환 유지 (신규 발송 없음)
  | 'MISSION_REJECTED'   // 부모 거절 → 아이에게
  | 'MISSION_HOLD'       // 부모 보류 → 아이에게
  | 'MISSION_CONFIRMED'  // 아이 퀘스트 확인 → 부모에게
  | 'LEVEL_UP'           // 하위호환 유지
  | 'BEG_RESULT'         // 조르기 결과 → 아이에게
  | 'BEGGING_REQUEST'    // 아이 조르기 제출 → 부모에게
  | 'CHEER'
  | 'NEW_MISSION'        // 부모 퀘스트 생성 → 아이에게 + 부모에게
  | 'NEW_MESSAGE'
  | 'MISSION_EXPIRED'   // 퀘스트 기간 만료 → 부모에게 (패밀리 늬우스 표시)
  | 'MOM_CHEER'         // 엄마/아빠 원터치 격려 발송 로그 (cheerMessages 컬렉션 사용)

export interface Message {
  id: string
  familyId: string
  type: MessageType
  senderId: string
  receiverId: string | null   // null = 전체 채팅
  content: string
  cheerEmoji?: string
  targetMissionId?: string
  readBy: string[]
  reactions?: Record<string, string[]>  // emoji → [memberId, ...]
  createdAt: Date
}

export interface Notification {
  id: string
  familyId: string
  type: NotificationType
  targetMemberId: string
  content: string
  relatedId: string
  isRead: boolean
  createdAt: Date
}
