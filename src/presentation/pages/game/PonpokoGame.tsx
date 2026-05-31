// Ponpoko — 너구리 달리기 (Endless Runner, Canvas + Mobile Touch)
import { useRef, useEffect, useState } from 'react'

// ── 캔버스 크기 ──────────────────────────────────────────────────────
const CW = 320, CH = 480
const GROUND_Y = CH - 60      // 지면 Y 좌표
const RACCOON_X = 70           // 너구리 고정 X
const RACCOON_W = 36, RACCOON_H = 40

// ── 물리 상수 ────────────────────────────────────────────────────────
const GRAVITY    = 0.5
const JUMP_VY   = -11
const D_JUMP_VY = -9           // 이단 점프
const BASE_SPEED = 3.5         // 장애물 스크롤 속도 (초당 증가)

// ── 색상 ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#1a3a1a', bg2: '#0F0A04',
  ground: '#8B5E3C', groundTop: '#5C8A1E',
  raccoon:'#808080', racEye: '#FF4444', racTail: '#ffffff',
  log:    '#8B5E3C', logTop: '#A0522D',
  bird:   '#45B7D1', birdW: '#ffffff',
  coin:   '#FFD700',
  score:  '#FFD700',
  cloud:  'rgba(255,255,255,0.08)',
}

// ── 타입 ─────────────────────────────────────────────────────────────
interface Obstacle {
  id: number; x: number; y: number; w: number; h: number
  type: 'log' | 'bird'
}
interface Coin { id: number; x: number; y: number; collected: boolean }
interface Cloud { x: number; y: number; w: number; h: number; spd: number }

interface GS {
  ry: number; rvy: number; jumps: number   // raccoon y, vy, jumps available
  obstacles: Obstacle[]; coins: Coin[]; clouds: Cloud[]
  score: number; frame: number; speed: number
  phase: 'playing' | 'gameover'
  nextObstacle: number; nextCoin: number
  nextId: number
}

// ── 초기화 ───────────────────────────────────────────────────────────
function mkClouds(): Cloud[] {
  return Array.from({ length: 5 }, (_, i) => ({
    x: 40 + i * 60, y: 30 + Math.random() * 80,
    w: 50 + Math.random() * 60, h: 20 + Math.random() * 20,
    spd: 0.3 + Math.random() * 0.4,
  }))
}

function initGS(): GS {
  return {
    ry: GROUND_Y - RACCOON_H / 2, rvy: 0, jumps: 2,
    obstacles: [], coins: [], clouds: mkClouds(),
    score: 0, frame: 0, speed: BASE_SPEED,
    phase: 'playing',
    nextObstacle: 90, nextCoin: 50,
    nextId: 1,
  }
}

// ── 드로우 함수 ───────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, frame: number) {
  // 하늘
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, GROUND_Y)
  // 달
  ctx.fillStyle = 'rgba(255,255,200,0.4)'
  ctx.beginPath(); ctx.arc(CW - 40, 40, 22, 0, Math.PI * 2); ctx.fill()
  // 별들 (frame으로 깜빡)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = 0; i < 20; i++) {
    const sx = ((i * 73 + frame * 0.1) % CW)
    const sy = (i * 31) % (GROUND_Y - 20)
    const blink = Math.sin(frame * 0.04 + i) > 0.5 ? 1.5 : 1
    ctx.fillRect(sx, sy + 10, blink, blink)
  }
}

