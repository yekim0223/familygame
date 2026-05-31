// Tetris — Classic Block Puzzle (Canvas + Mobile Touch)
import { useRef, useEffect, useState } from 'react'
import { audioManager } from '@/infrastructure/audio/audioManager'

// ── 캔버스 / 그리드 상수 ─────────────────────────────────────────────
const CELL = 24
const COLS = 10, ROWS = 20
const CW = COLS * CELL        // 240
const CH = ROWS * CELL        // 480
const PREVIEW_X = CW + 8      // 미리보기 X (캔버스 외부 → 별도로 그림)

// ── 테트로미노 정의 ──────────────────────────────────────────────────
type Shape = number[][]
const PIECES: Record<string, { color: string; shapes: Shape[] }> = {
  I: { color: '#4ECDC4', shapes: [[[1,1,1,1]], [[1],[1],[1],[1]]] },
  O: { color: '#FFD700', shapes: [[[1,1],[1,1]]] },
  T: { color: '#9B6DFF', shapes: [[[0,1,0],[1,1,1]], [[1,0],[1,1],[1,0]], [[1,1,1],[0,1,0]], [[0,1],[1,1],[0,1]]] },
  S: { color: '#A8E6CF', shapes: [[[0,1,1],[1,1,0]], [[1,0],[1,1],[0,1]]] },
  Z: { color: '#FF6B6B', shapes: [[[1,1,0],[0,1,1]], [[0,1],[1,1],[1,0]]] },
  J: { color: '#45B7D1', shapes: [[[1,0,0],[1,1,1]], [[1,1],[1,0],[1,0]], [[1,1,1],[0,0,1]], [[0,1],[0,1],[1,1]]] },
  L: { color: '#FFA07A', shapes: [[[0,0,1],[1,1,1]], [[1,0],[1,0],[1,1]], [[1,1,1],[1,0,0]], [[1,1],[0,1],[0,1]]] },
}
const PIECE_KEYS = Object.keys(PIECES)

interface Piece { key: string; color: string; shape: Shape; x: number; y: number; rot: number }

// ── 유틸 ────────────────────────────────────────────────────────────
function rndPiece(): Piece {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)]
  const p = PIECES[key]
  return { key, color: p.color, shape: p.shapes[0], x: Math.floor(COLS / 2) - 1, y: 0, rot: 0 }
}
function getShape(key: string, rot: number): Shape {
  const shapes = PIECES[key].shapes
  return shapes[rot % shapes.length]
}
function rotatePiece(p: Piece): Piece {
  const newRot = (p.rot + 1) % PIECES[p.key].shapes.length
  return { ...p, rot: newRot, shape: getShape(p.key, newRot) }
}
function validPos(shape: Shape, x: number, y: number, board: (string | null)[][]): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nx = x + c, ny = y + r
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false
      if (ny >= 0 && board[ny][nx] !== null) return false
    }
  }
  return true
}
function lockPiece(p: Piece, board: (string | null)[][]): (string | null)[][] {
  const nb = board.map(r => [...r])
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue
      if (p.y + r >= 0) nb[p.y + r][p.x + c] = p.color
    }
  }
  return nb
}
function clearLines(board: (string | null)[][]): { board: (string | null)[][]; cleared: number } {
  const remaining = board.filter(row => row.some(c => c === null))
  const cleared = ROWS - remaining.length
  const empty: (string | null)[][] = Array.from({ length: cleared }, () => Array(COLS).fill(null))
  return { board: [...empty, ...remaining], cleared }
}
function scoreForLines(lines: number, level: number): number {
  const base = [0, 100, 300, 500, 800]
  return (base[Math.min(lines, 4)] ?? 0) * level
}
function ghostY(p: Piece, board: (string | null)[][]): number {
  let gy = p.y
  while (validPos(p.shape, p.x, gy + 1, board)) gy++
  return gy
}
function emptyBoard(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

// ── 드로우 ──────────────────────────────────────────────────────────
function drawCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(cx * CELL + 1, cy * CELL + 1, CELL - 2, CELL - 2)
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(cx * CELL + 1, cy * CELL + 1, CELL - 2, 3)
  ctx.fillRect(cx * CELL + 1, cy * CELL + 1, 3, CELL - 2)
  ctx.restore()
}

