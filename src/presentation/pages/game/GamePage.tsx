// GamePage — 레트로 게임 허브 (선택 → 플레이 → 결과 → 랭킹)
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'
import { saveGameScore, subscribeAllGameScores } from '@/infrastructure/firebase/collections/gameScores'
import {
  subscribeTournamentSettings, saveTournamentScore, subscribeTournamentScores,
  type TournamentSettings, type TournamentScore,
} from '@/infrastructure/firebase/collections/tournament'
import { sendMessage } from '@/infrastructure/firebase/collections/messages'
import type { GameScore, GameId } from '@/infrastructure/firebase/collections/gameScores'
import { GalagaGame } from './GalagaGame'
import { PonpokoGame } from './PonpokoGame'
import { MinesweeperGame } from './MinesweeperGame'

// ── 게임 메타 ────────────────────────────────────────────────────────
const GAME_META: Record<GameId, { label: string; emoji: string; desc: string; color: string }> = {
  galaga:      { label: '갤러그',   emoji: '🚀', desc: '우주 전투기! 적을 격파하라',      color: 'border-sky' },
  ponpoko:     { label: '너구리',   emoji: '🦝', desc: '장애물을 피하며 멀리 달려라',     color: 'border-approved' },
  minesweeper: { label: '지뢰찾기', emoji: '💣', desc: '지뢰를 피하고 안전 구역을 열어라', color: 'border-gold' },
}

const RANK_MEDAL = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'] as const

