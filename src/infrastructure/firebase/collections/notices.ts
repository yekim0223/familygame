// 공지사항 컬렉션 — families/{familyId}/notices
import { orderBy } from 'firebase/firestore'
import { fsAdd, fsDelete, fsUpdate, fsSubscribe, toDate } from '../firestore'

export interface Notice {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  createdAt: Date
  updatedAt?: Date
}

function col(familyId: string) { return `families/${familyId}/notices` }
function doc(familyId: string, id: string) { return `families/${familyId}/notices/${id}` }

function toNotice(raw: any): Notice {
  return {
    ...raw,
    createdAt: toDate(raw.createdAt),
    updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : undefined,
  } as Notice
}

export function subscribeNotices(
  familyId: string,
  onData: (notices: Notice[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toNotice))
  )
}

export async function addNotice(
  familyId: string,
  title: string,
  content: string,
  authorId: string,
  authorName: string
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), { title, content, authorId, authorName })
  return { error }
}

export async function updateNotice(
  familyId: string,
  noticeId: string,
  title: string,
  content: string
): Promise<{ error: string | null }> {
  return fsUpdate(doc(familyId, noticeId), { title, content })
}

export async function deleteNotice(
  familyId: string,
  noticeId: string
): Promise<{ error: string | null }> {
  return fsDelete(doc(familyId, noticeId))
}
