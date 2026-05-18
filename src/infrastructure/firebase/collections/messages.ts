// Design Ref: §4.1 Firestore — messages 컬렉션 (채팅 + 응원)
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsSubscribe, toDate } from '../firestore'
import type { Message } from '@/domain/entities/Message'

function col(familyId: string) { return `families/${familyId}/messages` }

function toMessage(raw: any): Message {
  return { ...raw, createdAt: toDate(raw.createdAt) } as Message
}

// 그룹 채팅 구독 (receiverId === null)
export function subscribeGroupChat(
  familyId: string,
  onData: (messages: Message[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('type', '==', 'CHAT'), where('receiverId', '==', null), orderBy('createdAt', 'asc')],
    raw => onData(raw.map(toMessage))
  )
}

// 1:1 채팅 구독
export function subscribeDirectChat(
  familyId: string,
  userId: string,
  otherId: string,
  onData: (messages: Message[]) => void
): () => void {
  // Firestore에서는 OR 쿼리 대신 두 방향 모두 구독 후 클라이언트 병합
  return fsSubscribe<any>(
    col(familyId),
    [
      where('type', '==', 'CHAT'),
      where('senderId', '==', userId),
      where('receiverId', '==', otherId),
      orderBy('createdAt', 'asc'),
    ],
    raw => onData(raw.map(toMessage))
  )
}

// 응원 메시지 구독 (내가 받은 응원)
export function subscribeMyCheers(
  familyId: string,
  memberId: string,
  onData: (cheers: Message[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('type', '==', 'CHEER'), where('receiverId', '==', memberId), orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toMessage))
  )
}

// 메시지 전송 (id 반환 — 알림 생성 시 relatedId로 사용)
export async function sendMessage(
  familyId: string,
  senderId: string,
  content: string,
  receiverId: string | null = null
): Promise<{ id: string | null; error: string | null }> {
  return fsAdd(col(familyId), {
    type: 'CHAT',
    senderId,
    receiverId,
    content,
    readBy: [senderId],
  })
}

// 응원 이모티콘 전송
export async function sendCheer(
  familyId: string,
  senderId: string,
  receiverId: string,
  cheerEmoji: string,
  targetMissionId?: string
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), {
    type: 'CHEER',
    senderId,
    receiverId,
    content: `응원을 보냈어요! ${cheerEmoji}`,
    cheerEmoji,
    targetMissionId: targetMissionId ?? null,
    readBy: [senderId],
  })
  return { error }
}

// 읽음 처리
export async function markMessageRead(
  familyId: string,
  messageId: string,
  memberId: string,
  currentReadBy: string[]
): Promise<{ error: string | null }> {
  if (currentReadBy.includes(memberId)) return { error: null }
  return fsUpdate(`${col(familyId)}/${messageId}`, {
    readBy: [...currentReadBy, memberId],
  })
}
