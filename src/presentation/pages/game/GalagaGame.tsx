// Galaga — Space Shooter (Canvas + Mobile Touch)
import { useRef, useEffect, useState } from 'react'

// ── 캔버스 논리 크기 ────────────────────────────────────────────────
const CW = 320, CH = 480

// ── 상수 ────────────────────────────────────────────────────────────
const PW = 28, PH = 22         // player width/height
const PSPEED = 3.5
const BW = 3, BH = 12          // player bullet
const BSPEED = 8
const SHOOT_MS = 380
const ROWS = 4, COLS = 8
const EW = 26, EH = 20
const EGAPX = 34, EGAPY = 30
const ESTARTX = (CW - (COLS - 1) * EGAPX) / 2 - EW / 2
const ESTARTY = 55
const DIVE_SPEED = 3.0
const INV_FRAMES = 120
const MAX_EBULLETS = 5

// ── 색상 ────────────────────────────────────────────────────────────
const C = {
  bg: '#0F0A04', player: '#9B6DFF', pAccent: '#FFD700',
  bullet: '#FFD700', eBullet: '#FF4444',
  e: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#A8E6CF'],
} as const

// ── 타입 ────────────────────────────────────────────────────────────
interface Enemy {
  id: number; row: number; col: number
  alive: boolean; flash: number
  x: number; y: number; homeX: number; homeY: number
  diving: boolean; dvx: number; dvy: number; returning: boolean
}
interface Bullet  { id: number; x: number; y: number }
interface EBullet { id: number; x: number; y: number; vx: number; vy: number }
interface Star    { x: number; y: number; s: number; spd: number }
interface Expl    { id: number; x: number; y: number; t: number }

interface GS {
  px: number; py: number; pInv: number
  bullets: Bullet[]; enemies: Enemy[]
  eBullets: EBullet[]; stars: Star[]; explosions: Expl[]
  score: number; lives: number
  phase: 'playing' | 'gameover' | 'clear'
  fOX: number; fDir: number
  lastShot: number; nextId: number; nextDive: number; frame: number; wave: number
}

// ── 초기화 ──────────────────────────────────────────────────────────
function mkStars(): Star[] {
  return Array.from({ length: 70 }, () => ({
    x: Math.random() * CW, y: Math.random() * CH,
    s: Math.random() < 0.25 ? 2 : 1, spd: 0.3 + Math.random() * 1.2,
  }))
}
function mkEnemies(): Enemy[] {
  const out: Enemy[] = []
  let id = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const hx = ESTARTX + c * EGAPX + EW / 2
      const hy = ESTARTY + r * EGAPY + EH / 2
      out.push({ id: id++, row: r, col: c, alive: true, flash: 0,
        x: hx, y: hy, homeX: hx, homeY: hy,
        diving: false, dvx: 0, dvy: 0, returning: false })
    }
  }
  return out
}
function initGS(wave = 1, prevScore = 0, prevLives = 3, prevStars?: Star[]): GS {
  return {
    px: CW / 2, py: CH - 34, pInv: 0,
    bullets: [], enemies: mkEnemies(), eBullets: [], explosions: [],
    stars: prevStars ?? mkStars(),
    score: prevScore, lives: prevLives,
    phase: 'playing',
    fOX: 0, fDir: 1,
    lastShot: 0, nextId: 2000, nextDive: 200, frame: 0, wave,
  }
}

