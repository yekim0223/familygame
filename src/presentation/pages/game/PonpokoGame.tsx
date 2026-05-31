// Ponpoko — 너구리 달리기 v2 (Canvas + 목숨 3개 + 70% 히트박스 + 스테이지 루프 + 무기 비주얼)
import { useRef, useEffect, useState } from 'react'
import { audioManager } from '@/infrastructure/audio/audioManager'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'
import type { WeaponType } from '@/infrastructure/stores/userInventoryStore'

// ── 캔버스 크기 ──────────────────────────────────────────────────────
const CW = 320, CH = 480
const GROUND_Y  = CH - 60
const RACCOON_X = 70
const RACCOON_W = 36, RACCOON_H = 40

// ── 히트박스 (캐릭터 70%) ────────────────────────────────────────────
const HB_W = RACCOON_W * 0.70   // ≈ 25
const HB_H = RACCOON_H * 0.70   // ≈ 28

// ── 물리 상수 ────────────────────────────────────────────────────────
const GRAVITY    = 0.5
const JUMP_VY   = -11
const D_JUMP_VY = -9
const BASE_SPEED = 3.5
const INV_FRAMES = 60           // 1초 무적 (60fps 기준)
const MAX_LIVES  = 3

// ── 스테이지 코인 목표 ───────────────────────────────────────────────
function stageTarget(stage: number) { return stage * 5 + 5 }

// ── 색상 ─────────────────────────────────────────────────────────────
const C = {
  bg: '#1a3a1a', bg2: '#0F0A04',
  ground: '#8B5E3C', groundTop: '#5C8A1E',
  raccoon: '#808080', racEye: '#FF4444', racTail: '#ffffff',
  log: '#8B5E3C', logTop: '#A0522D',
  bird: '#45B7D1', birdW: '#ffffff',
  coin: '#FFD700', score: '#FFD700',
  cloud: 'rgba(255,255,255,0.08)',
} as const

// ── 타입 ─────────────────────────────────────────────────────────────
interface Obstacle { id: number; x: number; y: number; w: number; h: number; type: 'log' | 'bird' }
interface Coin     { id: number; x: number; y: number; collected: boolean }
interface Cloud    { x: number; y: number; w: number; h: number; spd: number }

interface GS {
  ry: number; rvy: number; jumps: number
  pInv: number             // 무적 프레임 카운터
  lives: number            // 잔여 목숨
  obstacles: Obstacle[]; coins: Coin[]; clouds: Cloud[]
  score: number; frame: number; speed: number
  phase: 'playing' | 'gameover'
  nextObstacle: number; nextCoin: number; nextId: number
  stage: number
  stageCoins: number       // 현 스테이지에서 먹은 코인
  stageFlash: number       // 스테이지 완료 플래시 효과 (프레임)
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
    pInv: 0, lives: MAX_LIVES,
    obstacles: [], coins: [], clouds: mkClouds(),
    score: 0, frame: 0, speed: BASE_SPEED,
    phase: 'playing',
    nextObstacle: 90, nextCoin: 50, nextId: 1,
    stage: 1, stageCoins: 0, stageFlash: 0,
  }
}

