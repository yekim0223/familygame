// Snake — 뱀꼬리잡기 클래식 (Canvas + D-Pad 모바일 터치)
import { useRef, useEffect, useState } from 'react'
import { audioManager } from '@/infrastructure/audio/audioManager'

// ── 캔버스·그리드 상수 ───────────────────────────────────────────────
const CELL    = 15
const GRID_W  = 21
const GRID_H  = 26
const CW      = 320
const CH      = 480
const GRID_OX = (CW - GRID_W * CELL) / 2   // 수평 중앙 정렬
const GRID_OY = 30                           // 상단 HUD 여백

// ── 색상 ─────────────────────────────────────────────────────────────
const C = {
  bg:    '#0F0A04',
  grid:  'rgba(255,255,255,0.04)',
  head:  '#9B6DFF',
  body:  '#7B5EA7',
  tail:  '#4E3A6B',
  food:  '#FFD700',
  score: '#FFD700',
} as const

// ── 방향 타입 ────────────────────────────────────────────────────────
type Pos = { x: number; y: number }
type Dir = { x: number; y: number }

const UP:    Dir = { x:  0, y: -1 }
const DOWN:  Dir = { x:  0, y:  1 }
const LEFT:  Dir = { x: -1, y:  0 }
const RIGHT: Dir = { x:  1, y:  0 }

// ── 음식 스폰 (뱀 몸통 제외) ─────────────────────────────────────────
function spawnFood(snake: Pos[]): Pos {
  let pos: Pos
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_W),
      y: Math.floor(Math.random() * GRID_H),
    }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  return pos
}

// ── 게임 상태 ────────────────────────────────────────────────────────
interface GS {
  snake:    Pos[]
  dir:      Dir
  nextDir:  Dir
  food:     Pos
  score:    number
  growing:  number
  phase:    'playing' | 'gameover'
  lastMove: number
  frame:    number
}

function initGS(): GS {
  const snake: Pos[] = [
    { x: 11, y: 12 },
    { x: 10, y: 12 },
    { x:  9, y: 12 },
  ]
  return {
    snake,
    dir:      RIGHT,
    nextDir:  RIGHT,
    food:     spawnFood(snake),
    score:    0,
    growing:  0,
    phase:    'playing',
    lastMove: 0,
    frame:    0,
  }
}

