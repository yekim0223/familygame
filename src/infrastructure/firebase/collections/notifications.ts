// Design Ref: §4.1 Firestore — notifications 컬렉션
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsUpdate, fsSubscribe, toDate } from '../firestore'
import type { Notification, NotificationType } from '@/domain/entities/Message'

function col(familyId: string) { return `families/${familyId}/notifications` }

export function subscribeNotifications(
  familyId: string,
  memberIds: string | string[],
  onData: (notifs: Notification[]) => void
): () => void {
  const ids = Array.isArray(memberIds) ? memberIds : [memberIds]
  const constraint = ids.length === 1
    ? where('targetMemberId', '==', ids[0])
    : where('targetMemberId', 'in', ids)
  return fsSubscribe<any>(
    col(familyId),
    [constraint, orderBy('createdAt', 'desc')],
    raw => onData(raw.map(n => ({ ...n, createdAt: toDate(n.createdAt) })) as Notification[])
  )
}

export async function createNotification(
  familyId: string,
  data: {
    type: NotificationType
    targetMemberId: string
    content: string
    relatedId: string
  }
): Promise<{ error: string | null }> {
  const { id, error } = await fsAdd(col(familyId), { ...data, isRead: false })
  return { error }
}

export async function markNotificationRead(
  familyId: string,
  notifId: string
): Promise<{ error: string | null }> {
  return fsUpdate(`${col(familyId)}/${notifId}`, { isRead: true })
}

// 전체 읽기 — 미읽음 알림 일괄 처리
export async function markAllNotificationsRead(
  familyId: string,
  notifIds: string[]
): Promise<void> {
  await Promise.all(
    notifIds.map(id => fsUpdate(`${col(familyId)}/${id}`, { isRead: true }))
  )
}
