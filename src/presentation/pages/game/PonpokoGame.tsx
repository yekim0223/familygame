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
interface Coin     { id: number; x: number; y: number; collected: boolean; red?: boolean }
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
// 캐릭터 SVG drawImage + 너구리 발 속도 계승 (sin*0.35)
// 점수/DB 로직 무관 — 렌더 레이어만 변경
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  ry: number, frame: number, dead: boolean,
  pInv: number, weapon: WeaponType,
  charImg: HTMLImageElement | null,
) {
  if (pInv > 0 && Math.floor(pInv / 6) % 2 === 0) return

  const rx = RACCOON_X
  ctx.save()
  ctx.translate(rx, ry)

  // 발 애니 — 기존 너구리 속도 sin(frame * 0.35) 그대로 계승
  if (!dead) {
    const legPhase = Math.sin(frame * 0.35)
    ctx.fillStyle = '#5a5a5a'
    ctx.fillRect(-RACCOON_W / 2 + 2, RACCOON_H / 2 - 3, 9, 10 + legPhase * 4)
    ctx.fillRect(RACCOON_W / 2 - 11, RACCOON_H / 2 - 3, 9, 10 - legPhase * 4)
  }

  // 캐릭터 SVG
  if (charImg && charImg.complete && charImg.naturalWidth > 0) {
    if (dead) { ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)' }
    ctx.drawImage(charImg, -RACCOON_W / 2, -RACCOON_H / 2, RACCOON_W, RACCOON_H)
    ctx.globalAlpha = 1; ctx.filter = 'none'
  } else {
    // charImg 미로드 시 단순 보라 사각형 대체 (너구리 도형 제거)
    ctx.fillStyle = dead ? '#FF6B6B' : '#7B5EA7'
    ctx.fillRect(-RACCOON_W / 2, -RACCOON_H / 2, RACCOON_W, RACCOON_H)
  }

  // 무기 비주얼 (기존 로직 완전 유지)
  if (!dead) {
    const hx = RACCOON_W / 2 - 4
    const hy = 2
    switch (weapon) {
      case 'laser':
        ctx.fillStyle = '#4ECDC4'; ctx.fillRect(hx, hy - 2, 14, 4)
        ctx.fillStyle = '#A8E6CF'; ctx.fillRect(hx - 2, hy - 3, 5, 6)
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#4ECDC4'
        ctx.fillRect(hx + 14, hy - 1, 18, 2); ctx.globalAlpha = 1
        break
      case 'double':
        ctx.fillStyle = '#FFD700'
        ctx.fillRect(hx, hy - 7, 11, 4); ctx.fillRect(hx, hy + 3, 11, 4)
        ctx.fillStyle = '#FF6B9D'; ctx.fillRect(hx - 2, hy - 8, 4, 15)
        break
      default:
        ctx.fillStyle = '#9B6DFF'; ctx.fillRect(hx, hy - 1.5, 14, 3)
        ctx.fillStyle = '#FFD700'; ctx.fillRect(hx - 2, hy - 3.5, 4, 7)
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
  // 빨간 코인(20%): 2배 점수, 빨간색으로 구분
  const color = coin.red ? '#FF3333' : C.coin
  const shadow = coin.red ? '#FF6666' : C.coin
  ctx.fillStyle = color
  ctx.shadowBlur = 8; ctx.shadowColor = shadow
  ctx.beginPath(); ctx.arc(coin.x, coin.y + bob, 10, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#FFF8F0'; ctx.font = '9px monospace'
  ctx.fillText(coin.red ? '★' : '$', coin.x - 4, coin.y + bob + 4)
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export interface PonpokoProps { onGameOver: (score: number) => void; charSvgUrl?: string; onBack?: () => void }

export function PonpokoGame({ onGameOver, charSvgUrl = '/assets/characters/base-observer.svg', onBack }: PonpokoProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const gs         = useRef<GS>(initGS())
  const cbRef      = useRef(onGameOver)
  cbRef.current    = onGameOver
  const jumpPend   = useRef(false)
  const charImgRef = useRef<HTMLImageElement | null>(null)

  // 캐릭터 SVG 프리로드 (UI 에셋만, 게임 로직 무관)
  useEffect(() => {
    const img = new Image()
    img.src = charSvgUrl
    charImgRef.current = img
  }, [charSvgUrl])

  const [uiScore,  setUiScore]  = useState(0)
  const [_uiLives, setUiLives]  = useState(MAX_LIVES)
  const [uiStage,  setUiStage]  = useState(1)
  const [uiPhase,  setUiPhase]  = useState<'playing' | 'gameover'>('playing')
  const [uiPaused, setUiPaused] = useState(false)
  const pausedRef  = useRef(false)

  const currentWeapon = useInventoryStore(state => state.currentWeapon)

  const doJump = () => {
    if (pausedRef.current) return
    audioManager.resume(); jumpPend.current = true
  }
  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setUiPaused(p => !p)
    if (!pausedRef.current) audioManager.resume()
  }

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

      // 일시정지: 프레임 스킵 (캔버스 마지막 프레임 유지)
      if (pausedRef.current) return

      // 게임 오버 화면 유지
      if (g.phase !== 'playing') {
        ctx.fillStyle = '#0F0A04'; ctx.fillRect(0, 0, CW, CH)
        drawBackground(ctx, g.frame)
        drawGround(ctx, groundOffset)
        drawPlayer(ctx, g.ry, g.frame, true, 0, useInventoryStore.getState().currentWeapon, charImgRef.current)
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

      // 코인 생성 (80% 노란, 20% 빨간 2배 점수)
      if (g.frame >= g.nextCoin) {
        const coinY = GROUND_Y - 40 - Math.random() * 60
        const isRed = Math.random() < 0.10
        g.coins.push({ id: g.nextId++, x: CW + 10, y: coinY, collected: false, red: isRed })
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
              setTimeout(() => cbRef.current(g.score), 5000)
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
            const pts = coin.red ? 20 : 10   // 빨간 코인 2배
            g.score += pts
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
      drawPlayer(ctx, g.ry, g.frame, false, g.pInv, weapon, charImgRef.current)

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
      {/* 스코어 바 + PAUSE/EXIT */}
      <div className="flex-shrink-0 h-[44px] bg-panel-darkest border-b-2 border-black
                      flex items-center justify-between px-3">
        <span className="font-pixel text-xs text-gold">SCORE {uiScore.toLocaleString()}</span>
        <span className="font-korean text-xs text-cream/60">STG {uiStage}</span>
        <div className="flex items-center gap-2">
          <button type="button"
            onPointerDown={togglePause}
            className="min-w-[54px] h-9 px-2 bg-purple border-2 border-purple/60
                       flex items-center justify-center font-pixel text-xs
                       active:scale-95 select-none text-white">
            {uiPaused ? '▶' : 'PAUSE'}
          </button>
          {onBack && (
            <button type="button"
              onPointerDown={onBack}
              className="min-w-[54px] h-9 px-2 bg-rejected border-2 border-rejected/60
                         flex items-center justify-center font-pixel text-xs
                         active:scale-95 select-none text-white">
              EXIT
            </button>
          )}
        </div>
      </div>

      {/* 캔버스 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#0F0A04] relative">
        {uiPaused && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 pointer-events-none">
            <p className="font-pixel text-2xl text-gold t-pixel-shadow">PAUSED</p>
            <p className="font-korean text-sm text-cream/70 mt-2">위 PAUSE 버튼으로 계속하기</p>
          </div>
        )}
        {uiPhase === 'gameover' && (
          <div className="absolute z-10 pointer-events-none flex flex-col items-center gap-3
                          bg-black/70 px-8 py-6 border-4 border-rejected">
            <p className="font-pixel text-2xl text-rejected" style={{ textShadow: '3px 3px 0 #000' }}>
              GAME OVER
            </p>
            <p className="font-pixel text-lg text-gold">{uiScore.toLocaleString()} PTS</p>
            <p className="font-pixel text-xs text-cream/60 mt-1">결과 화면으로 이동 중...</p>
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
          <span className="font-korean text-xs text-gold">💡 공중에서 한 번 더 탭!</span>
          <span className="font-korean text-xs text-cream/70">코인 {stageTarget(uiStage)}개 → 다음 STG</span>
        </div>

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
