// 언도쿠 (Undoku) — 패밀리 두뇌 퍼즐
// Design Ref: docs/01-plan/features/sudoku-game.plan.md
// 5단계 난이도 | 생명 2개 | 시간 기반 점수 | 캐릭터+펫 반응 | 아빠 FIGHTING 슈웅
import { useState, useEffect, useRef, useCallback } from 'react'
import { audioManager } from '@/infrastructure/audio/audioManager'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { EffectOverlay } from '@/presentation/components/effects/EffectOverlay'
import type { EffectType } from '@/presentation/components/effects/EffectOverlay'
import type { Role } from '@/domain/entities/Member'

// ── 난이도 설정 ──────────────────────────────────────────────────────
export const SUDOKU_LEVELS = [
  { lv: 1, name: '입문',   stars: 1, hints: 50, timeSec: 900,  basePts: 500  },
  { lv: 2, name: '쉬움',   stars: 2, hints: 40, timeSec: 780,  basePts: 1000 },
  { lv: 3, name: '보통',   stars: 3, hints: 32, timeSec: 600,  basePts: 2000 },
  { lv: 4, name: '어려움', stars: 4, hints: 27, timeSec: 480,  basePts: 3500 },
  { lv: 5, name: '최고',   stars: 5, hints: 22, timeSec: -1,   basePts: 5000 }, // timeSec -1 = 가변
] as const

// Lv5 가변 타이머: 클리어 횟수마다 1분 감소 (최소 3분)
const LV5_LS_KEY = 'fq_sudoku_lv5_clears'
function getLv5Time(): number {
  const clears = parseInt(localStorage.getItem(LV5_LS_KEY) ?? '0', 10)
  return Math.max(180, 600 - clears * 60)
}
function incLv5Clears() {
  const n = parseInt(localStorage.getItem(LV5_LS_KEY) ?? '0', 10)
  localStorage.setItem(LV5_LS_KEY, String(n + 1))
}

// Lv별 최고점 저장
function getBest(lv: number) { return parseInt(localStorage.getItem(`fq_sudoku_best_lv${lv}`) ?? '0', 10) }
function saveBest(lv: number, score: number) {
  if (score > getBest(lv)) localStorage.setItem(`fq_sudoku_best_lv${lv}`, String(score))
}

// ── 퍼즐 생성 (백트래킹) ─────────────────────────────────────────────
type Board = (number | null)[][]

function emptyBoard(): Board { return Array.from({ length: 9 }, () => Array(9).fill(null)) }

function isValid(board: number[][], r: number, c: number, n: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === n || board[i][c] === n) return false
    const br = 3 * Math.floor(r / 3) + Math.floor(i / 3)
    const bc = 3 * Math.floor(c / 3) + (i % 3)
    if (board[br][bc] === n) return false
  }
  return true
}

function fillSolution(board: number[][], pos = 0): boolean {
  if (pos === 81) return true
  const r = Math.floor(pos / 9), c = pos % 9
  if (board[r][c] !== 0) return fillSolution(board, pos + 1)
  const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5)
  for (const n of nums) {
    if (isValid(board, r, c, n)) {
      board[r][c] = n
      if (fillSolution(board, pos + 1)) return true
      board[r][c] = 0
    }
  }
  return false
}

function generatePuzzle(hints: number): { puzzle: Board; solution: number[][] } {
  const sol = Array.from({ length: 9 }, () => Array(9).fill(0))
  fillSolution(sol)

  const puzzle = sol.map(row => [...row]) as number[][]
  let removed = 0
  const target = 81 - hints
  const cells = Array.from({ length: 81 }, (_, i) => i).sort(() => Math.random() - 0.5)

  for (const idx of cells) {
    if (removed >= target) break
    const r = Math.floor(idx / 9), c = idx % 9
    const bak = puzzle[r][c]
    puzzle[r][c] = 0
    removed++
    // 빠른 유일해 체크 생략 (성능 우선, 힌트 50개 이상이면 안전)
    if (hints >= 32 && removed > target) { puzzle[r][c] = bak; removed--; }
  }

  const result: Board = puzzle.map(row => row.map(v => v === 0 ? null : v))
  return { puzzle: result, solution: sol }
}

