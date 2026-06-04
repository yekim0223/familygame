import { orderBy } from 'firebase/firestore'
import { fsAdd, fsSubscribe } from '../firestore'

export type GameId = 'galaga' | 'ponpoko' | 'minesweeper' | 'whacamole' | 'sudoku'

export interface GameScore {
  id: string
  memberId: string
  memberName: string
  gameId: GameId
  score: number
  playedAt: Date
}

const col = (fid: string) => `families/${fid}/game_scores`

export async function saveGameScore(
  familyId: string,
  memberId: string,
  memberName: string,
  gameId: GameId,
  score: number
): Promise<{ id: string | null; error: string | null }> {
  return fsAdd(col(familyId), { memberId, memberName, gameId, score })
}

// 전체 게임 점수 구독 — 클라이언트에서 게임별 필터링 (인덱스 불필요)
export function subscribeAllGameScores(
  familyId: string,
  onData: (scores: GameScore[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [orderBy('score', 'desc')],
    raw => onData(
      raw.map(r => ({
        ...r,
        playedAt: r.playedAt?.toDate?.() ?? new Date(),
      }))
    )
  )
}
