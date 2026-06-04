// GamePage — 레트로 게임 허브 (선택 → 플레이 → 결과 → 랭킹)
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'
import { saveGameScore, subscribeAllGameScores } from '@/infrastructure/firebase/collections/gameScores'
import { updateMember, getMember } from '@/infrastructure/firebase/collections/members'
import { getLevelFromExp } from '@/domain/services/ExpCalc'
import { recordXPReward } from '@/infrastructure/firebase/collections/rewards'
import {
  subscribeTournamentSettings, saveTournamentScore, subscribeTournamentScores,
  type TournamentSettings, type TournamentScore,
} from '@/infrastructure/firebase/collections/tournament'
import type { GameScore, GameId } from '@/infrastructure/firebase/collections/gameScores'
import { GalagaGame } from './GalagaGame'
import { PonpokoGame } from './PonpokoGame'
import { MinesweeperGame } from './MinesweeperGame'
import { WhacAMoleGame } from './WhacAMoleGame'
import { SudokuGame, SudokuLevelSelect } from './SudokuGame'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { EffectOverlay } from '@/presentation/components/effects/EffectOverlay'
import type { EffectType } from '@/presentation/components/effects/EffectOverlay'
import { audioManager } from '@/infrastructure/audio/audioManager'

// ── 게임 메타 (gameId 절대 불변 — Firebase 저장 키) ─────────────────
const GAME_META: Record<GameId, { label: string; icon: string; desc: string; color: string }> = {
  galaga:      { label: '갤러그',     icon: '/assets/icons/gamepad.svg',          desc: '뿅뿅 미사일을 피하고 득템하라',   color: 'border-sky' },
  ponpoko:     { label: '슈퍼점핑',   icon: '',  /* dynamic: charSvgUrl */          desc: '내 캐릭터로 즐기는 슈퍼점프', color: 'border-approved' },
  minesweeper: { label: '마이펫 찾기',icon: '',  /* dynamic: petSvgUrl */           desc: '깃발 꽂고 마이펫을 찾아라! 폭탄 주의',              color: 'border-gold' },
  whacamole:   { label: '아빠 잡기',  icon: '/assets/characters/base-dad.svg',    desc: '신나는 아빠잡기 엄마를 잡으면 보너스', color: 'border-pink' },
  sudoku:      { label: '언도쿠',     icon: '/assets/pets/dino.svg',              desc: '스도쿠보다 언도쿠가 제맛. 우리가족 두뇌게임',     color: 'border-purple' },
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
            {s.memberName} <span className="text-panel-sub">({GAME_META[s.gameId]?.label ?? '게임'})</span>
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
  const myRank = gameScores.filter(s => s.score > score).length + 1

  // 1위 달성 시 엄마 슈웅 Congratulation (랜덤 사선)
  const [showCongrats, setShowCongrats] = useState(false)
  const [momAnim] = useState(() => {
    const opts = ['swoosh-rl', 'swoosh-rl-down', 'swoosh-rl-up']
    return opts[Math.floor(Math.random() * opts.length)]
  })
  const [momY] = useState(() => Math.floor(Math.random() * 50 + 20) + '%')

  useEffect(() => {
    if (myRank === 1 && score > 0) {
      const t = setTimeout(() => {
        setShowCongrats(true)
        setTimeout(() => setShowCongrats(false), 2100)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [myRank, score])

  return (
    <div className="relative flex flex-col h-full bg-panel-darkest overflow-y-auto">
      {showCongrats && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
          <div style={{ animation: `${momAnim} 2s ease-in forwards`, position: 'absolute', top: momY, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', right: 0 }}>
            <span className="font-korean text-lg font-bold text-pink" style={{ textShadow: '2px 2px 0 #000' }}>Congratulation ❤️</span>
            <img src="/assets/characters/base-mom.svg" width={56} height={56}
              style={{ imageRendering: 'pixelated' }} alt="mom" />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4 p-4">
        {/* 게임 오버 헤더 */}
        <div className="card-pixel p-4 text-center border-rejected/60">
          <p className="font-pixel text-lg text-rejected" style={{ textShadow: '2px 2px 0 #000' }}>GAME OVER</p>
          <p className="font-korean text-sm text-panel-sub mt-1">{meta.label}</p>
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
          <PixelButton variant="ghost" fullWidth fontMode="pixel" onClick={onBack}>BACK</PixelButton>
          <PixelButton variant="gold" fullWidth fontMode="pixel" onClick={onPlayAgain}>RETRY</PixelButton>
        </div>
      </div>
    </div>
  )
}

// ── 게임 선택 화면 ─────────────────────────────────────────────────
function GameSelection({ allScores, myId, onSelect, tournament, tournamentScores, charSvgUrl, petSvgUrl }: {
  allScores: GameScore[]; myId: string; onSelect: (id: GameId) => void
  tournament: TournamentSettings | null; tournamentScores: TournamentScore[]
  charSvgUrl: string; petSvgUrl: string
}) {
  // 게임별 아이콘 SVG URL (ponpoko/minesweeper는 동적)
  const gameIconUrl = (id: GameId): string => {
    if (id === 'ponpoko')     return charSvgUrl
    if (id === 'minesweeper') return petSvgUrl
    return GAME_META[id].icon
  }

  return (
    <div className="flex flex-col h-full bg-panel-darkest overflow-y-auto">
      {/* 대회 HUD 배너 */}
      {tournament?.active && (
        <div className="mx-4 mt-4 border-4 border-gold bg-gold/10 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <img src="/assets/icons/trophy.svg" width={20} height={20} style={{ imageRendering: 'pixelated' }} />
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
        <div className="flex items-center gap-2">
          <img src="/assets/icons/gamepad.svg" width={24} height={24} style={{ imageRendering: 'pixelated' }} />
          <p className="t-title text-gold">게임</p>
        </div>
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
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                <img src={gameIconUrl(id)} alt={meta.label} draggable={false}
                  style={{ width: 44, height: 44, imageRendering: 'pixelated', objectFit: 'contain' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-korean text-base font-bold text-cream">{meta.label}</p>
                <p className="font-korean text-xs text-panel-sub mt-0.5">{meta.desc}</p>
                <div className="flex items-center gap-3 mt-2">
                  {myBest > 0 && (
                    <span className="font-pixel text-xs text-gold">나: {myBest.toLocaleString()}</span>
                  )}
                  {leader && (
                    <span className="font-korean text-xs text-approved">
                      <img src="/assets/icons/trophy.svg" alt="" width={12} height={12}
                        style={{ imageRendering: 'pixelated', display: 'inline', verticalAlign: 'middle' }} />
                      {' '}{leader.memberName} {leader.score.toLocaleString()}
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
              <div className="flex items-center gap-2 mb-2">
                <img src={gameIconUrl(id)} alt="" width={16} height={16}
                  style={{ imageRendering: 'pixelated', objectFit: 'contain' }} />
                <p className="font-korean text-sm font-bold text-panel-sub">{GAME_META[id].label}</p>
              </div>
              <RankingWidget scores={allScores} gameId={id} myId={myId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 메인 GamePage ────────────────────────────────────────────────────
type PageView = 'selection' | 'countdown' | 'playing' | 'result' | 'sudoku-level' | 'sudoku-playing'

export default function GamePage() {
  const { familyId, currentMember } = useAuthStore()
  const addGameXP = useInventoryStore(state => state.addGameXP)
  const myId   = currentMember?.id   ?? ''
  const myName = currentMember?.name ?? '가족'

  // 캐릭터/펫 SVG URL (게임 에셋 연동, 미설정 시 기본값)
  const charSvgUrl = `/assets/characters/${currentMember?.character.characterId || 'base-observer'}.svg`
  const petSvgUrl  = `/assets/pets/${currentMember?.character.petId || 'cat'}.svg`
  const dadSvgUrl  = '/assets/characters/base-dad.svg'

  const [view,          setView]          = useState<PageView>('selection')
  const [selectedGame,  setSelectedGame]  = useState<GameId>('galaga')
  const [sudokuLevel,   setSudokuLevel]   = useState(1)
  const [sudokuGameKey, setSudokuGameKey] = useState(0)   // 진입마다 +1 → 새 퍼즐 보장
  const [countdownNum,  setCountdownNum]  = useState(3)
  const [finalScore,    setFinalScore]    = useState(0)
  const [allScores,     setAllScores]     = useState<GameScore[]>([])
  const [tournament,    setTournament]    = useState<TournamentSettings | null>(null)
  const [tournamentScs, setTournamentScs] = useState<TournamentScore[]>([])
  const [resultEffect,  setResultEffect]  = useState<{ type: EffectType; label?: string } | null>(null)
  const [showRecordBanner, setShowRecordBanner] = useState<string | null>(null)

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
    if (id === 'sudoku') { setView('sudoku-level'); return }
    setCountdownNum(3)
    setView('countdown')
  }

  const handleSudokuLevelSelect = (lv: number) => {
    setSudokuLevel(lv)
    setSudokuGameKey(k => k + 1)   // 매번 새 key → SudokuGame 새로 마운트 → 랜덤 문제
    setView('sudoku-playing')
  }

  // 카운트다운 3→2→1→GO! → playing 자동 전환
  useEffect(() => {
    if (view !== 'countdown') return
    audioManager.keyClick()
    const t1 = setTimeout(() => { setCountdownNum(2); audioManager.keyClick() }, 1000)
    const t2 = setTimeout(() => { setCountdownNum(1); audioManager.keyClick() }, 2000)
    const t3 = setTimeout(() => { setCountdownNum(0); audioManager.slotApproval() }, 3000)
    const t4 = setTimeout(() => setView('playing'), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [view])

  const handleGameOver = useCallback(async (score: number) => {
    setFinalScore(score)
    setView('result')

    // XP 적립 (1,000점당 10XP)
    addGameXP(score)

    if (!familyId || !myId) return

    // T4+T5 이펙트 판정 (저장 전 현재 allScores 기준)
    const gameScores = allScores.filter(s => s.gameId === selectedGame)
    const myBest = gameScores
      .filter(s => s.memberId === myId)
      .reduce((max, s) => Math.max(max, s.score), 0)
    const rank1Score = gameScores.reduce((max, s) => Math.max(max, s.score), 0)

    if (score > rank1Score) {
      // 가족 1등 탈환 — XP +10
      setResultEffect({ type: 'confetti', label: '🏆 가족 1위!' })
      setShowRecordBanner('🏆 FAMILY #1!')
      if (familyId && myId) {
        const { data: me } = await getMember(familyId, myId)
        if (me) {
          const newExp   = (me.exp ?? 0) + 10
          const newLevel = getLevelFromExp(newExp)
          await updateMember(familyId, myId, { exp: newExp, level: newLevel } as any)
          await recordXPReward(familyId, myId, 10, 'xp_game',
            `게임 1위 탈환: ${GAME_META[selectedGame]?.label ?? selectedGame}`, familyId)
        }
      }
    } else if (score > myBest) {
      // 개인 신기록
      setResultEffect({ type: 'stars', label: 'NEW RECORD' })
      setShowRecordBanner('⭐ NEW RECORD!')
    }

    // 점수 저장
    await saveGameScore(familyId, myId, myName, selectedGame, score)

    // 대회 점수 별도 저장
    if (tournament?.active) {
      await saveTournamentScore(familyId, tournament.roundNumber, myId, myName, selectedGame, score)
    }

  }, [familyId, myId, myName, selectedGame, tournament, addGameXP, allScores])

  const handlePlayAgain = () => {
    if (selectedGame === 'sudoku') { setView('sudoku-playing'); return }
    setView('playing')
  }
  const handleBack = () => setView('selection')

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
  if (view === 'sudoku-level') {
    return (
      <div className="h-[calc(100vh-112px)] overflow-hidden">
        <SudokuLevelSelect onSelect={handleSudokuLevelSelect} />
      </div>
    )
  }

  if (view === 'sudoku-playing') {
    return (
      <div className="h-[calc(100vh-112px)] overflow-hidden">
        <SudokuGame
          key={sudokuGameKey}
          onGameOver={handleGameOver}
          onBack={handleBack}
          level={sudokuLevel}
          charId={currentMember?.character.characterId || 'base-observer'}
          petId={currentMember?.character.petId || null}
          role={currentMember?.role ?? 'CHILD'}
        />
      </div>
    )
  }

  if (view === 'countdown') {
    const meta = GAME_META[selectedGame]
    return (
      <div className="h-[calc(100vh-112px)] flex flex-col items-center justify-center bg-panel-darkest gap-6">
        <div className="flex items-center gap-3">
          <img src={GAME_META[selectedGame].icon || '/assets/icons/gamepad.svg'} alt={meta.label}
            draggable={false} style={{ width: 36, height: 36, imageRendering: 'pixelated', objectFit: 'contain' }} />
          <p className="font-pixel text-xs text-gold t-pixel-shadow">{meta.label}</p>
        </div>
        <div
          key={countdownNum}
          className="font-pixel text-gold animate-pulse"
          style={{ fontSize: '96px', lineHeight: 1, textShadow: '4px 4px 0 #000' }}
        >
          {countdownNum === 0 ? 'GO!' : countdownNum}
        </div>
        <p className="font-pixel text-xs text-panel-sub">준비하세요!</p>
      </div>
    )
  }

  if (view === 'playing') {
    return (
      <div className="h-[calc(100vh-112px)] overflow-hidden relative">
        {TournamentHUD}
        {selectedGame === 'galaga'      && <GalagaGame      onGameOver={handleGameOver} onBack={handleBack} />}
        {selectedGame === 'ponpoko'     && <PonpokoGame     onGameOver={handleGameOver} onBack={handleBack} charSvgUrl={charSvgUrl} />}
        {selectedGame === 'minesweeper' && <MinesweeperGame onGameOver={handleGameOver} onBack={handleBack} petSvgUrl={petSvgUrl} />}
        {selectedGame === 'whacamole'   && <WhacAMoleGame   onGameOver={handleGameOver} onBack={handleBack} dadSvgUrl={dadSvgUrl} momSvgUrl="/assets/characters/base-mom.svg" />}
      </div>
    )
  }

  if (view === 'result') {
    return (
      <div className="h-[calc(100vh-112px)] overflow-hidden relative">
        {resultEffect && (
          <EffectOverlay
            type={resultEffect.type}
            count={resultEffect.type === 'confetti' ? 30 : 24}
            onEnd={() => setResultEffect(null)}
          />
        )}
        {showRecordBanner && (
          <div className="absolute top-6 left-0 right-0 z-[9991] flex justify-center pointer-events-none">
            <div
              className="animate-record-banner bg-panel-darkest border-2 border-gold px-6 py-2"
              onAnimationEnd={() => setShowRecordBanner(null)}
            >
              <p className="font-pixel text-gold t-pixel-shadow" style={{ fontSize: '18px' }}>
                {showRecordBanner}
              </p>
            </div>
          </div>
        )}
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
        charSvgUrl={charSvgUrl}
        petSvgUrl={petSvgUrl}
      />
    </div>
  )
}