function drawBoard(ctx: CanvasRenderingContext2D, board: (string | null)[][]) {
  ctx.fillStyle = '#0F0A04'
  ctx.fillRect(0, 0, CW, CH)
  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
  for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, CH); ctx.stroke() }
  for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(CW, r * CELL); ctx.stroke() }
  board.forEach((row, ry) => row.forEach((col, cx) => { if (col) drawCell(ctx, cx, ry, col) }))
}

function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, offsetY: number, alpha = 1) {
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue
      drawCell(ctx, p.x + c, p.y + r + offsetY, p.color, alpha)
    }
  }
}

// ── Lock Delay ──────────────────────────────────────────────────────
const LOCK_DELAY = 500  // ms — 착지 후 0.5초 유예

// ── 상태 ────────────────────────────────────────────────────────────
interface TetrisState {
  board: (string | null)[][]
  current: Piece
  next: Piece
  score: number
  lines: number
  level: number
  phase: 'playing' | 'gameover'
  lastDrop: number
  lockDelay: number | null  // 착지 유예 타이머 시작 시각 (null = 공중)
}

function initState(): TetrisState {
  return {
    board: emptyBoard(),
    current: rndPiece(),
    next: rndPiece(),
    score: 0, lines: 0, level: 1,
    phase: 'playing',
    lastDrop: 0,
    lockDelay: null,
  }
}

// ── 컴포넌트 ────────────────────────────────────────────────────────
export interface TetrisProps { onGameOver: (score: number) => void; onBack: () => void }