// ── 검증 함수 ────────────────────────────────────────────────────────
function checkValid(board: (number|null)[][], r: number, c: number, n: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (i !== c && board[r][i] === n) return false
    if (i !== r && board[i][c] === n) return false
    const br = 3 * Math.floor(r / 3) + Math.floor(i / 3)
    const bc = 3 * Math.floor(c / 3) + (i % 3)
    if ((br !== r || bc !== c) && board[br][bc] === n) return false
  }
  return true
}

// ── 점수 계산 ────────────────────────────────────────────────────────
function calcScore(basePts: number, timeLeft: number, totalTime: number, errors: number): number {
  const raw = Math.round(basePts * (1 + timeLeft / totalTime)) - errors * 50
  return Math.max(Math.round(basePts * 0.2), raw)
}

// ── Props ─────────────────────────────────────────────────────────────
export interface SudokuGameProps {
  onGameOver: (score: number) => void
  onBack?: () => void
  level?: number
  charId?: string
  petId?: string | null
  role?: Role
}

// ── 레벨 선택 화면 ───────────────────────────────────────────────────
const LV_CHARS = ['base-child-1', 'child-warrior', 'child-knight', 'child-dark-knight', 'child-divine-warrior']

export function SudokuLevelSelect({ onSelect }: { onSelect: (lv: number) => void }) {
  return (
    <div className="flex flex-col h-full bg-panel-darkest overflow-y-auto p-4 gap-3">
      <div className="text-center pt-2 pb-1">
        <p className="font-pixel text-lg text-gold t-pixel-shadow">언도쿠</p>
        <p className="font-korean text-sm text-panel-sub mt-1">난이도를 선택하세요</p>
      </div>
      {SUDOKU_LEVELS.map(lvl => {
        const best = getBest(lvl.lv)
        const lv5time = lvl.lv === 5 ? getLv5Time() : null
        const timeStr = lvl.lv === 5
          ? `${Math.floor((lv5time ?? 600) / 60)}분`
          : `${Math.floor(lvl.timeSec / 60)}분`
        return (
          <button key={lvl.lv} type="button" onClick={() => onSelect(lvl.lv)}
            className="card-pixel flex items-center gap-4 p-4 text-left active:opacity-80 transition-opacity
                       border-2 border-panel-border hover:border-gold/60">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
              <img src={`/assets/characters/${LV_CHARS[lvl.lv - 1]}.svg`} alt={lvl.name}
                style={{ width: 44, height: 44, imageRendering: 'pixelated', objectFit: 'contain' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-korean text-base font-bold text-cream">{lvl.name}</p>
                <span className="font-pixel text-xs text-gold">{'⭐'.repeat(lvl.stars)}</span>
              </div>
              <p className="font-korean text-xs text-panel-sub mt-0.5">
                힌트 {lvl.hints}개 · {timeStr} · 최대 {(lvl.basePts * 2).toLocaleString()}pts
              </p>
              {best > 0 && (
                <p className="font-pixel text-xs text-gold mt-1">최고: {best.toLocaleString()}</p>
              )}
            </div>
            <span className="font-pixel text-gold text-lg flex-shrink-0">▶</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 메인 게임 컴포넌트 ───────────────────────────────────────────────
export function SudokuGame({ onGameOver, onBack, level = 1, charId = 'base-observer', petId, role = 'CHILD' }: SudokuGameProps) {
  const lvl = SUDOKU_LEVELS.find(l => l.lv === level) ?? SUDOKU_LEVELS[0]
  const totalTime = lvl.lv === 5 ? getLv5Time() : lvl.timeSec

  // ── 상태 ────────────────────────────────────────────────────────
  const [puzzle,   setPuzzle]   = useState<Board>(() => emptyBoard())
  const [given,    setGiven]    = useState<boolean[][]>(() => Array.from({ length: 9 }, () => Array(9).fill(false)))
  const [errors,   setErrors]   = useState<boolean[][]>(() => Array.from({ length: 9 }, () => Array(9).fill(false)))
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [lives,    setLives]    = useState(3)
  const livesRef   = useRef(3)   // stale closure 방지용 — setLives와 항상 동기화
  const [errCount, setErrCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [phase,    setPhase]    = useState<'playing' | 'clear' | 'timeout'>('playing')
  const [score,    setScore]    = useState(0)
  const [charAnim, setCharAnim] = useState('')
  const [effect,   setEffect]   = useState<{ type: EffectType; key: number } | null>(null)
  const [paused,   setPaused]   = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [showFighting, setShowFighting] = useState(false)
  const [completedLines, setCompletedLines] = useState<Set<string>>(new Set())

  // 배경 SVG (5종 랜덤)
  const [bgTheme] = useState(() => {
    const themes = ['overworld', 'sky', 'mushroom', 'crystal-cave', 'aurora']
    return themes[Math.floor(Math.random() * themes.length)]
  })

  // 가족 방문객 (45초마다 등장, 4초 표시)
  type Visitor = { id: number; pos: number; msg: string; charSvg: string }
  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const visitorRef = useRef(0)

  // 응원 문구
  const CHEER_MSGS = [
    '파이팅! 🔥', '잘하고 있어 ✨', '집중해! 💪', '최고야 🌟',
    '거의 다 왔어!', '넌 할 수 있어 💖', '빈 칸 찾아봐 🔍', '조금만 더!',
  ]
  const VISITOR_CHARS = [
    '/assets/characters/base-dad.svg',
    '/assets/characters/base-mom.svg',
    '/assets/characters/base-child-1.svg',
    '/assets/characters/base-child-2.svg',
  ]
  // 방문객 위치: 그리드 주변 6곳 (숫자 = style position index)
  const VISITOR_POS_COUNT = 6

  const cbRef          = useRef(onGameOver)
  cbRef.current        = onGameOver
  const goCalledRef    = useRef(false)
  const pausedRef      = useRef(false)

  // 랜덤 슈웅 방향 (컴포넌트 mount 시 1회 결정)
  const [dadAnim]  = useState(() => {
    const opts = ['swoosh-lr', 'swoosh-lr-down', 'swoosh-lr-up']
    return opts[Math.floor(Math.random() * opts.length)]
  })
  const [dadY] = useState(() => Math.floor(Math.random() * 50 + 20) + '%')
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedTimeRef = useRef(totalTime)
  // 스테일 클로저 방지: solution을 ref로 즉시 참조
  const solutionRef  = useRef<number[][]>([])

  // ── 퍼즐 초기화 ─────────────────────────────────────────────────
  useEffect(() => {
    // 비동기로 UI 블로킹 방지 (Lv3~5 백트래킹 생성 시간)
    const t = setTimeout(() => {
      const { puzzle: p, solution: s } = generatePuzzle(lvl.hints)
      solutionRef.current = s   // ref 즉시 동기 업데이트
      setPuzzle(p)
      const g = p.map(row => row.map(v => v !== null))
      setGiven(g)
      setErrors(Array.from({ length: 9 }, () => Array(9).fill(false)))
      setTimeLeft(totalTime)
      savedTimeRef.current = totalTime
      setLoading(false)   // 준비 완료 → 입력 허용
    }, 0)

    // 아빠 FIGHTING 슈웅 (0.6초 후, 2초 지속)
    const t2 = setTimeout(() => {
      setShowFighting(true)
      setTimeout(() => setShowFighting(false), 2100)
    }, 600)

    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [])

  // ── 가족 방문객 타이머 (45초마다 1명 등장, 4초 후 사라짐) ────────
  useEffect(() => {
    if (phase !== 'playing') return
    const interval = setInterval(() => {
      if (paused || phase !== 'playing') return
      const pos  = Math.floor(Math.random() * VISITOR_POS_COUNT)
      const msg  = CHEER_MSGS[Math.floor(Math.random() * CHEER_MSGS.length)]
      const svg  = VISITOR_CHARS[Math.floor(Math.random() * VISITOR_CHARS.length)]
      const id   = ++visitorRef.current
      setVisitor({ id, pos, msg, charSvg: svg })
      setTimeout(() => setVisitor(v => v?.id === id ? null : v), 4000)
    }, 45000)
    return () => clearInterval(interval)
  }, [phase, paused])

  // ── 타이머 ───────────────────────────────────────────────────────
  // B2: goCalledRef로 타이머·생명 0 이중 호출 방지 (timeout 경로)
  const triggerGameOver = useCallback((score: number) => {
    if (goCalledRef.current) return
    goCalledRef.current = true
    setPhase('timeout')
    setCharAnim('dead')   // 종료 → 캐릭터 쓰러짐
    audioManager.gameOver()
    setTimeout(() => cbRef.current(score), 5000)
  }, [])

  useEffect(() => {
    if (phase !== 'playing' || paused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1
        if (next <= 0) {
          triggerGameOver(0)
          return 0
        }
        return next
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, paused, triggerGameOver])

  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setPaused(p => !p)
  }

  // ── 캐릭터 반응 트리거 ───────────────────────────────────────────
  const triggerAnim = useCallback((anim: string, dur = 600) => {
    setCharAnim(anim)
    setTimeout(() => setCharAnim(''), dur)
  }, [])

  // ── 완성 체크 (B1: 오답 셀도 미완성 처리) ───────────────────────
  const checkComplete = useCallback((board: Board, curErrors: boolean[][]) => {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!board[r][c] || curErrors[r]?.[c]) return false
    return true
  }, [])

  // ── 숫자 입력 ────────────────────────────────────────────────────
  const handleInput = useCallback((n: number | null) => {
    if (!selected || phase !== 'playing' || loading) return  // loading 가드
    const [r, c] = selected
    if (given[r]?.[c]) return

    const newBoard = puzzle.map(row => [...row])
    const newErrors = errors.map(row => [...row])
    newErrors[r][c] = false

    if (n === null) {
      newBoard[r][c] = null
      setPuzzle(newBoard)
      setErrors(newErrors)
      return
    }

    newBoard[r][c] = n
    const valid = checkValid(newBoard, r, c, n)

    // solutionRef.current 사용 — 스테일 클로저 없음
    if (!valid || n !== solutionRef.current[r]?.[c]) {
      // 오답
      newErrors[r][c] = true
      setErrors(newErrors)
      setPuzzle(newBoard)
      audioManager.playerHit()
      triggerAnim('wrong', 500)   // 오답 → 흔들기
      const newErrCount = errCount + 1
      setErrCount(newErrCount)
      livesRef.current -= 1          // ref는 항상 최신 (stale closure 없음)
      setLives(livesRef.current)
      if (livesRef.current <= 0) {
        triggerGameOver(0)   // B2: 이중 호출 방지
      }
    } else {
      // 정답
      setPuzzle(newBoard)
      setErrors(newErrors)
      audioManager.keyClick()
      triggerAnim('correct', 600)   // 정답 → 기쁨 점프

      // 행/열/블록 완성 체크
      const newCompleted = new Set(completedLines)
      let lineBonus = false
      if (newBoard[r].every(v => v !== null)) { newCompleted.add(`r${r}`); lineBonus = true }
      if (newBoard.every(row => row[c] !== null)) { newCompleted.add(`c${c}`); lineBonus = true }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
      let blockDone = true
      for (let i = br; i < br + 3; i++) for (let j = bc; j < bc + 3; j++) if (!newBoard[i][j]) { blockDone = false; break }
      if (blockDone) { newCompleted.add(`b${br}${bc}`); lineBonus = true }
      if (lineBonus) { setCompletedLines(newCompleted); audioManager.coinCollect() }

      // 퍼즐 완성 확인 (B1: newErrors도 전달해 오답 셀 있으면 완성 거부)
      if (checkComplete(newBoard, newErrors)) {
        const finalScore = calcScore(lvl.basePts, timeLeft, totalTime, errCount)
        setScore(finalScore)
        saveBest(lvl.lv, finalScore)
        if (lvl.lv === 5) incLv5Clears()
        audioManager.loginFanfare()
        setEffect({ type: 'confetti', key: Date.now() })
        triggerAnim('celebrate', 3000)   // 완성 → 신나는 셀레브레이션
        // B2: goCalledRef로 이중 호출 방지 (clear 경로)
        if (!goCalledRef.current) {
          goCalledRef.current = true
          setPhase('clear')
          setTimeout(() => cbRef.current(finalScore), 3500)
        }
      }
    }
  }, [selected, phase, given, puzzle, errors, loading, lives, errCount, completedLines, timeLeft, totalTime, lvl, triggerAnim, checkComplete, triggerGameOver])

  // ── 포맷 ─────────────────────────────────────────────────────────
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const timeRatio  = timeLeft / totalTime
  const timerColor = timeRatio > 0.4 ? 'text-approved' : timeRatio > 0.15 ? 'text-hold' : 'text-rejected animate-pulse'

  // ── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-full bg-panel-darkest select-none" style={{ touchAction: 'none' }}>

      {/* 아빠 FIGHTING 슈웅 오버레이 */}
      {showFighting && (
        <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
          <div style={{ animation: `${dadAnim} 2s ease-in forwards`, position: 'absolute', top: dadY, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <img src="/assets/characters/base-dad.svg" width={60} height={60}
              style={{ imageRendering: 'pixelated' }} alt="dad" />
            <span className="font-pixel text-xl text-gold" style={{ textShadow: '2px 2px 0 #000' }}>FIGHTING!!!</span>
          </div>
        </div>
      )}

      {/* 이펙트 오버레이 */}
      {effect && phase === 'clear' && (
        <EffectOverlay key={effect.key} type={effect.type} count={30} onEnd={() => setEffect(null)} />
      )}

      {/* 일시정지 오버레이 */}
      {paused && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/65">
          <p className="font-pixel text-2xl text-gold t-pixel-shadow">PAUSED</p>
          <p className="font-korean text-sm text-cream/70 mt-2">▶ 버튼으로 계속하기</p>
        </div>
      )}

      {/* 게임오버 / 완성 오버레이 */}
      {phase !== 'playing' && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-3
          ${phase === 'clear' ? 'bg-black/40' : 'bg-black/75'}`}>
          {phase === 'timeout' ? (
            <>
              <p className="font-pixel text-2xl text-rejected t-pixel-shadow">TIME OVER</p>
              <p className="font-korean text-sm text-panel-sub">오답: {errCount}개</p>
              <p className="font-korean text-xs text-panel-sub mt-1">결과 화면으로 이동 중...</p>
            </>
          ) : (
            <>
              <p className="font-pixel text-2xl text-gold t-pixel-shadow">CLEAR!</p>
              <p className="font-pixel text-3xl text-gold">{score.toLocaleString()}</p>
              <p className="font-korean text-xs text-panel-sub mt-1">결과 화면으로 이동 중...</p>
            </>
          )}
        </div>
      )}

      {/* HUD */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel-darkest border-b-2 border-gold/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`font-pixel text-sm ${timerColor}`}>{fmt(timeLeft)}</span>
          <span className="font-pixel text-xs text-panel-sub">|</span>
          <span className="font-pixel text-xs text-cream">{'♥'.repeat(lives)}{'♡'.repeat(3 - lives)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-pixel text-xs text-panel-sub">❌×{errCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-xs text-gold t-pixel-shadow">{'⭐'.repeat(lvl.stars)}</span>
          <button type="button" onClick={togglePause}
            className="min-w-[54px] h-9 px-2 bg-purple border-2 border-purple/60
                       flex items-center justify-center font-pixel text-xs text-white
                       active:scale-95 transition-transform">
            {paused ? '▶' : 'PAUSE'}
          </button>
          {onBack && (
            <button type="button" onClick={onBack}
              className="min-w-[54px] h-9 px-2 bg-rejected border-2 border-rejected/60
                         flex items-center justify-center font-pixel text-xs text-white
                         active:scale-95 transition-transform">
              EXIT
            </button>
          )}
        </div>
      </div>

      {/* 게임 영역: 그리드 + 캐릭터 */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-2 pb-1 pt-1 relative">

        {/* 랜덤 SVG 배경 */}
        <img src={`/assets/backgrounds/${bgTheme}.svg`} alt="" aria-hidden draggable={false}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ objectFit: 'cover', opacity: 0.2, imageRendering: 'pixelated' }} />

        {/* 9×9 그리드 */}
        <div className="grid gap-0" style={{ gridTemplateColumns: 'repeat(9, 1fr)', width: 'min(calc(100vw - 16px), 340px)' }}>
          {Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 9 }, (_, c) => {
              const val      = puzzle[r]?.[c]
              const isGiven  = given[r]?.[c]
              const isError  = errors[r]?.[c]
              const isSel    = selected?.[0] === r && selected?.[1] === c
              const isSameNum = val !== null && selected && puzzle[selected[0]]?.[selected[1]] === val && !isSel
              const isHighlightRow = selected && selected[0] === r && !isSel
              const isHighlightCol = selected && selected[1] === c && !isSel
              const isHighlightBox = selected && Math.floor(r/3) === Math.floor(selected[0]/3) && Math.floor(c/3) === Math.floor(selected[1]/3) && !isSel

              const bRight  = (c + 1) % 3 === 0 && c !== 8 ? '2px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)'
              const bBottom = (r + 1) % 3 === 0 && r !== 8 ? '2px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)'

              let bg = '#1A1208'
              if (isSel)          bg = 'rgba(255,215,0,0.25)'
              else if (isError)   bg = 'rgba(229,57,53,0.25)'
              else if (isSameNum) bg = 'rgba(123,94,167,0.25)'
              else if (isHighlightRow || isHighlightCol || isHighlightBox) bg = 'rgba(255,255,255,0.05)'

              return (
                <button key={`${r}-${c}`} type="button"
                  onClick={() => !isGiven ? setSelected([r, c]) : setSelected([r, c])}
                  style={{
                    aspectRatio: '1',
                    background: bg,
                    borderRight: bRight,
                    borderBottom: bBottom,
                    borderLeft: c === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    borderTop: r === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    outline: isSel ? '2px solid #FFD700' : 'none',
                    outlineOffset: '-2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 0, padding: 0,
                  }}
                >
                  {val !== null && (
                    <span style={{
                      fontFamily: isGiven ? 'var(--font-pixel, monospace)' : 'var(--font-korean, sans-serif)',
                      fontSize: 'clamp(10px, 3.5vw, 16px)',
                      fontWeight: isGiven ? 'bold' : 'normal',
                      color: isError ? '#E53935' : isGiven ? '#FFD700' : '#E8F0FE',
                      userSelect: 'none',
                    }}>
                      {val}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* ── 캐릭터 (좌상단 고정, lg=80px, 감정 리액션) ── */}
        <div className="absolute top-1 left-1 z-10" style={{
          // 정답: 위로 점프, 오답: 흔들리기, 완성: 빠른 bob, 종료: 쓰러짐
          animation: charAnim === 'correct'   ? 'characterBob 0.25s ease 3' :
                     charAnim === 'wrong'     ? 'characterSword 0.35s ease' :
                     charAnim === 'celebrate' ? 'characterBob 0.3s ease-in-out infinite' :
                     charAnim === 'dead'      ? 'none' :
                     phase === 'playing'      ? 'characterBob 1.6s ease-in-out infinite' :
                     phase === 'timeout'      ? 'none' : 'none',
          transform: charAnim === 'dead' || phase === 'timeout' ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.4s ease',
          filter: phase === 'timeout' ? 'grayscale(1) brightness(0.6)' : 'none',
        }}>
          <CharacterSprite
            characterId={charId}
            role={role}
            size="lg"
            petId={null}
            petAnimate={false}
            weapon={null}
            animate="none"
          />
        </div>

        {/* ── 펫 (우하단 독립 배치) ── */}
        {petId && (
          <div className="absolute bottom-1 right-2 z-10"
            style={{ animation: 'petBounce 0.9s ease-in-out infinite' }}>
            <img src={`/assets/pets/${petId}.svg`} alt="pet" draggable={false}
              style={{ width: 32, height: 32, imageRendering: 'pixelated', objectFit: 'contain' }} />
          </div>
        )}

        {/* 가족 방문객 — 그리드 주변 랜덤 위치, 말풍선 */}
        {visitor && (
          <div className="absolute pointer-events-none z-20"
            style={{
              ...(visitor.pos === 0 ? { top: '5%',  left: '5%' }    :
                  visitor.pos === 1 ? { top: '5%',  left: '50%', transform: 'translateX(-50%)' } :
                  visitor.pos === 2 ? { top: '5%',  right: '5%' }   :
                  visitor.pos === 3 ? { bottom: '8%', left: '5%' }  :
                  visitor.pos === 4 ? { bottom: '8%', left: '50%', transform: 'translateX(-50%)' } :
                                      { bottom: '8%', right: '5%' }),
            }}>
            <div className="flex flex-col items-center gap-1 animate-fade-slide-up">
              {/* 말풍선 */}
              <div className="bg-panel-darkest/90 border-2 border-gold/60 px-2 py-1 max-w-[90px]">
                <span className="font-korean text-[10px] text-gold leading-tight text-center block">{visitor.msg}</span>
              </div>
              {/* 캐릭터 SVG */}
              <img src={visitor.charSvg} alt="visitor" draggable={false}
                style={{ width: 32, height: 32, imageRendering: 'pixelated', objectFit: 'contain',
                  animation: 'characterBob 1.4s ease-in-out infinite' }} />
            </div>
          </div>
        )}
      </div>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <p className="font-pixel text-gold text-sm animate-pulse">퍼즐 생성 중...</p>
        </div>
      )}

      {/* 숫자 입력 패드 */}
      <div className="shrink-0 bg-panel-darkest border-t-2 border-black pb-safe">
        <div className="grid gap-1 p-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} type="button"
              disabled={loading}
              onTouchStart={() => handleInput(n)} onMouseDown={() => handleInput(n)}
              className="h-12 bg-panel-dark border-2 border-panel-border
                         flex items-center justify-center font-pixel text-lg text-cream
                         active:bg-gold/20 active:border-gold select-none">
              {n}
            </button>
          ))}
          <button type="button"
            disabled={loading}
            onTouchStart={() => handleInput(null)} onMouseDown={() => handleInput(null)}
            className="h-12 bg-panel-dark border-2 border-rejected/50
                       flex items-center justify-center font-korean text-sm text-rejected
                       active:bg-rejected/20 select-none">
            지우기
          </button>
        </div>
      </div>

    </div>
  )
}
