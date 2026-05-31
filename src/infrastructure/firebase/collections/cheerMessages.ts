// 실시간 격려 메시지 컬렉션 — families/{familyId}/cheer_messages
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsSubscribe, toDate } from '../firestore'

export interface CheerMessage {
  id: string
  senderId: string
  senderName: string
  senderRole: string
  senderCharacterId: string
  targetMemberId: string
  content: string
  isRead: boolean
  createdAt: Date
}

function col(familyId: string) { return `families/${familyId}/cheer_messages` }

function toCheer(raw: any): CheerMessage {
  return { ...raw, createdAt: toDate(raw.createdAt) } as CheerMessage
}

// 자녀 화면에서 미읽음 격려만 구독 (실시간 팝업 트리거용)
export function subscribeUnreadCheers(
  familyId: string,
  targetMemberId: string,
  onData: (cheers: CheerMessage[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [
      where('targetMemberId', '==', targetMemberId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
    ],
    raw => onData(raw.map(toCheer))
  )
}

// 격려 메시지 발송 (엄마/아빠 전용)
export async function sendCheerMessage(
  familyId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  senderCharacterId: string,
  targetMemberId: string,
  content: string
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), {
    senderId, senderName, senderRole, senderCharacterId,
    targetMemberId, content, isRead: false,
  })
  return { error }
}

// 격려 메시지 읽음 처리
export async function markCheerRead(
  familyId: string,
  cheerId: string
): Promise<void> {
  await fsUpdate(`families/${familyId}/cheer_messages/${cheerId}`, { isRead: true })
}
