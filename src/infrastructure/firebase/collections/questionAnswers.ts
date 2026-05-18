// Design Ref: 두근두근 질문함 — 아이들 답변 Firestore 컬렉션
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsSubscribe, toDate } from '../firestore'

export type QuestionEmotion = 'LIKE' | 'DISLIKE' | null

export interface QuestionAnswer {
  id: string
  memberId: string
  memberName: string
  questionIdx: number
  question: string
  answer: string
  emotion: QuestionEmotion
  reward: string
  dateKey: string   // yyyy-mm-dd
  createdAt: Date
}

function col(familyId: string) {
  return `families/${familyId}/question_answers`
}

function toAnswer(raw: any): QuestionAnswer {
  return {
    ...raw,
    emotion: raw.emotion ?? null,
    createdAt: toDate(raw.createdAt),
  } as QuestionAnswer
}

// 전체 답변 구독 (부모 관리자)
export function subscribeAllAnswers(
  familyId: string,
  cb: (answers: QuestionAnswer[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [orderBy('createdAt', 'desc')],
    docs => cb(docs.map(toAnswer)),
    () => cb([])
  )
}

// 내 오늘 답변 조회 (아이 — 이미 제출했는지 확인용)
export function subscribeMyAnswers(
  familyId: string,
  memberId: string,
  cb: (answers: QuestionAnswer[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('memberId', '==', memberId), orderBy('createdAt', 'desc')],
    docs => cb(docs.map(toAnswer)),
    () => cb([])
  )
}

// 답변 저장
export async function submitAnswer(
  familyId: string,
  data: Omit<QuestionAnswer, 'id' | 'createdAt'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await fsAdd(col(familyId), data)
  if (error) return { success: false, error }
  return { success: true }
}