// ── 랭킹 위젯 ───────────────────────────────────────────────────────
function RankingWidget({ scores, gameId, myId }: {
  scores: GameScore[]; gameId: GameId; myId: string
}) {
  const top5 = scores
    .filter(s => s.gameId === gameId)
    .reduce<GameScore[]>((acc, s) => {
      if (!acc.find(x => x.memberId === s.memberId)) acc.push(s)
      return acc
    }, [])
    .slice(0, 5)

  if (top5.length === 0) {
    return (
      <div className="card-pixel p-4 text-center">
        <p className="font-korean text-sm text-panel-sub">아직 기록이 없어요!</p>
        <p className="font-korean text-xs text-cream/40 mt-1">첫 번째로 도전해보세요 🎮</p>
      </div>
    )
  }

  return (
    <div className="card-pixel p-3">
      <p className="font-korean text-sm font-bold text-gold t-pixel-shadow mb-3">🏆 가족 랭킹</p>
      <div className="flex flex-col gap-2">
        {top5.map((s, idx) => (
          <div key={s.id}
            className={`flex items-center gap-3 px-2 py-1.5 border-2
              ${s.memberId === myId ? 'border-gold bg-gold/10' : 'border-panel-border bg-panel-darkest'}`}>
            <span className="text-lg flex-shrink-0 w-7">{RANK_MEDAL[idx]}</span>
            <span className={`font-korean text-sm font-bold flex-1 truncate
              ${s.memberId === myId ? 'text-gold' : 'text-cream'}`}>
              {s.memberName}
            </span>
            <span className="font-pixel text-xs text-gold flex-shrink-0">
              {s.score.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 대회 랭킹 위젯 ───────────────────────────────────────────────────
function TournamentRankWidget({ scores, roundNumber, myId }: {
  scores: TournamentScore[]; roundNumber: number; myId: string
}) {
  const top5 = scores
    .filter(s => s.roundNumber === roundNumber)
    .reduce<TournamentScore[]>((acc, s) => {
      if (!acc.find(x => x.memberId === s.memberId && x.gameId === s.gameId)) acc.push(s)
      return acc
    }, [])
    .slice(0, 5)

  if (top5.length === 0) {
    return <p className="font-korean text-xs text-panel-sub text-center py-2">아직 대회 기록 없음</p>
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      {top5.map((s, idx) => (
        <div key={s.id}
          className={`flex items-center gap-2 px-2 py-1 border
            ${s.memberId === myId ? 'border-gold bg-gold/10' : 'border-panel-border'}`}>
          <span className="text-sm flex-shrink-0">{RANK_MEDAL[idx]}</span>
          <span className={`font-korean text-xs flex-1 truncate ${s.memberId === myId ? 'text-gold font-bold' : 'text-cream'}`}>
            {s.memberName} <span className="text-panel-sub">({GAME_META[s.gameId]?.emoji ?? '🎮'})</span>
          </span>
          <span className="font-pixel text-xs text-gold flex-shrink-0">{s.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ── 결과 화면 ───────────────────────────────────────────────────────
function ResultScreen({ score, gameId, allScores, myId, onPlayAgain, onBack, tournament }: {
  score: number; gameId: GameId; allScores: GameScore[]
  myId: string; onPlayAgain: () => void; onBack: () => void
  tournament: TournamentSettings | null
}) {
  const meta = GAME_META[gameId]
  const gameScores = allScores
    .filter(s => s.gameId === gameId)
    .reduce<GameScore[]>((acc, s) => {
      if (!acc.find(x => x.memberId === s.memberId)) acc.push(s)
      return acc
    }, [])
  const myRank = gameScores.findIndex(s => s.memberId === myId && s.score <= score) + 1

  return (
    <div className="flex flex-col h-full bg-panel-darkest overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        {/* 게임 오버 헤더 */}
        <div className="card-pixel p-4 text-center border-rejected/60">
          <p className="font-pixel text-lg text-rejected" style={{ textShadow: '2px 2px 0 #000' }}>GAME OVER</p>
          <p className="font-korean text-sm text-panel-sub mt-1">{meta.emoji} {meta.label}</p>
          <p className="font-pixel text-3xl text-gold mt-2" style={{ textShadow: '2px 2px 0 #000' }}>
            {score.toLocaleString()}
          </p>
          <p className="font-korean text-xs text-panel-sub mt-1">점</p>
          {myRank > 0 && (
            <p className="font-pixel text-sm text-approved mt-2">{RANK_MEDAL[myRank - 1]} {myRank}위</p>
          )}
          {tournament?.active && (
            <div className="mt-3 border border-gold/50 bg-gold/10 px-3 py-1.5">
              <p className="font-pixel text-xs text-gold">🏆 대회 점수로도 기록됨!</p>
              <p className="font-korean text-xs text-panel-sub">{tournament.title} 제{tournament.roundNumber}회</p>
            </div>
          )}
        </div>

        {/* 랭킹 */}
        <RankingWidget scores={allScores} gameId={gameId} myId={myId} />

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <button type="button" onClick={onBack}
            className="flex-1 py-3 font-korean text-sm font-bold text-cream
                       border-4 border-panel-border bg-panel-dark active:bg-panel-mid">
            ← 선택으로
          </button>
          <button type="button" onClick={onPlayAgain}
            className="flex-1 py-3 font-pixel text-sm text-gold
                       border-4 border-gold bg-panel-dark active:bg-gold/20"
            style={{ textShadow: '1px 1px 0 #000' }}>
            RETRY
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 게임 선택 화면 ─────────────────────────────────────────────────
function GameSelection({ allScores, myId, onSelect, tournament, tournamentScores }: {
  allScores: GameScore[]; myId: string; onSelect: (id: GameId) => void
  tournament: TournamentSettings | null; tournamentScores: TournamentScore[]
}) {
  return (
    <div className="flex flex-col h-full bg-panel-darkest overflow-y-auto">
      {/* 대회 HUD 배너 */}
      {tournament?.active && (
        <div className="mx-4 mt-4 border-4 border-gold bg-gold/10 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏆</span>
            <p className="font-pixel text-xs text-gold t-pixel-shadow">주간 가족 매치 가동 중!</p>
            <span className="font-korean text-xs text-panel-sub ml-auto">제{tournament.roundNumber}회</span>
          </div>
          <p className="font-korean text-sm font-bold text-cream">{tournament.title}</p>
          <p className="font-korean text-xs text-panel-sub">
            {tournament.startDate} ~ {tournament.endDate}
            {' · '}난이도 {'★'.repeat(tournament.difficulty)}{'☆'.repeat(5 - tournament.difficulty)}
          </p>
          <TournamentRankWidget scores={tournamentScores} roundNumber={tournament.roundNumber} myId={myId} />
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <p className="t-title text-gold">🎮 게임</p>
        <p className="font-korean text-sm text-panel-sub mt-1">가족과 함께 경쟁해봐요!</p>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {(Object.entries(GAME_META) as [GameId, typeof GAME_META[GameId]][]).map(([id, meta]) => {
          const top = allScores
            .filter(s => s.gameId === id)
            .reduce<GameScore[]>((acc, s) => {
              if (!acc.find(x => x.memberId === s.memberId)) acc.push(s)
              return acc
            }, [])
          const myBest = allScores.filter(s => s.gameId === id && s.memberId === myId)
            .reduce((max, s) => Math.max(max, s.score), 0)
          const leader = top[0]

          return (
            <button key={id} type="button" onClick={() => onSelect(id)}
              className={`card-pixel flex items-center gap-4 p-4 text-left
                         border-2 ${meta.color} active:opacity-80 transition-opacity`}>
              <div className="text-4xl flex-shrink-0">{meta.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="font-korean text-base font-bold text-cream">{meta.label}</p>
                <p className="font-korean text-xs text-panel-sub mt-0.5">{meta.desc}</p>
                <div className="flex items-center gap-3 mt-2">
                  {myBest > 0 && (
                    <span className="font-pixel text-xs text-gold">나: {myBest.toLocaleString()}</span>
                  )}
                  {leader && (
                    <span className="font-korean text-xs text-approved">
                      🏆 {leader.memberName} {leader.score.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <span className="font-pixel text-gold text-lg flex-shrink-0">▶</span>
            </button>
          )
        })}
      </div>

      {/* 전체 랭킹 */}
      {allScores.length > 0 && (
        <div className="px-4 pb-6 flex flex-col gap-4">
          <p className="t-heading text-gold">최근 기록</p>
          {(Object.keys(GAME_META) as GameId[]).map(id => (
            <div key={id}>
              <p className="font-korean text-sm font-bold text-panel-sub mb-2">
                {GAME_META[id].emoji} {GAME_META[id].label}
              </p>
              <RankingWidget scores={allScores} gameId={id} myId={myId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 메인 GamePage ────────────────────────────────────────────────────
type PageView = 'selection' | 'playing' | 'result'

export default function GamePage() {
  const { familyId, currentMember } = useAuthStore()
  const addGameXP = useInventoryStore(state => state.addGameXP)
  const myId   = currentMember?.id   ?? ''
  const myName = currentMember?.name ?? '가족'

  const [view,          setView]          = useState<PageView>('selection')
  const [selectedGame,  setSelectedGame]  = useState<GameId>('galaga')
  const [finalScore,    setFinalScore]    = useState(0)
  const [allScores,     setAllScores]     = useState<GameScore[]>([])
  const [tournament,    setTournament]    = useState<TournamentSettings | null>(null)
  const [tournamentScs, setTournamentScs] = useState<TournamentScore[]>([])

  // 전체 게임 점수 구독
  useEffect(() => {
    if (!familyId) return
    return subscribeAllGameScores(familyId, setAllScores)
  }, [familyId])

  // 대회 설정 구독
  useEffect(() => {
    if (!familyId) return
    return subscribeTournamentSettings(familyId, setTournament)
  }, [familyId])

  // 대회 점수 구독
  useEffect(() => {
    if (!familyId) return
    return subscribeTournamentScores(familyId, setTournamentScs)
  }, [familyId])

  const handleSelect = (id: GameId) => {
    setSelectedGame(id)
    setView('playing')
  }

  const handleGameOver = useCallback(async (score: number) => {
    setFinalScore(score)
    setView('result')

    // XP 적립 (1,000점당 10XP)
    addGameXP(score)

    if (!familyId || !myId) return

    // 점수 저장
    await saveGameScore(familyId, myId, myName, selectedGame, score)

    // 대회 점수 별도 저장
    if (tournament?.active) {
      await saveTournamentScore(familyId, tournament.roundNumber, myId, myName, selectedGame, score)
    }

    // 개인 최고 기록 확인
    const prevBest = allScores
      .filter(s => s.gameId === selectedGame && s.memberId === myId)
      .reduce((max, s) => Math.max(max, s.score), 0)
    const isNewPersonalBest = score > prevBest

    // 1위 추월 여부
    const topScoresForGame = allScores
      .filter(s => s.gameId === selectedGame)
      .reduce<GameScore[]>((acc, s) => {
        if (!acc.find(x => x.memberId === s.memberId)) acc.push(s)
        return acc
      }, [])
    const currentTop = topScoresForGame[0]
    const isNewTop   = !currentTop || score > currentTop.score
    const dethroned  = currentTop && currentTop.memberId !== myId && isNewTop

    // 채팅 알림
    const meta = GAME_META[selectedGame]
    if (isNewPersonalBest || isNewTop) {
      let msg = ''
      if (dethroned && currentTop) {
        msg = `[🎮 게임 알림] ⚡ ${myName}이(가) ${meta.label} 게임에서 ${score.toLocaleString()}점으로 ${currentTop.memberName}을(를) 제치고 1위를 탈환했습니다!`
      } else if (isNewTop && !currentTop) {
        msg = `[🎮 게임 알림] 🎉 ${myName}이(가) ${meta.label} 게임에서 ${score.toLocaleString()}점으로 첫 기록을 세웠습니다!`
      } else if (isNewPersonalBest) {
        msg = `[🎮 게임 알림] ✨ ${myName}이(가) ${meta.label} 게임에서 개인 최고 기록 ${score.toLocaleString()}점을 경신했습니다!`
      }
      if (msg) await sendMessage(familyId, myId, msg, null)
    }
  }, [familyId, myId, myName, selectedGame, allScores, tournament, addGameXP])

  const handlePlayAgain = () => setView('playing')
  const handleBack      = () => setView('selection')

  // ── 플레이 중 대회 HUD 오버레이 ────────────────────────────────────
  const TournamentHUD = tournament?.active ? (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center justify-center gap-2 bg-gold/20 border-b-2 border-gold px-3 py-1">
        <span className="font-pixel text-[10px] text-gold t-pixel-shadow">
          🏆 주간 가족 매치 가동 중! — {tournament.title} 제{tournament.roundNumber}회
        </span>
      </div>
    </div>
  ) : null

  // ── 렌더 ──────────────────────────────────────────────────────────
  if (view === 'playing') {
    const commonProps = { onGameOver: handleGameOver, onBack: handleBack }
    return (
      <div className="h-[calc(100vh-112px)] overflow-hidden relative">
        {TournamentHUD}
        {selectedGame === 'galaga'      && <GalagaGame      {...commonProps} />}
        {selectedGame === 'ponpoko'     && <PonpokoGame     {...commonProps} />}
        {selectedGame === 'minesweeper' && <MinesweeperGame {...commonProps} />}
      </div>
    )
  }

  if (view === 'result') {
    return (
      <div className="h-[calc(100vh-112px)] overflow-hidden">
        <ResultScreen
          score={finalScore}
          gameId={selectedGame}
          allScores={allScores}
          myId={myId}
          onPlayAgain={handlePlayAgain}
          onBack={handleBack}
          tournament={tournament}
        />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-112px)] overflow-hidden">
      <GameSelection
        allScores={allScores}
        myId={myId}
        onSelect={handleSelect}
        tournament={tournament}
        tournamentScores={tournamentScs}
      />
    </div>
  )
}
