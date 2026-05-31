// 천하제일 주간 대회 — Firestore 헬퍼
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../config'
import { fsGet, fsSet, fsAdd, fsSubscribe, orderBy } from '../firestore'
import type { GameId } from './gameScores'

export interface TournamentSettings {
  active:      boolean
  title:       string
  roundNumber: number   // 대회 회차 (건별 진행)
  startDate:   string   // YYYY-MM-DD
  endDate:     string
  difficulty:  number   // 1–5 (게임 난이도 배율)
}

export interface TournamentScore {
  id:          string
  roundNumber: number
  memberId:    string
  memberName:  string
  gameId:      GameId
  score:       number
  playedAt:    Date
}

const CFG_PATH = (fid: string) => `families/${fid}/config/tournament`
const SC_COL   = (fid: string) => `families/${fid}/tournament_scores`

export async function getTournamentSettings(
  familyId: string
): Promise<TournamentSettings | null> {
  const { data } = await fsGet<TournamentSettings>(CFG_PATH(familyId))
  return data
}

export async function saveTournamentSettings(
  familyId: string,
  settings: TournamentSettings
): Promise<{ error: string | null }> {
  return fsSet(CFG_PATH(familyId), settings as unknown as Record<string, unknown>)
}

// 단일 문서 실시간 구독 (fsSubscribe는 컬렉션 전용이므로 직접 onSnapshot 사용)
export function subscribeTournamentSettings(
  familyId: string,
  onData: (s: TournamentSettings | null) => void
): () => void {
  return onSnapshot(
    doc(db, CFG_PATH(familyId)),
    snap => onData(snap.exists() ? (snap.data() as TournamentSettings) : null)
  )
}

export async function saveTournamentScore(
  familyId:    string,
  roundNumber: number,
  memberId:    string,
  memberName:  string,
  gameId:      GameId,
  score:       number
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(SC_COL(familyId), {
    roundNumber, memberId, memberName, gameId, score,
  })
  return { error }
}

// 전체 대회 점수 구독 (클라이언트에서 회차 필터)
export function subscribeTournamentScores(
  familyId: string,
  onData: (scores: TournamentScore[]) => void
): () => void {
  return fsSubscribe<TournamentScore & { playedAt: any }>(
    SC_COL(familyId),
    [orderBy('score', 'desc')],
    raw => onData(raw.map(r => ({ ...r, playedAt: r.playedAt?.toDate?.() ?? new Date() })))
  )
}