// ── 배경 ──────────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, GROUND_Y)
  ctx.fillStyle = 'rgba(255,255,200,0.4)'
  ctx.beginPath(); ctx.arc(CW - 40, 40, 22, 0, Math.PI * 2); ctx.fill()
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
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  for (let i = 0; i < 10; i++) {
    const gx = ((i * 40 - offset) % CW + CW) % CW
    ctx.fillRect(gx, GROUND_Y + 2, 20, 4)
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, clouds: Cloud[]) {
  clouds.forEach(cl => {
    ctx.fillStyle = C.cloud
    ctx.beginPath(); ctx.ellipse(cl.x, cl.y, cl.w / 2, cl.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.ellipse(cl.x - cl.w * 0.25, cl.y + 5, cl.w * 0.3, cl.h * 0.4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.ellipse(cl.x + cl.w * 0.25, cl.y + 3, cl.w * 0.3, cl.h * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  })
}

// ── 너구리 드로우 (pInv 깜빡임 + 무기 비주얼) ────────────────────────
function drawRaccoon(
  ctx: CanvasRenderingContext2D,
  ry: number, frame: number, dead: boolean,
  pInv: number, weapon: WeaponType,
) {
  // 무적 깜빡임: 6프레임마다 토글
  if (pInv > 0 && Math.floor(pInv / 6) % 2 === 0) return

  const rx = RACCOON_X
  ctx.save()
  ctx.translate(rx, ry)

  // 다리 애니
  if (!dead) {
    const legPhase = Math.sin(frame * 0.35)
    ctx.fillStyle = '#5a5a5a'
    ctx.fillRect(-12, RACCOON_H / 2 - 5, 10, 10 + legPhase * 4)
    ctx.fillRect(2,   RACCOON_H / 2 - 5, 10, 10 - legPhase * 4)
  }

  // 꼬리
  ctx.fillStyle = C.racTail
  ctx.beginPath(); ctx.ellipse(RACCOON_W / 2 + 6, 4, 14, 8, 0.4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#888'
  ctx.beginPath(); ctx.ellipse(RACCOON_W / 2 + 6, 4, 10, 5, 0.4, 0, Math.PI * 2); ctx.fill()

  // 몸통
  ctx.fillStyle = dead ? '#FF6B6B' : C.raccoon
  ctx.beginPath(); ctx.ellipse(0, 0, RACCOON_W / 2, RACCOON_H / 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#aaaaaa'
  ctx.beginPath(); ctx.ellipse(0, 4, RACCOON_W / 3.5, RACCOON_H / 3.5, 0, 0, Math.PI * 2); ctx.fill()

  // 눈
  ctx.fillStyle = '#fff'
  ctx.fillRect(-10, -12, 8, 7); ctx.fillRect(2, -12, 8, 7)
  ctx.fillStyle = C.racEye
  ctx.fillRect(-8, -11, 5, 5); ctx.fillRect(4, -11, 5, 5)
  ctx.fillStyle = '#333'; ctx.fillRect(-12, -14, 24, 2)

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

  // ── 장착 무기 비주얼 (손에 들고 달리는 이미지) ──────────────────
  if (!dead) {
    const hx = RACCOON_W / 2 - 4   // 손 위치 (앞쪽)
    const hy = 2
    switch (weapon) {
      case 'laser':
        // 레이저 건 — 청록색 총
        ctx.fillStyle = '#4ECDC4'
        ctx.fillRect(hx, hy - 2, 14, 4)
        ctx.fillStyle = '#A8E6CF'
        ctx.fillRect(hx - 2, hy - 3, 5, 6)
        ctx.globalAlpha = 0.5
        ctx.fillStyle = '#4ECDC4'
        ctx.fillRect(hx + 14, hy - 1, 18, 2)   // 레이저 빔
        ctx.globalAlpha = 1
        break
      case 'double':
        // 더블 총 — 위아래 두 자루
        ctx.fillStyle = '#FFD700'
        ctx.fillRect(hx, hy - 7, 11, 4)
        ctx.fillRect(hx, hy + 3, 11, 4)
        ctx.fillStyle = '#FF6B9D'
        ctx.fillRect(hx - 2, hy - 8, 4, 15)   // 손잡이
        break
      default:
        // basic: 단검
        ctx.fillStyle = '#9B6DFF'
        ctx.fillRect(hx, hy - 1.5, 14, 3)
        ctx.fillStyle = '#FFD700'
        ctx.fillRect(hx - 2, hy - 3.5, 4, 7)  // 가드
    }
  }

  ctx.restore()
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  if (obs.type === 'log') {
    ctx.fillStyle = C.log; ctx.fillRect(obs.x, obs.y, obs.w, obs.h)
    ctx.fillStyle = C.logTop; ctx.fillRect(obs.x, obs.y, obs.w, 8)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(obs.x + obs.w / 3, obs.y + 2, 4, obs.h - 4)
    ctx.fillRect(obs.x + obs.w * 2 / 3, obs.y + 2, 4, obs.h - 4)
  } else {
    ctx.fillStyle = C.bird
    ctx.beginPath(); ctx.ellipse(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, obs.h / 2, 0, 0, Math.PI * 2); ctx.fill()
    const flap = Math.sin(Date.now() * 0.01) * 8
    ctx.fillStyle = C.birdW
    ctx.beginPath(); ctx.moveTo(obs.x + 4, obs.y + obs.h / 2)
    ctx.lineTo(obs.x - 10, obs.y + obs.h / 2 - 10 + flap); ctx.lineTo(obs.x + 4, obs.y + obs.h / 2 - 4); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(obs.x + obs.w - 4, obs.y + obs.h / 2)
    ctx.lineTo(obs.x + obs.w + 10, obs.y + obs.h / 2 - 10 + flap); ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h / 2 - 4); ctx.closePath(); ctx.fill()
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
  ctx.beginPath(); ctx.arc(coin.x, coin.y + bob, 10, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#FFF8F0'; ctx.font = '9px monospace'
  ctx.fillText('$', coin.x - 4, coin.y + bob + 4)
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export interface PonpokoProps { onGameOver: (score: number) => void; onBack: () => void }

export function PonpokoGame({ onGameOver, onBack }: PonpokoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gs        = useRef<GS>(initGS())
  const cbRef     = useRef(onGameOver)
  cbRef.current   = onGameOver
  const jumpPend  = useRef(false)

  const [uiScore, setUiScore] = useState(0)
  const [uiLives, setUiLives] = useState(MAX_LIVES)
  const [uiStage, setUiStage] = useState(1)
  const [uiPhase, setUiPhase] = useState<'playing' | 'gameover'>('playing')

  const currentWeapon = useInventoryStore(state => state.currentWeapon)

  const doJump = () => { audioManager.resume(); jumpPend.current = true }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    gs.current = initGS()
    setUiScore(0); setUiLives(MAX_LIVES); setUiStage(1); setUiPhase('playing')

    let rafId: number
    let groundOffset = 0

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const g = gs.current

      // 게임 오버 화면 유지
      if (g.phase !== 'playing') {
        ctx.fillStyle = '#0F0A04'; ctx.fillRect(0, 0, CW, CH)
        drawBackground(ctx, g.frame)
        drawGround(ctx, groundOffset)
        drawRaccoon(ctx, g.ry, g.frame, true, 0, useInventoryStore.getState().currentWeapon)
        return
      }

      g.frame++
      g.score = Math.floor(g.frame / 6)
      // 스테이지마다 1.25x 누적 가속 (최대 12)
      const stageMul = Math.pow(1.25, g.stage - 1)
      g.speed = Math.min(12, (BASE_SPEED + g.frame * 0.0008) * stageMul)

      // 무적 프레임 감소
      if (g.pInv > 0) g.pInv--

      // 점프 처리
      if (jumpPend.current) {
        jumpPend.current = false
        if (g.jumps > 0) { g.rvy = g.jumps === 2 ? JUMP_VY : D_JUMP_VY; g.jumps--; audioManager.jump() }
      }

      // 중력
      g.rvy += GRAVITY
      g.ry = Math.min(g.ry + g.rvy, GROUND_Y - RACCOON_H / 2)
      if (g.ry >= GROUND_Y - RACCOON_H / 2) { g.ry = GROUND_Y - RACCOON_H / 2; g.rvy = 0; g.jumps = 2 }

      groundOffset = (groundOffset + g.speed) % 40

      // 구름
      g.clouds.forEach(cl => {
        cl.x -= cl.spd
        if (cl.x + cl.w / 2 < 0) { cl.x = CW + cl.w / 2; cl.y = 30 + Math.random() * 80 }
      })

      // 스테이지 플래시 감소
      if (g.stageFlash > 0) g.stageFlash--

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

      // ── 70% 히트박스 계산 ──────────────────────────────────────────
      const hbLeft  = RACCOON_X - HB_W / 2
      const hbRight = RACCOON_X + HB_W / 2
      const hbTop   = g.ry - HB_H / 2
      const hbBot   = g.ry + HB_H / 2

      // 장애물 충돌 (무적 아닐 때만)
      g.obstacles = g.obstacles.filter(obs => {
        obs.x -= g.speed
        if (obs.x + obs.w < 0) return false
        if (g.pInv === 0) {
          const oR = obs.x + obs.w, oB = obs.y + obs.h
          if (hbLeft < oR && hbRight > obs.x && hbTop < oB && hbBot > obs.y) {
            g.lives--
            if (g.lives <= 0) {
              g.phase = 'gameover'
              setUiPhase('gameover'); setUiScore(g.score)
              audioManager.gameOver()
              cbRef.current(g.score)
              return false
            }
            g.pInv = INV_FRAMES
            audioManager.playerHit()
            setUiLives(g.lives)
            return true
          }
        }
        return true
      })

      // 코인 수집
      g.coins.forEach(coin => {
        coin.x -= g.speed
        if (!coin.collected) {
          if (Math.abs(coin.x - RACCOON_X) < 20 && Math.abs(coin.y - g.ry) < 28) {
            coin.collected = true
            g.score += 10
            g.stageCoins++
            audioManager.coinCollect()

            // 스테이지 완료 체크 (무한 루프)
            if (g.stageCoins >= stageTarget(g.stage)) {
              g.stage++
              g.stageCoins = 0
              g.stageFlash = 40
              setUiStage(g.stage)
            }
          }
        }
      })
      g.coins = g.coins.filter(c => c.x > -20)

      setUiScore(g.score)

      // ── 렌더 ──────────────────────────────────────────────────────
      const weapon = useInventoryStore.getState().currentWeapon

      ctx.fillStyle = C.bg2; ctx.fillRect(0, 0, CW, CH)
      drawBackground(ctx, g.frame)
      drawClouds(ctx, g.clouds)
      drawGround(ctx, groundOffset)
      g.obstacles.forEach(obs => drawObstacle(ctx, obs))
      g.coins.forEach(coin => drawCoin(ctx, coin, g.frame))
      drawRaccoon(ctx, g.ry, g.frame, false, g.pInv, weapon)

      // HUD
      ctx.fillStyle = C.score; ctx.font = '11px monospace'
      ctx.fillText(`SCORE ${g.score}`, 8, 20)

      // 목숨 표시
      for (let i = 0; i < g.lives; i++) {
        ctx.fillStyle = '#9B6DFF'
        ctx.beginPath(); ctx.arc(CW - 12 - i * 18, 14, 6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#FF6B6B'; ctx.font = '8px monospace'
        ctx.fillText('♥', CW - 16 - i * 18, 18)
      }

      // 스테이지 표시
      ctx.fillStyle = '#4ECDC4'; ctx.font = '10px monospace'
      ctx.fillText(`STG ${g.stage}`, CW / 2 - 22, 20)

      // 스테이지 완료 플래시
      if (g.stageFlash > 0) {
        const alpha = g.stageFlash / 40 * 0.6
        ctx.fillStyle = `rgba(255,215,0,${alpha})`
        ctx.fillRect(0, 0, CW, CH)
        ctx.fillStyle = `rgba(255,215,0,${alpha * 1.5})`; ctx.font = 'bold 18px monospace'
        const txt = `STAGE ${g.stage} START!`
        ctx.fillText(txt, CW / 2 - ctx.measureText(txt).width / 2, CH / 2)
      }

      // 점프 잔여 표시
      for (let i = 0; i < g.jumps; i++) {
        ctx.fillStyle = '#9B6DFF'
        ctx.beginPath(); ctx.arc(CW - 16 - i * 18, CH - GROUND_Y / 2 - 8, 5, 0, Math.PI * 2); ctx.fill()
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

  const WEAPON_ICON: Record<WeaponType, string> = { basic: '⚔️', laser: '⚡', double: '🔫' }

  return (
    <div className="flex flex-col h-full bg-[#0F0A04]" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* 스코어 바 */}
      <div className="flex-shrink-0 h-[32px] bg-panel-darkest border-b-2 border-black
                      flex items-center justify-between px-3">
        <span className="font-pixel text-xs text-gold">SCORE {uiScore.toLocaleString()}</span>
        <span className="font-korean text-xs text-cream/60">🦝 STG {uiStage}</span>
        <span className="font-pixel text-xs text-purple">{'♥'.repeat(uiLives)}</span>
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

      {/* ── 모바일 터치 패드 ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-[130px] bg-panel-darkest border-t-4 border-black
                      flex items-center justify-between px-4">
        {/* 도움말 + 무기 아이콘 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{WEAPON_ICON[currentWeapon]}</span>
            <span className="font-korean text-xs text-panel-sub">장착중</span>
          </div>
          <span className="font-korean text-xs text-cream/40">이단점프 가능 🦝</span>
          <span className="font-korean text-xs text-cream/40">코인 {stageTarget(uiStage)}개 → 다음 스테이지</span>
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