// ── 셀 렌더 ──────────────────────────────────────────────────────────
function fillCell(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  color: string,
  margin = 2,
) {
  ctx.fillStyle = color
  ctx.fillRect(
    GRID_OX + gx * CELL + margin,
    GRID_OY + gy * CELL + margin,
    CELL - margin * 2,
    CELL - margin * 2,
  )
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export interface SnakeProps { onGameOver: (score: number) => void; onBack: () => void }

export function SnakeGame({ onGameOver, onBack }: SnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gs        = useRef<GS>(initGS())
  const cbRef     = useRef(onGameOver)
  cbRef.current   = onGameOver

  const [uiScore, setUiScore] = useState(0)
  const [uiLen,   setUiLen]   = useState(3)
  const [uiPhase, setUiPhase] = useState<'playing' | 'gameover'>('playing')

  // 방향 전환 (180도 반전 방지)
  const setDir = (d: Dir) => {
    audioManager.resume()
    const g = gs.current
    if (d.x === -g.dir.x && d.y === -g.dir.y) return
    g.nextDir = d
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    gs.current = initGS()
    setUiScore(0); setUiLen(3); setUiPhase('playing')
    gs.current.lastMove = performance.now()

    let rafId: number

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      const g = gs.current
      g.frame++

      // 속도: 점수 오를수록 빨라짐 (최소 80ms)
      const moveMs = Math.max(80, 200 - Math.floor(g.score / 300) * 10)

      if (g.phase === 'playing' && now - g.lastMove >= moveMs) {
        g.lastMove = now
        g.dir = g.nextDir

        const head = g.snake[0]
        const next: Pos = { x: head.x + g.dir.x, y: head.y + g.dir.y }

        // 벽 충돌
        const hitWall = next.x < 0 || next.x >= GRID_W || next.y < 0 || next.y >= GRID_H
        // 자기 몸통 충돌 (꼬리 제외 — 꼬리는 이번 프레임에 제거될 위치)
        const hitSelf = g.snake.slice(0, g.snake.length - (g.growing > 0 ? 0 : 1))
          .some(s => s.x === next.x && s.y === next.y)

        if (hitWall || hitSelf) {
          g.phase = 'gameover'
          setUiPhase('gameover'); setUiScore(g.score)
          audioManager.gameOver()
          cbRef.current(g.score)
        } else {
          g.snake.unshift(next)
          if (g.growing > 0) {
            g.growing--
          } else {
            g.snake.pop()
          }

          // 음식 먹기
          if (next.x === g.food.x && next.y === g.food.y) {
            g.score += 100
            g.growing += 2
            g.food = spawnFood(g.snake)
            audioManager.coinCollect()
            setUiScore(g.score)
            setUiLen(g.snake.length)
          }
        }
      }

      // ── 렌더 ──────────────────────────────────────────────────────
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, CH)

      // 그리드 선
      ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5
      for (let c = 0; c <= GRID_W; c++) {
        const px = GRID_OX + c * CELL
        ctx.beginPath(); ctx.moveTo(px, GRID_OY); ctx.lineTo(px, GRID_OY + GRID_H * CELL); ctx.stroke()
      }
      for (let r = 0; r <= GRID_H; r++) {
        const py = GRID_OY + r * CELL
        ctx.beginPath(); ctx.moveTo(GRID_OX, py); ctx.lineTo(GRID_OX + GRID_W * CELL, py); ctx.stroke()
      }

      // 뱀 몸통
      const snake = g.snake
      snake.forEach((seg, i) => {
        if (i === 0) {
          fillCell(ctx, seg.x, seg.y, C.head, 1)
          // 눈 그리기
          const ex = GRID_OX + seg.x * CELL + CELL / 2 + g.dir.x * 3
          const ey = GRID_OY + seg.y * CELL + CELL / 2 + g.dir.y * 3
          ctx.fillStyle = '#FFF8F0'
          ctx.beginPath(); ctx.arc(ex - g.dir.y * 3, ey + g.dir.x * 3, 2, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(ex + g.dir.y * 3, ey - g.dir.x * 3, 2, 0, Math.PI * 2); ctx.fill()
        } else {
          const t  = 1 - i / snake.length
          const lightness = Math.floor(40 + t * 25)
          fillCell(ctx, seg.x, seg.y, i < snake.length * 0.5 ? C.body : C.tail, 2)
          // 하이라이트 (앞쪽 세그먼트만)
          if (i < 3) {
            ctx.fillStyle = `rgba(255,255,255,${0.12 * t})`
            ctx.fillRect(GRID_OX + seg.x * CELL + 2, GRID_OY + seg.y * CELL + 2, CELL - 4, 2)
          }
          void lightness
        }
      })

      // 음식 (반짝임)
      const foodPulse = 0.7 + Math.sin(g.frame * 0.12) * 0.3
      ctx.fillStyle = C.food
      ctx.shadowBlur = 8; ctx.shadowColor = C.food
      ctx.globalAlpha = foodPulse
      fillCell(ctx, g.food.x, g.food.y, C.food, 3)
      ctx.shadowBlur = 0; ctx.globalAlpha = 1
      // 별 아이콘
      ctx.fillStyle = '#0F0A04'
      ctx.font = `bold ${CELL - 5}px monospace`
      ctx.fillText('★',
        GRID_OX + g.food.x * CELL + 2,
        GRID_OY + g.food.y * CELL + CELL - 2,
      )

      // HUD
      ctx.fillStyle = C.score; ctx.font = '10px monospace'
      ctx.fillText(`SCORE ${g.score}`, GRID_OX, 20)
      const lenText = `LEN ${snake.length}`
      ctx.fillText(lenText, GRID_OX + GRID_W * CELL - ctx.measureText(lenText).width, 20)

      // 게임 오버 오버레이
      if (g.phase === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(GRID_OX, GRID_OY, GRID_W * CELL, GRID_H * CELL)
        ctx.fillStyle = '#FF4444'; ctx.font = 'bold 15px monospace'
        const goText = 'GAME OVER'
        ctx.fillText(
          goText,
          GRID_OX + (GRID_W * CELL - ctx.measureText(goText).width) / 2,
          GRID_OY + GRID_H * CELL / 2 - 10,
        )
        ctx.fillStyle = C.score; ctx.font = '12px monospace'
        const scText = `${g.score} PTS`
        ctx.fillText(
          scText,
          GRID_OX + (GRID_W * CELL - ctx.measureText(scText).width) / 2,
          GRID_OY + GRID_H * CELL / 2 + 12,
        )
      }
    }

    rafId = requestAnimationFrame(tick)

    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')    { setDir(UP);    e.preventDefault() }
      if (e.key === 'ArrowDown')  { setDir(DOWN);  e.preventDefault() }
      if (e.key === 'ArrowLeft')  { setDir(LEFT);  e.preventDefault() }
      if (e.key === 'ArrowRight') { setDir(RIGHT); e.preventDefault() }
    }
    window.addEventListener('keydown', onKD)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKD) }
  }, [])

  const dBtnCls = [
    'flex items-center justify-center',
    'w-[50px] h-[50px]',
    'bg-panel-dark border-4 border-panel-border',
    'text-cream text-lg select-none',
    'active:bg-gold/20 active:border-gold',
  ].join(' ')

  return (
    <div className="flex flex-col h-full bg-[#0F0A04]" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* 스코어 바 */}
      <div className="flex-shrink-0 h-[28px] bg-panel-darkest border-b-2 border-black
                      flex items-center justify-between px-3">
        <span className="font-pixel text-xs text-gold">SCORE {uiScore.toLocaleString()}</span>
        <span className="font-korean text-xs text-cream/50">🐍 뱀꼬리잡기</span>
        <span className="font-pixel text-xs text-purple">LEN {uiLen}</span>
      </div>

      {/* 캔버스 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#0F0A04]">
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} />
      </div>

      {/* ── 모바일 D-Pad 컨트롤 ─────────────────────────────────────── */}
      <div className="flex-shrink-0 h-[160px] bg-panel-darkest border-t-4 border-black
                      flex items-center justify-between px-4">
        {/* 십자 D-Pad */}
        <div className="flex flex-col items-center gap-1">
          <button type="button"
            onTouchStart={() => setDir(UP)}   onMouseDown={() => setDir(UP)}
            className={dBtnCls}>▲</button>
          <div className="flex gap-1">
            <button type="button"
              onTouchStart={() => setDir(LEFT)}  onMouseDown={() => setDir(LEFT)}
              className={dBtnCls}>◄</button>
            {/* 중앙 마스코트 */}
            <div className="w-[50px] h-[50px] bg-panel-darkest flex items-center justify-center">
              <span className="text-2xl">🐍</span>
            </div>
            <button type="button"
              onTouchStart={() => setDir(RIGHT)} onMouseDown={() => setDir(RIGHT)}
              className={dBtnCls}>►</button>
          </div>
          <button type="button"
            onTouchStart={() => setDir(DOWN)}  onMouseDown={() => setDir(DOWN)}
            className={dBtnCls}>▼</button>
        </div>

        {/* 우측 정보 */}
        <div className="flex flex-col items-center gap-2 mr-2">
          <div className="text-center">
            <p className="font-pixel text-sm text-gold">{uiScore.toLocaleString()}</p>
            <p className="font-korean text-xs text-panel-sub">점수</p>
          </div>
          <button type="button" onClick={onBack}
            className="font-korean text-xs text-panel-sub border border-panel-border
                       px-3 py-1.5 bg-panel-dark active:opacity-70">
            나가기
          </button>
          <p className="font-korean text-xs text-cream/40 text-center">
            벽·몸통<br/>충돌 주의!
          </p>
        </div>
      </div>
    </div>
  )
}