// ── 충돌 ────────────────────────────────────────────────────────────
function hit(ax: number, ay: number, aw: number, ah: number,
             bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// ── 드로우 함수 ──────────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number, inv: number) {
  if (inv > 0 && Math.floor(inv / 6) % 2 === 0) return
  ctx.save(); ctx.translate(px, py)
  ctx.fillStyle = C.player
  ctx.beginPath(); ctx.moveTo(0, -PH / 2); ctx.lineTo(-PW / 2, PH / 2); ctx.lineTo(PW / 2, PH / 2); ctx.closePath(); ctx.fill()
  ctx.fillStyle = C.pAccent; ctx.fillRect(-5, -3, 10, 9)
  ctx.fillStyle = '#FF6B6B'; ctx.fillRect(-8, PH / 2 - 2, 5, 4); ctx.fillRect(3, PH / 2 - 2, 5, 4)
  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, frame: number) {
  if (!e.alive) return
  const col = e.flash > 0 ? '#FFFFFF' : C.e[e.row]
  ctx.save(); ctx.translate(e.x, e.y)
  if (!e.diving) ctx.translate(0, Math.sin(frame * 0.05 + e.id * 0.4) * 1.5)
  else ctx.rotate(Math.atan2(e.dvy, e.dvx) + Math.PI / 2)
  const hw = EW / 2, hh = EH / 2
  ctx.fillStyle = col; ctx.fillRect(-hw, -hh, EW, EH)
  ctx.fillStyle = '#000'
  ctx.fillRect(-hw + 5, -hh + 5, 4, 4); ctx.fillRect(hw - 9, -hh + 5, 4, 4)
  if (e.row <= 1) { ctx.fillStyle = col; ctx.fillRect(-hw - 5, -hh + 6, 5, 8); ctx.fillRect(hw, -hh + 6, 5, 8) }
  ctx.restore()
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number, lives: number, wave: number) {
  ctx.fillStyle = C.pAccent; ctx.font = '11px monospace'
  ctx.fillText(`SCORE ${score}`, 6, 16)
  const wText = `WAVE ${wave}`; ctx.fillText(wText, CW / 2 - ctx.measureText(wText).width / 2, 16)
  for (let i = 0; i < lives; i++) {
    const lx = CW - 14 - i * 20
    ctx.fillStyle = C.player
    ctx.beginPath(); ctx.moveTo(lx, 6); ctx.lineTo(lx - 7, 18); ctx.lineTo(lx + 7, 18); ctx.closePath(); ctx.fill()
  }
}

// ── 컴포넌트 ────────────────────────────────────────────────────────
export interface GalagaProps { onGameOver: (score: number) => void; onBack: () => void }

