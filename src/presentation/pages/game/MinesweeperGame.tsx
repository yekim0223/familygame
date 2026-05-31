// MinesweeperGame — 레트로 지뢰찾기 (DOM Grid + 터치 모드 토글 + 스테이지 무한 루프)
import { useState, useEffect, useCallback, useRef } from 'react'
import { audioManager } from '@/infrastructure/audio/audioManager'

// ── 스테이지 설정 ────────────────────────────────────────────────────
interface StageConf { rows: number; cols: number; mines: number }
function getStageConf(stage: number): StageConf {
  // 스테이지가 오를수록 맵 크기·지뢰 수 증가
  const base = Math.min(stage - 1, 6) // 최대 7단계 증가 후 수평
  const rows  = 8  + base
  const cols  = 8  + base
  const mines = 8  + base * 4
  return { rows, cols, mines }
}

// ── 셀 타입 ─────────────────────────────────────────────────────────
interface Cell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adj: number // 인접 지뢰 수 (0–8)
}

type Phase = 'playing' | 'won' | 'lost'

// ── 인접 지뢰 수 계산 ────────────────────────────────────────────────
function calcAdj(board: Cell[][], rows: number, cols: number, r: number, c: number): number {
  let cnt = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) cnt++
    }
  }
  return cnt
}

// ── 보드 생성 ───────────────────────────────────────────────────────
function buildBoard(rows: number, cols: number, mines: number, safeR: number, safeC: number): Cell[][] {
  const board: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adj: 0 }))
  )
  // 안전 영역 (첫 탭 위치 ±1) 제외하고 지뢰 배치
  const banned = new Set<string>()
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr, nc = safeC + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) banned.add(`${nr},${nc}`)
    }

  let placed = 0
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    if (!board[r][c].mine && !banned.has(`${r},${c}`)) {
      board[r][c].mine = true
      placed++
    }
  }
  // 인접 수 계산
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      board[r][c].adj = calcAdj(board, rows, cols, r, c)

  return board
}

// ── 빈 셀 연쇄 오픈 (BFS) ────────────────────────────────────────────
function floodReveal(board: Cell[][], rows: number, cols: number, r: number, c: number): Cell[][] {
  const next = board.map(row => row.map(cell => ({ ...cell })))
  const queue = [[r, c]]
  const visited = new Set<string>([`${r},${c}`])

  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!
    const cell = next[cr][cc]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.adj === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = cr + dr, nc = cc + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(`${nr},${nc}`)) {
            visited.add(`${nr},${nc}`)
            queue.push([nr, nc])
          }
        }
      }
    }
  }
  return next
}

// ── 숫자 색상 ────────────────────────────────────────────────────────
const ADJ_COLOR = ['', '#4FC3F7','#43A047','#E53935','#7B5EA7','#E53935','#4FC3F7','#1A1A1A','#9E9E9E']

// ── 스코어 계산 ──────────────────────────────────────────────────────
function calcScore(stage: number, elapsed: number, conf: StageConf): number {
  const baseScore  = (conf.rows * conf.cols - conf.mines) * 20
  const timeBonus  = Math.max(0, 300 - elapsed) * 5
  const stageBonus = (stage - 1) * 500
  return Math.round(baseScore + timeBonus + stageBonus)
}

// ════════════════════════════════════════════════════════════════════
interface Props { onGameOver: (score: number) => void; onBack: () => void }

