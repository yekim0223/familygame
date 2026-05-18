// Design Ref: §6.2 에러 처리 패턴 — 모든 Firestore 접근은 이 헬퍼 경유
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot,
  addDoc, getDocs, serverTimestamp, Timestamp,
  type DocumentData, type QueryConstraint
} from 'firebase/firestore'
import { db } from './config'

// Firebase 에러 코드 → 사용자 메시지 변환
function mapFirebaseError(code: string): string {
  const errorMap: Record<string, string> = {
    'permission-denied':    '접근 권한이 없어요. 잠시 후 다시 시도해주세요',
    'unauthenticated':      '로그인이 필요해요',
    'not-found':            '데이터를 찾을 수 없어요',
    'unavailable':          '서버에 접속할 수 없어요. 인터넷 연결을 확인해주세요',
    'deadline-exceeded':    '연결 시간이 초과됐어요. 인터넷 연결을 확인해주세요',
    'already-exists':       '이미 존재하는 데이터예요',
    'resource-exhausted':   '잠시 후 다시 시도해봐요',
    'cancelled':            '요청이 취소되었어요',
    'invalid-argument':     '입력값이 올바르지 않아요',
    'failed-precondition':  '서버 준비가 되지 않았어요. 잠시 후 다시 시도해주세요',
    'internal':             '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요',
    'unimplemented':        '지원되지 않는 기능이에요',
    'data-loss':            '데이터 오류가 발생했어요',
    'out-of-range':         '요청 범위가 초과됐어요',
  }
  return errorMap[code] ?? `처리 중 오류가 발생했어요 (${code ?? 'unknown'})`
}

// undefined 값 제거 — Firestore는 undefined를 invalid-argument로 거부
function sanitize(data: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
}

// Firestore 작업 타임아웃 (8초)
function withTimeout<T>(promise: Promise<T>, ms = 8_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(), { code: 'deadline-exceeded' })), ms)
    ),
  ])
}

export async function fsGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const snap = await withTimeout(getDoc(doc(db, path)))
    if (!snap.exists()) return { data: null, error: null }
    return { data: { id: snap.id, ...snap.data() } as T, error: null }
  } catch (e: any) {
    return { data: null, error: mapFirebaseError(e.code) }
  }
}

export async function fsSet(path: string, data: DocumentData): Promise<{ error: string | null }> {
  try {
    await withTimeout(setDoc(doc(db, path), { ...sanitize(data), updatedAt: serverTimestamp() }))
    return { error: null }
  } catch (e: any) {
    console.error('[fsSet] error:', e?.code, e?.message, 'path:', path)
    return { error: mapFirebaseError(e.code) }
  }
}

export async function fsUpdate(path: string, data: Partial<DocumentData>): Promise<{ error: string | null }> {
  try {
    await withTimeout(updateDoc(doc(db, path), { ...sanitize(data as Record<string, any>), updatedAt: serverTimestamp() }))
    return { error: null }
  } catch (e: any) {
    return { error: mapFirebaseError(e.code) }
  }
}

export async function fsAdd(colPath: string, data: DocumentData): Promise<{ id: string | null; error: string | null }> {
  try {
    const ref = await withTimeout(addDoc(collection(db, colPath), {
      ...sanitize(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }))
    return { id: ref.id, error: null }
  } catch (e: any) {
    return { id: null, error: mapFirebaseError(e.code) }
  }
}

export async function fsQuery<T>(
  colPath: string,
  constraints: QueryConstraint[]
): Promise<{ data: T[]; error: string | null }> {
  try {
    const q = query(collection(db, colPath), ...constraints)
    const snap = await getDocs(q)
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as T[]
    return { data, error: null }
  } catch (e: any) {
    return { data: [], error: mapFirebaseError(e.code) }
  }
}

export function fsSubscribe<T>(
  colPath: string,
  constraints: QueryConstraint[],
  onData: (data: T[]) => void,
  onError?: (error: string) => void
): () => void {
  const q = query(collection(db, colPath), ...constraints)
  return onSnapshot(
    q,
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as T[]
      onData(data)
    },
    err => onError?.(mapFirebaseError(err.code))
  )
}

// Firestore Timestamp → Date 변환 헬퍼
export function toDate(value: any): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return new Date(value)
}

export async function fsDelete(path: string): Promise<{ error: string | null }> {
  try {
    await withTimeout(deleteDoc(doc(db, path)))
    return { error: null }
  } catch (e: any) {
    return { error: mapFirebaseError(e.code) }
  }
}

export { where, orderBy, serverTimestamp }