export function TetrisGame({ onGameOver, onBack }: TetrisProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const ts         = useRef<TetrisState>(initState())
  const cbRef      = useRef(onGameOver)
  cbRef.current    = onGameOver
  // 입력 플래그 (반복 이동용)
  const keys       = useRef({ left: false, right: false, down: false, rotate: false, drop: false })
  const keyTimer   = useRef({ left: 0, right: 0, down: 0 })
  const [uiScore,  setUiScore]  = useState(0)
  const [uiLines,  setUiLines]  = useState(0)
  const [uiLevel,  setUiLevel]  = useState(1)
  const [uiPhase,  setUiPhase]  = useState<'playing' | 'gameover'>('playing')

  // ── 핵심 로직 함수 (ref 사용) ──────────────────────────────────
  const tryMove = (dx: number, dy: number) => {
    const g = ts.current; if (g.phase !== 'playing') return false
    const p = g.current
    if (validPos(p.shape, p.x + dx, p.y + dy, g.board)) {
      g.current = { ...p, x: p.x + dx, y: p.y + dy }
      // 수평 이동 성공 시 Lock Delay 리셋 (땅 위에서 이동할 여유 부여)
      if (dx !== 0) g.lockDelay = null
      return true
    }
    return false
  }
  const tryRotate = () => {
    const g = ts.current; if (g.phase !== 'playing') return
    const p = g.current
    const np = rotatePiece(p)
    // Wall kick: 5오프셋 시도
    for (const dx of [0, -1, 1, -2, 2]) {
      if (validPos(np.shape, np.x + dx, np.y, g.board)) {
        g.current = { ...np, x: np.x + dx }
        g.lockDelay = null   // 회전 성공 시 Lock Delay 리셋
        audioManager.rotate()
        return
      }
    }
  }
  const hardDrop = () => {
    const g = ts.current; if (g.phase !== 'playing') return
    const gy = ghostY(g.current, g.board)
    g.current = { ...g.current, y: gy }
    audioManager.hardDrop()
    lockAndSpawn()
  }
  const lockAndSpawn = () => {
    const g = ts.current
    const nb = lockPiece(g.current, g.board)
    const { board: cleared, cleared: linesN } = clearLines(nb)
    g.board = cleared
    g.lines += linesN
    g.score += scoreForLines(linesN, g.level)
    g.level = Math.floor(g.lines / 10) + 1
    const next = g.next
    g.current = { ...next, x: Math.floor(COLS / 2) - Math.floor(next.shape[0].length / 2), y: 0 }
    g.next = rndPiece()
    g.lastDrop = performance.now()
    if (linesN > 0) audioManager.lineClear(linesN)
    setUiScore(g.score); setUiLines(g.lines); setUiLevel(g.level)
    // 게임 오버 체크
    if (!validPos(g.current.shape, g.current.x, g.current.y, g.board)) {
      g.phase = 'gameover'; setUiPhase('gameover')
      audioManager.gameOver()
      cbRef.current(g.score)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ts.current = initState()
    setUiScore(0); setUiLines(0); setUiLevel(1); setUiPhase('playing')
    ts.current.lastDrop = performance.now()
    ts.current.lockDelay = null

    let rafId: number
    const REPEAT_DELAY = 160
    const REPEAT_RATE = 60

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      const g = ts.current
      if (g.phase !== 'playing') {
        // 게임 오버 화면도 계속 렌더
        drawBoard(ctx, g.board)
        return
      }

      // ── 자동 낙하 ──
      const dropInterval = Math.max(100, 1000 - (g.level - 1) * 100)
      if (now - g.lastDrop > dropInterval) {
        if (tryMove(0, 1)) {
          g.lastDrop = now
          g.lockDelay = null
        } else {
          // 내려갈 수 없음 → Lock Delay 시작
          if (g.lockDelay === null) g.lockDelay = now
          g.lastDrop = now  // 드롭 타이머 리셋 (중복 체크 방지)
        }
      }

      // ── Lock Delay 독립 체크 (매 프레임) ──
      if (g.lockDelay !== null && now - g.lockDelay >= LOCK_DELAY) {
        if (!validPos(g.current.shape, g.current.x, g.current.y + 1, g.board)) {
          lockAndSpawn()
        }
        g.lockDelay = null
      }

      // ── 좌우 반복 이동 ──
      if (keys.current.left) {
        if (now - keyTimer.current.left > (keyTimer.current.left === 0 ? 0 : REPEAT_DELAY)) {
          tryMove(-1, 0); keyTimer.current.left = now
        }
        if (keyTimer.current.left === 0) { tryMove(-1, 0); keyTimer.current.left = now }
      }
      if (keys.current.right) {
        if (now - keyTimer.current.right > (keyTimer.current.right === 0 ? 0 : REPEAT_DELAY)) {
          tryMove(1, 0); keyTimer.current.right = now
        }
        if (keyTimer.current.right === 0) { tryMove(1, 0); keyTimer.current.right = now }
      }
      // 소프트 드롭
      if (keys.current.down) {
        if (now - keyTimer.current.down > REPEAT_RATE) {
          if (!tryMove(0, 1)) lockAndSpawn()
          keyTimer.current.down = now; g.lastDrop = now
        }
        if (keyTimer.current.down === 0) { keyTimer.current.down = now }
      }

      // ── 렌더 ──
      drawBoard(ctx, g.board)
      const gy = ghostY(g.current, g.board)
      // 고스트 피스
      if (gy !== g.current.y) drawPiece(ctx, g.current, gy - g.current.y, 0.25)
      drawPiece(ctx, g.current, 0)
      // HUD 오른쪽 패널 (캔버스 내)
      ctx.fillStyle = '#0F0A04'; ctx.fillRect(0, 0, CW, 26)
      ctx.fillStyle = '#FFD700'; ctx.font = '10px monospace'
      ctx.fillText(`Lv ${g.level}`, 4, 17)
      ctx.fillText(`${g.score}`, CW / 2 - ctx.measureText(String(g.score)).width / 2, 17)
      ctx.fillText(`${g.lines}L`, CW - ctx.measureText(`${g.lines}L`).width - 4, 17)
      // 구분선
      ctx.fillStyle = 'rgba(255,215,0,0.3)'; ctx.fillRect(0, 24, CW, 1)
    }

    rafId = requestAnimationFrame(tick)

    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { keys.current.left   = true;  keyTimer.current.left  = 0; e.preventDefault() }
      if (e.key === 'ArrowRight') { keys.current.right  = true;  keyTimer.current.right = 0; e.preventDefault() }
      if (e.key === 'ArrowDown')  { keys.current.down   = true;  keyTimer.current.down  = 0; e.preventDefault() }
      if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') { tryRotate(); e.preventDefault() }
      if (e.key === ' ') { hardDrop(); e.preventDefault() }
    }
    const onKU = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { keys.current.left  = false; keyTimer.current.left  = 0 }
      if (e.key === 'ArrowRight') { keys.current.right = false; keyTimer.current.right = 0 }
      if (e.key === 'ArrowDown')  { keys.current.down  = false; keyTimer.current.down  = 0 }
    }
    window.addEventListener('keydown', onKD)
    window.addEventListener('keyup', onKU)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU) }
  }, [])

  const pressLeft  = () => { audioManager.resume(); keys.current.left  = true;  keyTimer.current.left  = 0 }
  const pressRight = () => { audioManager.resume(); keys.current.right = true;  keyTimer.current.right = 0 }
  const pressDown  = () => { audioManager.resume(); keys.current.down  = true;  keyTimer.current.down  = 0 }
  const relLeft    = () => { keys.current.left  = false; keyTimer.current.left  = 0 }
  const relRight   = () => { keys.current.right = false; keyTimer.current.right = 0 }
  const relDown    = () => { keys.current.down  = false; keyTimer.current.down  = 0 }

  const btnCls = "flex items-center justify-center bg-panel-dark border-4 border-panel-border text-cream text-xl active:bg-gold/20 active:border-gold select-none"

  return (
    <div className="flex flex-col h-full bg-[#0F0A04]" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* 스코어 바 */}
      <div className="flex-shrink-0 h-[32px] bg-panel-darkest border-b-2 border-black
                      flex items-center justify-around px-3">
        <span className="font-pixel text-xs text-gold">SCORE {uiScore.toLocaleString()}</span>
        <span className="font-pixel text-xs text-cream">LV {uiLevel}</span>
        <span className="font-pixel text-xs text-panel-sub">{uiLines} LINES</span>
      </div>

      {/* 캔버스 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#0F0A04]">
        {uiPhase === 'gameover' && (
          <div className="absolute z-10 pointer-events-none flex flex-col items-center gap-3">
            <p className="font-pixel text-xl text-rejected" style={{ textShadow: '2px 2px 0 #000' }}>GAME OVER</p>
            <p className="font-pixel text-base text-gold">{uiScore.toLocaleString()} PTS</p>
          </div>
        )}
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} />
      </div>

      {/* ── 모바일 터치 패드 ───────────────────────────────────────── */}
      <div className="flex-shrink-0 h-[138px] bg-panel-darkest border-t-4 border-black
                      flex items-center justify-between px-3 gap-1">
        {/* 방향 버튼 (좌/우/소프트드롭) */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            <button type="button" onTouchStart={pressLeft} onTouchEnd={relLeft} onMouseDown={pressLeft} onMouseUp={relLeft} onMouseLeave={relLeft}
              className={`${btnCls} w-[54px] h-[54px]`}>◄</button>
            <button type="button" onTouchStart={pressRight} onTouchEnd={relRight} onMouseDown={pressRight} onMouseUp={relRight} onMouseLeave={relRight}
              className={`${btnCls} w-[54px] h-[54px]`}>►</button>
          </div>
          <button type="button" onTouchStart={pressDown} onTouchEnd={relDown} onMouseDown={pressDown} onMouseUp={relDown} onMouseLeave={relDown}
            className={`${btnCls} w-[111px] h-[44px] text-base`}>▼ 소프트</button>
        </div>

        {/* 나가기 */}
        <button type="button" onClick={onBack}
          className="font-korean text-xs text-panel-sub border border-panel-border
                     px-2 py-1.5 bg-panel-dark active:opacity-70 flex-shrink-0 self-center">
          나가기
        </button>

        {/* 회전 + 하드드롭 */}
        <div className="flex flex-col gap-1">
          <button type="button"
            onTouchStart={() => tryRotate()} onMouseDown={() => tryRotate()}
            className={`${btnCls} w-[68px] h-[54px] text-2xl`}>↻</button>
          <button type="button"
            onTouchStart={() => hardDrop()} onMouseDown={() => hardDrop()}
            className={`${btnCls} w-[68px] h-[44px] text-sm text-gold font-bold`}>⬇ DROP</button>
        </div>
      </div>

      {/* 다음 피스 미리보기 */}
      <div className="flex-shrink-0 h-[24px] bg-panel-darkest border-t-2 border-black
                      flex items-center px-3 gap-2">
        <span className="font-korean text-xs text-panel-sub">NEXT:</span>
        <span className="font-pixel text-xs text-gold" style={{ color: ts.current.next.color }}>
          {ts.current.next.key}
        </span>
      </div>
    </div>
  )
}