export function MinesweeperGame({ onGameOver, onBack }: Props) {
  const [stage,    setStage]    = useState(1)
  const [conf,     setConf]     = useState<StageConf>(getStageConf(1))
  const [board,    setBoard]    = useState<Cell[][] | null>(null)   // null = first tap not yet
  const [phase,    setPhase]    = useState<Phase>('playing')
  const [flagMode, setFlagMode] = useState(false)
  const [elapsed,  setElapsed]  = useState(0)
  const [score,    setScore]    = useState(0)
  const [stageMsg, setStageMsg] = useState('')
  const [showBoom, setShowBoom] = useState(false)

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTime = useRef(Date.now())

  // ── 타이머 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    startTime.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, stage])

  // ── 셀 탭 ───────────────────────────────────────────────────────
  const handleCellTap = useCallback((r: number, c: number) => {
    if (phase !== 'playing') return
    audioManager.resume()

    setBoard(prev => {
      // 첫 탭: 보드 생성
      let b = prev ?? buildBoard(conf.rows, conf.cols, conf.mines, r, c)
      const cell = b[r][c]

      if (flagMode) {
        if (cell.revealed) return prev
        audioManager.mineFlag()
        const next = b.map(row => row.map(cl => ({ ...cl })))
        next[r][c] = { ...cell, flagged: !cell.flagged }
        return next
      }

      if (cell.flagged || cell.revealed) return prev

      if (cell.mine) {
        // 지뢰 폭발
        audioManager.mineBoom()
        const next = b.map(row => row.map(cl => ({ ...cl })))
        // 모든 지뢰 공개
        for (let rr = 0; rr < conf.rows; rr++)
          for (let cc = 0; cc < conf.cols; cc++)
            if (next[rr][cc].mine) next[rr][cc].revealed = true
        next[r][c] = { ...next[r][c], revealed: true }
        setPhase('lost')
        setShowBoom(true)
        setTimeout(() => setShowBoom(false), 800)
        return next
      }

      audioManager.mineOpen()
      const next = floodReveal(b, conf.rows, conf.cols, r, c)

      // 승리 체크
      const safe = conf.rows * conf.cols - conf.mines
      const revealed = next.flat().filter(cl => cl.revealed && !cl.mine).length
      if (revealed >= safe) {
        audioManager.mineWin()
        const elapsed_ = Math.floor((Date.now() - startTime.current) / 1000)
        const gained = calcScore(stage, elapsed_, conf)
        setScore(s => s + gained)
        setStageMsg(`🎉 스테이지 ${stage} 클리어! +${gained}점`)
        setTimeout(() => {
          const nextStage = stage + 1
          setStage(nextStage)
          setConf(getStageConf(nextStage))
          setBoard(null)
          setPhase('playing')
          setElapsed(0)
          setStageMsg('')
          setFlagMode(false)
        }, 2000)
        setPhase('won')
      }
      return next
    })
  }, [phase, flagMode, conf, stage])

  // ── 게임오버 전달 ─────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'lost') {
      const timer = setTimeout(() => onGameOver(score), 1800)
      return () => clearTimeout(timer)
    }
  }, [phase, score, onGameOver])

  // ── 셀 스타일 ─────────────────────────────────────────────────
  const cellSize = Math.min(32, Math.floor(300 / conf.cols))

  function cellStyle(cell: Cell, isBlast: boolean) {
    if (!cell.revealed) {
      return {
        background: '#2A1F0E',
        border: '2px solid',
        borderColor: '#4a3520 #1a0f00 #1a0f00 #4a3520',
        cursor: 'pointer',
      } as React.CSSProperties
    }
    if (cell.mine) {
      return {
        background: isBlast ? '#8B0000' : '#3a1010',
        border: '2px solid #1a0000',
      } as React.CSSProperties
    }
    return {
      background: '#1a1208',
      border: '2px inset #0a0800',
    } as React.CSSProperties
  }

  // ── HUD ────────────────────────────────────────────────────────
  const flagCount  = board?.flat().filter(c => c.flagged).length ?? 0
  const minesLeft  = conf.mines - flagCount

  return (
    <div className="flex flex-col h-full bg-panel-darkest select-none" style={{ touchAction: 'none' }}>

      {/* HUD */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel-darkest border-b-2 border-gold/30">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-xs text-gold">S{stage}</span>
          <span className="font-pixel text-xs text-rejected">💣{minesLeft}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-pixel text-xs text-cream">⏱{elapsed}s</span>
          <span className="font-pixel text-xs text-gold">{score.toLocaleString()}pt</span>
        </div>
        <button type="button" onClick={onBack}
          className="font-korean text-xs text-panel-sub border border-panel-border px-2 py-1
                     active:scale-95 transition-transform">
          ✕
        </button>
      </div>

      {/* 스테이지 클리어 메시지 */}
      {stageMsg && (
        <div className="text-center py-1 bg-approved/20 border-b border-approved">
          <p className="font-korean text-sm font-bold text-approved">{stageMsg}</p>
        </div>
      )}

      {/* 폭발 오버레이 */}
      {showBoom && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-4xl text-rejected" style={{ textShadow: '0 0 20px #ff0000' }}>
            💥 BOOM
          </p>
        </div>
      )}

      {/* 격자 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${conf.cols}, ${cellSize}px)`,
          gap: '1px',
          background: '#0a0800',
        }}>
          {Array.from({ length: conf.rows }, (_, r) =>
            Array.from({ length: conf.cols }, (_, c) => {
              const cell = board?.[r]?.[c] ?? { mine: false, revealed: false, flagged: false, adj: 0 }
              const isBlast = phase === 'lost' && cell.mine && board?.[r]?.[c]?.revealed === true
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: cellSize, height: cellSize,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: cellSize * 0.48,
                    fontFamily: '"Press Start 2P", cursive',
                    fontWeight: 'bold',
                    lineHeight: 1,
                    userSelect: 'none',
                    ...cellStyle(cell, isBlast),
                  }}
                  onPointerDown={e => { e.preventDefault(); handleCellTap(r, c) }}
                >
                  {cell.revealed
                    ? cell.mine
                      ? '💣'
                      : cell.adj > 0
                        ? <span style={{ color: ADJ_COLOR[cell.adj] }}>{cell.adj}</span>
                        : ''
                    : cell.flagged
                      ? '🚩'
                      : ''}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 하단 컨트롤 패드 */}
      <div className="flex items-center justify-center gap-4 px-4 pb-3 pt-2 border-t-2 border-gold/20">
        {/* 모드 토글 */}
        <button
          type="button"
          onPointerDown={e => { e.preventDefault(); audioManager.resume(); audioManager.keyClick(); setFlagMode(f => !f) }}
          className={[
            'w-16 h-14 border-4 font-pixel text-[10px] leading-tight text-center',
            'flex flex-col items-center justify-center gap-0.5',
            'shadow-[inset_2px_2px_0px_#ffffff30,inset_-2px_-2px_0px_#00000060]',
            'active:scale-95 transition-transform',
            flagMode
              ? 'bg-rejected border-red-800 text-white'
              : 'bg-panel-dark border-panel-border text-gold',
          ].join(' ')}
        >
          <span className="text-lg">{flagMode ? '🚩' : '⛏'}</span>
          <span>{flagMode ? 'FLAG' : 'MINE'}</span>
        </button>

        {/* 새 게임 (게임오버/클리어 아닐 때 재시작) */}
        <button
          type="button"
          onPointerDown={e => {
            e.preventDefault()
            audioManager.resume()
            audioManager.keyClick()
            setBoard(null)
            setPhase('playing')
            setElapsed(0)
            setScore(0)
            setStage(1)
            setConf(getStageConf(1))
            setFlagMode(false)
          }}
          className="w-16 h-14 border-4 border-panel-border bg-panel-dark text-gold
                     font-pixel text-[10px] flex flex-col items-center justify-center gap-0.5
                     shadow-[inset_2px_2px_0px_#ffffff30,inset_-2px_-2px_0px_#00000060]
                     active:scale-95 transition-transform"
        >
          <span className="text-lg">🔄</span>
          <span>RESET</span>
        </button>

        {/* 힌트: 남은 지뢰 */}
        <div className="w-16 h-14 border-4 border-panel-border bg-panel-darkest
                        flex flex-col items-center justify-center gap-0.5">
          <span className="font-pixel text-xs text-rejected">💣</span>
          <span className="font-pixel text-[10px] text-cream">{minesLeft}</span>
          <span className="font-pixel text-[8px] text-panel-sub">LEFT</span>
        </div>
      </div>
    </div>
  )
}
