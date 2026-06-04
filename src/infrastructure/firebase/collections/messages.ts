// Design Ref: §4.1 Firestore — messages 컬렉션 (채팅 + 응원)
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsDelete, fsSubscribe, fsQuery, toDate } from '../firestore'
import { createNotification } from './notifications'
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

// 1:1 채팅 구독 (양방향 병합)
export function subscribeDirectChat(
  familyId: string,
  userId: string,
  otherId: string,
  onData: (messages: Message[]) => void
): () => void {
  let sent: Message[] = []
  let received: Message[] = []
  const merge = () =>
    onData([...sent, ...received].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()))

  const constraints = (s: string, r: string) => [
    where('type', '==', 'CHAT'), where('senderId', '==', s),
    where('receiverId', '==', r), orderBy('createdAt', 'asc'),
  ]
  const colPath = col(familyId)
  const unsubSent = fsSubscribe<any>(colPath, constraints(userId, otherId),
    raw => { sent = raw.map(toMessage); merge() })
  const unsubRecv = fsSubscribe<any>(colPath, constraints(otherId, userId),
    raw => { received = raw.map(toMessage); merge() })
  return () => { unsubSent(); unsubRecv() }
}

// 나에게 온 DM 전체 구독 (unread 뱃지용)
export function subscribeReceivedDMs(
  familyId: string,
  userId: string,
  onData: (messages: Message[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('type', '==', 'CHAT'), where('receiverId', '==', userId), orderBy('createdAt', 'asc')],
    raw => onData(raw.map(toMessage))
  )
}

// 1:1 메시지 전송 + 알림
export async function sendDirectMessage(
  familyId: string,
  senderId: string,
  receiverId: string,
  content: string
): Promise<{ id: string | null; error: string | null }> {
  const result = await fsAdd(col(familyId), {
    type: 'CHAT', senderId, receiverId, content, readBy: [senderId],
  })
  if (!result.error && result.id) {
    createNotification(familyId, {
      type: 'NEW_MESSAGE',
      targetMemberId: receiverId,
      content: '새 메시지가 도착했어요',
      relatedId: result.id,
    })
  }
  return result
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

// 그룹 메시지 일괄 읽음 처리 (Firestore 업데이트)
export async function markGroupMessagesRead(
  familyId: string,
  messages: { id: string; readBy: string[] }[],
  memberId: string
): Promise<void> {
  const unread = messages.filter(m => !m.readBy.includes(memberId))
  await Promise.all(
    unread.map(m => markMessageRead(familyId, m.id, memberId, m.readBy))
  )
}

// 가족 전체 채팅 기록 일괄 삭제 (DAD 전용 초기화)
export async function clearAllFamilyMessages(
  familyId: string
): Promise<{ error: string | null }> {
  const { data, error } = await fsQuery<{ id: string }>(col(familyId), [])
  if (error) return { error }
  const errors = await Promise.all((data ?? []).map(m => fsDelete(`${col(familyId)}/${m.id}`)))
  const firstErr = errors.find(r => r.error)
  return { error: firstErr?.error ?? null }
}

// 메시지 삭제 (본인이 보낸 메시지만)
export async function deleteMessage(
  familyId: string,
  messageId: string
): Promise<{ error: string | null }> {
  return fsDelete(`${col(familyId)}/${messageId}`)
}

// 리액션 토글 — emoji를 memberId가 이미 눌렀으면 제거, 아니면 추가
export async function toggleReaction(
  familyId: string,
  messageId: string,
  emoji: string,
  memberId: string,
  currentReactions: Record<string, string[]>
): Promise<{ error: string | null }> {
  const updated: Record<string, string[]> = {}
  for (const [e, ids] of Object.entries(currentReactions)) {
    updated[e] = [...ids]
  }
  const existing = updated[emoji] ?? []
  if (existing.includes(memberId)) {
    const filtered = existing.filter(id => id !== memberId)
    if (filtered.length === 0) delete updated[emoji]
    else updated[emoji] = filtered
  } else {
    updated[emoji] = [...existing, memberId]
  }
  return fsUpdate(`${col(familyId)}/${messageId}`, { reactions: updated })
}