function drawGround(ctx: CanvasRenderingContext2D, offset: number) {
  ctx.fillStyle = C.ground; ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y)
  ctx.fillStyle = C.groundTop; ctx.fillRect(0, GROUND_Y, CW, 8)
  // 땅 무늬 스크롤
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  for (let i = 0; i < 10; i++) {
    const gx = ((i * 40 - offset) % CW + CW) % CW
    ctx.fillRect(gx, GROUND_Y + 2, 20, 4)
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, clouds: Cloud[]) {
  clouds.forEach(cl => {
    ctx.fillStyle = C.cloud
    ctx.beginPath()
    ctx.ellipse(cl.x, cl.y, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.ellipse(cl.x - cl.w * 0.25, cl.y + 5, cl.w * 0.3, cl.h * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.ellipse(cl.x + cl.w * 0.25, cl.y + 3, cl.w * 0.3, cl.h * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawRaccoon(ctx: CanvasRenderingContext2D, ry: number, frame: number, dead: boolean) {
  const rx = RACCOON_X
  ctx.save()
  ctx.translate(rx, ry)

  // 다리 애니 (달릴 때)
  if (!dead) {
    const legPhase = Math.sin(frame * 0.35)
    ctx.fillStyle = '#5a5a5a'
    ctx.fillRect(-12, RACCOON_H / 2 - 5, 10, 10 + legPhase * 4)
    ctx.fillRect(2, RACCOON_H / 2 - 5, 10, 10 - legPhase * 4)
  }

  // 꼬리
  ctx.fillStyle = C.racTail
  ctx.beginPath()
  ctx.ellipse(RACCOON_W / 2 + 6, 4, 14, 8, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#888'
  ctx.beginPath()
  ctx.ellipse(RACCOON_W / 2 + 6, 4, 10, 5, 0.4, 0, Math.PI * 2)
  ctx.fill()

  // 몸통
  ctx.fillStyle = dead ? '#FF6B6B' : C.raccoon
  ctx.beginPath()
  ctx.ellipse(0, 0, RACCOON_W / 2, RACCOON_H / 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // 배 무늬
  ctx.fillStyle = '#aaaaaa'
  ctx.beginPath()
  ctx.ellipse(0, 4, RACCOON_W / 3.5, RACCOON_H / 3.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // 눈
  ctx.fillStyle = '#fff'
  ctx.fillRect(-10, -12, 8, 7); ctx.fillRect(2, -12, 8, 7)
  ctx.fillStyle = C.racEye
  ctx.fillRect(-8, -11, 5, 5); ctx.fillRect(4, -11, 5, 5)
  // 눈 마스크 (너구리 특징)
  ctx.fillStyle = '#333'
  ctx.fillRect(-12, -14, 24, 2)

  // 코·입
  ctx.fillStyle = '#FF8C69'
  ctx.beginPath(); ctx.arc(-1, -3, 4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#FF6B6B'
  ctx.beginPath(); ctx.arc(-1, -2, 2, 0, Math.PI); ctx.fill()

  // 귀
  ctx.fillStyle = C.raccoon
  ctx.fillRect(-RACCOON_W / 2 + 2, -RACCOON_H / 2 - 10, 10, 12)
  ctx.fillRect(RACCOON_W / 2 - 12, -RACCOON_H / 2 - 10, 10, 12)
  ctx.fillStyle = '#ffb6c1'
  ctx.fillRect(-RACCOON_W / 2 + 4, -RACCOON_H / 2 - 7, 6, 8)
  ctx.fillRect(RACCOON_W / 2 - 10, -RACCOON_H / 2 - 7, 6, 8)

  ctx.restore()
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  if (obs.type === 'log') {
    ctx.fillStyle = C.log
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h)
    ctx.fillStyle = C.logTop
    ctx.fillRect(obs.x, obs.y, obs.w, 8)
    // 나뭇결
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(obs.x + obs.w / 3, obs.y + 2, 4, obs.h - 4)
    ctx.fillRect(obs.x + obs.w * 2 / 3, obs.y + 2, 4, obs.h - 4)
  } else {
    // 새 (bird)
    ctx.fillStyle = C.bird
    ctx.beginPath()
    ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // 날개 (flapping)
    const flap = Math.sin(Date.now() * 0.01) * 8
    ctx.fillStyle = C.birdW
    ctx.beginPath()
    ctx.moveTo(obs.x + 4, obs.y + obs.h / 2)
    ctx.lineTo(obs.x - 10, obs.y + obs.h / 2 - 10 + flap)
    ctx.lineTo(obs.x + 4, obs.y + obs.h / 2 - 4)
    ctx.closePath(); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(obs.x + obs.w - 4, obs.y + obs.h / 2)
    ctx.lineTo(obs.x + obs.w + 10, obs.y + obs.h / 2 - 10 + flap)
    ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h / 2 - 4)
    ctx.closePath(); ctx.fill()
    // 눈
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(obs.x + obs.w / 2 + 6, obs.y + obs.h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(obs.x + obs.w / 2 + 8, obs.y + obs.h / 2 - 4, 2, 0, Math.PI * 2); ctx.fill()
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, frame: number) {
  if (coin.collected) return
  const bob = Math.sin(frame * 0.08 + coin.id * 0.8) * 3
  ctx.fillStyle = C.coin
  ctx.shadowBlur = 6; ctx.shadowColor = C.coin
  ctx.beginPath()
  ctx.arc(coin.x, coin.y + bob, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#FFF8F0'
  ctx.font = '9px monospace'
  ctx.fillText('$', coin.x - 4, coin.y + bob + 4)
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export interface PonpokoProps { onGameOver: (score: number) => void; onBack: () => void }

export function PonpokoGame({ onGameOver, onBack }: PonpokoProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const gs         = useRef<GS>(initGS())
  const cbRef      = useRef(onGameOver)
  cbRef.current    = onGameOver
  const jumpPend   = useRef(false)      // 점프 트리거 (터치/키)
  const [uiScore,  setUiScore]  = useState(0)
  const [uiPhase,  setUiPhase]  = useState<'playing' | 'gameover'>('playing')

  const doJump = () => { jumpPend.current = true }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    gs.current = initGS()
    setUiScore(0); setUiPhase('playing')

    let rafId: number
    let groundOffset = 0

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const g = gs.current
      if (g.phase !== 'playing') {
        // 게임 오버 화면 유지 렌더
        ctx.fillStyle = '#0F0A04'; ctx.fillRect(0, 0, CW, CH)
        drawBackground(ctx, g.frame)
        drawGround(ctx, groundOffset)
        drawRaccoon(ctx, g.ry, g.frame, true)
        return
      }

      g.frame++
      g.score = Math.floor(g.frame / 6)
      g.speed = BASE_SPEED + g.frame * 0.0012

      // 점프 처리
      if (jumpPend.current) {
        jumpPend.current = false
        if (g.jumps > 0) { g.rvy = g.jumps === 2 ? JUMP_VY : D_JUMP_VY; g.jumps-- }
      }

      // 중력
      g.rvy += GRAVITY
      g.ry = Math.min(g.ry + g.rvy, GROUND_Y - RACCOON_H / 2)
      if (g.ry >= GROUND_Y - RACCOON_H / 2) { g.ry = GROUND_Y - RACCOON_H / 2; g.rvy = 0; g.jumps = 2 }

      // 지면 오프셋
      groundOffset = (groundOffset + g.speed) % 40

      // 구름 이동
      g.clouds.forEach(cl => {
        cl.x -= cl.spd
        if (cl.x + cl.w / 2 < 0) { cl.x = CW + cl.w / 2; cl.y = 30 + Math.random() * 80 }
      })

      // 장애물 생성
      if (g.frame >= g.nextObstacle) {
        const isLog = Math.random() > 0.35
        const h = isLog ? 30 + Math.floor(Math.random() * 20) : 28
        const birdY = isLog ? GROUND_Y - h : GROUND_Y - RACCOON_H - 30 - Math.random() * 40
        g.obstacles.push({
          id: g.nextId++, x: CW + 10, y: isLog ? GROUND_Y - h : birdY,
          w: isLog ? 22 + Math.floor(Math.random() * 14) : 36, h,
          type: isLog ? 'log' : 'bird',
        })
        g.nextObstacle = g.frame + 70 + Math.floor(Math.random() * 60) - Math.floor(g.frame / 600)
      }

      // 코인 생성
      if (g.frame >= g.nextCoin) {
        const coinY = GROUND_Y - 40 - Math.random() * 60
        g.coins.push({ id: g.nextId++, x: CW + 10, y: coinY, collected: false })
        g.nextCoin = g.frame + 45 + Math.floor(Math.random() * 35)
      }

      // 장애물 이동 + 충돌
      const rLeft = RACCOON_X - RACCOON_W / 2 + 6, rRight = RACCOON_X + RACCOON_W / 2 - 6
      const rTop = g.ry - RACCOON_H / 2 + 8, rBot = g.ry + RACCOON_H / 2 - 4

      g.obstacles = g.obstacles.filter(obs => {
        obs.x -= g.speed
        if (obs.x + obs.w < 0) return false
        // AABB 충돌
        const oR = obs.x + obs.w, oB = obs.y + obs.h
        if (rLeft < oR && rRight > obs.x && rTop < oB && rBot > obs.y) {
          g.phase = 'gameover'
          setUiPhase('gameover'); setUiScore(g.score)
          cbRef.current(g.score); return false
        }
        return true
      })

      // 코인 이동 + 수집
      g.coins.forEach(coin => {
        coin.x -= g.speed
        if (!coin.collected) {
          if (Math.abs(coin.x - RACCOON_X) < 20 && Math.abs(coin.y - g.ry) < 28) {
            coin.collected = true; g.score += 10
          }
        }
      })
      g.coins = g.coins.filter(c => c.x > -20)

      setUiScore(g.score)

      // ── 렌더 ──
      ctx.fillStyle = C.bg2; ctx.fillRect(0, 0, CW, CH)
      drawBackground(ctx, g.frame)
      drawClouds(ctx, g.clouds)
      drawGround(ctx, groundOffset)
      g.obstacles.forEach(obs => drawObstacle(ctx, obs))
      g.coins.forEach(coin => drawCoin(ctx, coin, g.frame))
      drawRaccoon(ctx, g.ry, g.frame, false)

      // 점수 HUD
      ctx.fillStyle = C.score; ctx.font = '11px monospace'
      ctx.fillText(`SCORE ${g.score}`, 8, 20)
      // 점프 잔여 표시
      for (let i = 0; i < g.jumps; i++) {
        ctx.fillStyle = '#9B6DFF'
        ctx.beginPath(); ctx.arc(CW - 16 - i * 18, 16, 6, 0, Math.PI * 2); ctx.fill()
      }
    }

    rafId = requestAnimationFrame(tick)

    const onKD = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') {
        doJump(); e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKD)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKD) }
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#0F0A04]" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* 스코어 바 */}
      <div className="flex-shrink-0 h-[32px] bg-panel-darkest border-b-2 border-black
                      flex items-center justify-between px-3">
        <span className="font-pixel text-xs text-gold">SCORE {uiScore.toLocaleString()}</span>
        <span className="font-korean text-xs text-cream/60">🦝 너구리 대시</span>
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
      <div className="flex-shrink-0 h-[130px] bg-panel-darkest border-t-4 border-black
                      flex items-center justify-between px-4">
        {/* 도움말 */}
        <div className="flex flex-col gap-1">
          <span className="font-korean text-xs text-panel-sub">장애물을 피해요!</span>
          <span className="font-korean text-[11px] text-cream/40">이단점프 가능 🦝</span>
        </div>

        {/* 나가기 */}
        <button type="button" onClick={onBack}
          className="font-korean text-xs text-panel-sub border border-panel-border
                     px-2 py-1.5 bg-panel-dark active:opacity-70">
          나가기
        </button>

        {/* 점프 버튼 */}
        <button type="button"
          onTouchStart={doJump} onMouseDown={doJump}
          className="w-[90px] h-[90px] bg-purple border-4 border-black
                     flex flex-col items-center justify-center gap-1
                     active:bg-gold active:border-gold select-none">
          <span className="text-3xl">🦘</span>
          <span className="font-pixel text-[10px] text-gold">JUMP</span>
        </button>
      </div>
    </div>
  )
}