export function GalagaGame({ onGameOver, onBack }: GalagaProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const gs           = useRef<GS>(initGS())
  const keys         = useRef({ left: false, right: false, fire: false })
  const cbRef        = useRef(onGameOver)
  cbRef.current      = onGameOver
  const [uiScore,    setUiScore]  = useState(0)
  const [uiLives,    setUiLives]  = useState(3)
  const [uiPhase,    setUiPhase]  = useState<'playing' | 'gameover'>('playing')
  const [uiWave,     setUiWave]   = useState(1)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    gs.current = initGS()
    setUiScore(0); setUiLives(3); setUiPhase('playing'); setUiWave(1)

    let rafId: number
    let lastTime = performance.now()

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      const g = gs.current
      if (g.phase !== 'playing') return
      g.frame++

      // 플레이어 이동
      if (keys.current.left)  g.px = Math.max(PW / 2, g.px - PSPEED)
      if (keys.current.right) g.px = Math.min(CW - PW / 2, g.px + PSPEED)

      // 발사
      if (keys.current.fire && now - g.lastShot > SHOOT_MS && g.bullets.length < 2) {
        g.bullets.push({ id: g.nextId++, x: g.px, y: g.py - PH / 2 }); g.lastShot = now
      }
      lastTime = now

      // 플레이어 총알 이동
      g.bullets = g.bullets.filter(b => { b.y -= BSPEED; return b.y > -20 })

      // 적 포메이션 이동
      const alive = g.enemies.filter(e => e.alive && !e.diving)
      const fSpd = 1.0 + (ROWS * COLS - alive.length) * 0.06 + (g.wave - 1) * 0.3
      g.fOX += g.fDir * fSpd
      const minHX = ESTARTX + EW / 2 + g.fOX
      const maxHX = ESTARTX + (COLS - 1) * EGAPX + EW / 2 + g.fOX
      if (maxHX > CW - 10 || minHX < 10) g.fDir *= -1

      g.enemies.forEach(e => {
        if (!e.alive) return
        e.flash = Math.max(0, e.flash - 1)
        if (e.diving) {
          e.x += e.dvx; e.y += e.dvy
          if (e.y > CH + 20) { e.x = e.homeX + g.fOX; e.y = -20; e.returning = true }
          if (e.returning) {
            const tx = e.homeX + g.fOX, ty = e.homeY
            const dx = tx - e.x, dy = ty - e.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 5) { e.x = tx; e.y = ty; e.diving = false; e.returning = false; e.dvx = 0; e.dvy = 0 }
            else { const sp = Math.min(DIVE_SPEED * 1.2, dist); e.x += (dx / dist) * sp; e.y += (dy / dist) * sp }
          }
        } else { e.x = e.homeX + g.fOX; e.y = e.homeY }
      })

      // 다이브 트리거
      if (g.frame >= g.nextDive) {
        const cands = g.enemies.filter(e => e.alive && !e.diving)
        if (cands.length > 0) {
          const e = cands[Math.floor(Math.random() * cands.length)]
          e.diving = true; e.returning = false
          const angle = Math.atan2(g.py - e.y, g.px - e.x)
          const spd = DIVE_SPEED + (g.wave - 1) * 0.4
          e.dvx = Math.cos(angle) * spd; e.dvy = Math.sin(angle) * spd
        }
        g.nextDive = g.frame + 130 + Math.floor(Math.random() * 80)
      }

      // 적 총알
      if (g.eBullets.length < MAX_EBULLETS) {
        g.enemies.forEach(e => {
          if (!e.alive) return
          if (Math.random() < 0.0012 + (g.wave - 1) * 0.0003) {
            const angle = Math.atan2(g.py - e.y, g.px - e.x)
            const spd = 2.5 + (g.wave - 1) * 0.3
            g.eBullets.push({ id: g.nextId++, x: e.x, y: e.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd })
          }
        })
      }
      g.eBullets = g.eBullets.filter(b => { b.x += b.vx; b.y += b.vy; return b.y < CH + 10 && b.x > -10 && b.x < CW + 10 })

      // 총알 vs 적 충돌
      for (let bi = g.bullets.length - 1; bi >= 0; bi--) {
        const b = g.bullets[bi]
        let hit_ = false
        for (const e of g.enemies) {
          if (!e.alive) continue
          if (hit(b.x - 1.5, b.y - BH / 2, BW, BH, e.x - EW / 2, e.y - EH / 2, EW, EH)) {
            e.alive = false
            g.explosions.push({ id: g.nextId++, x: e.x, y: e.y, t: 0 })
            g.score += e.row === 0 ? 200 : 100
            hit_ = true; break
          }
        }
        if (hit_) { g.bullets.splice(bi, 1); setUiScore(g.score) }
      }

      // 적 총알 vs 플레이어 충돌
      if (g.pInv === 0) {
        for (let bi = g.eBullets.length - 1; bi >= 0; bi--) {
          const b = g.eBullets[bi]
          if (hit(b.x - 3, b.y - 3, 6, 6, g.px - PW / 2, g.py - PH / 2, PW, PH)) {
            g.lives--; g.pInv = INV_FRAMES; g.eBullets.splice(bi, 1)
            if (g.lives <= 0) { g.phase = 'gameover'; setUiScore(g.score); setUiLives(0); setUiPhase('gameover'); cbRef.current(g.score); return }
            setUiLives(g.lives); break
          }
        }
      }

      // 다이빙 적 vs 플레이어
      if (g.pInv === 0) {
        for (const e of g.enemies) {
          if (!e.alive || !e.diving) continue
          if (hit(e.x - EW / 2, e.y - EH / 2, EW, EH, g.px - PW / 2, g.py - PH / 2, PW, PH)) {
            g.lives--; g.pInv = INV_FRAMES; e.alive = false
            g.explosions.push({ id: g.nextId++, x: e.x, y: e.y, t: 0 })
            if (g.lives <= 0) { g.phase = 'gameover'; setUiScore(g.score); setUiLives(0); setUiPhase('gameover'); cbRef.current(g.score); return }
            setUiLives(g.lives); break
          }
        }
      }
      if (g.pInv > 0) g.pInv--

      // 웨이브 클리어
      if (g.enemies.every(e => !e.alive)) {
        const nw = g.wave + 1
        gs.current = initGS(nw, g.score, g.lives, g.stars)
        setUiWave(nw); return
      }

      // 폭발 업데이트
      g.explosions = g.explosions.filter(ex => { ex.t++; return ex.t < 20 })

      // 별 이동
      g.stars.forEach(s => { s.y += s.spd; if (s.y > CH) { s.y = 0; s.x = Math.random() * CW } })

      // ── 렌더 ──
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, CH)
      g.stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${0.4 + s.s * 0.3})`; ctx.fillRect(s.x, s.y, s.s, s.s) })
      g.enemies.forEach(e => drawEnemy(ctx, e, g.frame))
      drawPlayer(ctx, g.px, g.py, g.pInv)
      g.bullets.forEach(b => {
        ctx.fillStyle = C.bullet; ctx.shadowBlur = 6; ctx.shadowColor = C.bullet
        ctx.fillRect(b.x - 1.5, b.y - BH / 2, BW, BH); ctx.shadowBlur = 0
      })
      g.eBullets.forEach(b => {
        ctx.fillStyle = C.eBullet; ctx.shadowBlur = 4; ctx.shadowColor = C.eBullet
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
      })
      g.explosions.forEach(ex => {
        const p = ex.t / 20, r = p * 26, a = 1 - p
        ctx.save(); ctx.globalAlpha = a
        ctx.strokeStyle = C.pAccent; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = `rgba(255,150,0,${a * 0.5})`
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r * 0.5, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      })
      drawHUD(ctx, g.score, g.lives, g.wave)
    }

    rafId = requestAnimationFrame(tick)

    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { keys.current.left  = true; e.preventDefault() }
      if (e.key === 'ArrowRight') { keys.current.right = true; e.preventDefault() }
      if (e.key === ' ' || e.key === 'z' || e.key === 'Z') { keys.current.fire = true; e.preventDefault() }
    }
    const onKU = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  keys.current.left  = false
      if (e.key === 'ArrowRight') keys.current.right = false
      if (e.key === ' ' || e.key === 'z' || e.key === 'Z') keys.current.fire = false
    }
    window.addEventListener('keydown', onKD)
    window.addEventListener('keyup', onKU)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU) }
  }, [])

  // ── 터치 핸들러 (RAF 루프에서 keysRef 읽기) ─────────────────────
  const press   = (k: keyof typeof keys.current) => () => { keys.current[k] = true }
  const release = (k: keyof typeof keys.current) => () => { keys.current[k] = false }

  return (
    <div className="flex flex-col h-full bg-[#0F0A04]" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* 캔버스 영역 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#0F0A04]">
        {uiPhase === 'gameover' && (
          <div className="absolute z-10 flex flex-col items-center gap-4 pointer-events-none">
            <p className="font-pixel text-xl text-rejected" style={{ textShadow: '2px 2px 0 #000' }}>GAME OVER</p>
            <p className="font-pixel text-base text-gold">{uiScore.toLocaleString()} PTS</p>
          </div>
        )}
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} />
      </div>

      {/* ── 모바일 터치 패드 ───────────────────────────────────────── */}
      <div className="flex-shrink-0 h-[130px] bg-panel-darkest border-t-4 border-black
                      flex items-center justify-between px-3 gap-2">
        {/* 이동 버튼 */}
        <div className="flex gap-2">
          <button type="button"
            onTouchStart={press('left')} onTouchEnd={release('left')}
            onMouseDown={press('left')}  onMouseUp={release('left')} onMouseLeave={release('left')}
            className="w-[60px] h-[60px] bg-panel-dark border-4 border-panel-border
                       flex items-center justify-center text-cream text-2xl
                       active:bg-gold/20 active:border-gold select-none">
            ◄
          </button>
          <button type="button"
            onTouchStart={press('right')} onTouchEnd={release('right')}
            onMouseDown={press('right')}  onMouseUp={release('right')} onMouseLeave={release('right')}
            className="w-[60px] h-[60px] bg-panel-dark border-4 border-panel-border
                       flex items-center justify-center text-cream text-2xl
                       active:bg-gold/20 active:border-gold select-none">
            ►
          </button>
        </div>

        {/* 나가기 */}
        <button type="button" onClick={onBack}
          className="font-korean text-xs text-panel-sub border border-panel-border
                     px-2 py-1.5 bg-panel-dark active:opacity-70 flex-shrink-0">
          나가기
        </button>

        {/* 발사 버튼 */}
        <button type="button"
          onTouchStart={press('fire')} onTouchEnd={release('fire')}
          onMouseDown={press('fire')}  onMouseUp={release('fire')} onMouseLeave={release('fire')}
          className="w-[72px] h-[72px] bg-purple border-4 border-black
                     flex items-center justify-center text-3xl
                     active:bg-gold active:border-gold select-none">
          🔫
        </button>
      </div>

      {/* HUD 보조 정보 */}
      <div className="flex-shrink-0 h-[28px] bg-panel-darkest border-t-2 border-black
                      flex items-center justify-between px-3">
        <span className="font-pixel text-xs text-gold">{uiScore.toLocaleString()}</span>
        <span className="font-pixel text-xs text-cream">WAVE {uiWave}</span>
        <span className="font-pixel text-xs text-purple">{'♥'.repeat(uiLives)}</span>
      </div>
    </div>
  )
}
