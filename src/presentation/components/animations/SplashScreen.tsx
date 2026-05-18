// 스플래시 화면 — 5초 / 3종 애니메이션 (GPU 가속)
// A. 3D 원근 펄싱  B. 블록 파티클  C. 글로스 shimmer
import { useEffect, useRef, useState } from 'react'

interface SplashScreenProps { onDone: () => void }

// 단계별 타임라인 (ms)
const PHASES = [200, 900, 1600, 2100, 4200] as const
// 0→검정  1→FAMILY  2→QUEST+파티클  3→자막  4→장식+shimmer  5→페이드아웃

// 파티클 색상 팔레트 (연두·주황 계열)
const P_COLORS = ['#ADFF2F','#7FFF00','#FF8C00','#FFB347','#FFF44F','#00FF7F','#FFD700','#FF6347']

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState(0)
  const phaseRef    = useRef(0)        // 클로저 캡처 방지용
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const animIdRef   = useRef(0)
  const spawnRef    = useRef<ReturnType<typeof setInterval>>()
  const skipRef     = useRef(false)

  // ── 5초 타이밍 ──────────────────────────────────────────────
  useEffect(() => {
    const timers = PHASES.map((ms, i) =>
      setTimeout(() => {
        phaseRef.current = i + 1
        setPhase(i + 1)
      }, ms)
    )
    const done = setTimeout(() => onDone(), 5000)
    return () => { timers.forEach(clearTimeout); clearTimeout(done) }
  }, [onDone])

  // ── B. Canvas 블록 파티클 시스템 ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // 캔버스 크기 = 뷰포트
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    interface P {
      x: number; y: number; size: number
      color: string; dx: number; dy: number; life: number
    }
    const pts: P[] = []

    // 로고 중심 기준 파티클 생성
    const spawn = () => {
      if (phaseRef.current < 2 || phaseRef.current >= 5) return
      const cx = canvas.width  * 0.5
      const cy = canvas.height * 0.38
      const n  = Math.floor(Math.random() * 5) + 4
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2
        const spd   = Math.random() * 3 + 1.5
        pts.push({
          x: cx + (Math.random() - 0.5) * 240,
          y: cy + (Math.random() - 0.5) * 100,
          size:  Math.floor(Math.random() * 6) + 3,
          color: P_COLORS[Math.floor(Math.random() * P_COLORS.length)],
          dx: Math.cos(angle) * spd,
          dy: Math.sin(angle) * spd - 2.2,
          life: 1.0,
        })
      }
    }

    // RAF 렌더 루프 (GPU Canvas 2D)
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i]
        p.x   += p.dx
        p.y   += p.dy
        p.dy  += 0.09            // 중력
        p.life -= 0.026
        if (p.life <= 0) { pts.splice(i, 1); continue }
        ctx.globalAlpha = Math.min(p.life, 1)
        ctx.fillStyle   = p.color
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
      }
      ctx.globalAlpha = 1
      animIdRef.current = requestAnimationFrame(render)
    }

    spawnRef.current  = setInterval(spawn, 750)
    animIdRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      clearInterval(spawnRef.current)
      cancelAnimationFrame(animIdRef.current)
    }
  }, [])

  // ── 터치 건너뛰기 ─────────────────────────────────────────────
  const handleSkip = () => {
    if (skipRef.current) return
    skipRef.current = true
    phaseRef.current = 5
    setPhase(5)
    setTimeout(() => onDone(), 450)
  }

  // 단계별 표시 여부
  const show = (n: number) => phase >= n

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center
                  transition-opacity duration-700 ${phase >= 5 ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#080808', willChange: 'opacity' }}
    >
      {/* B. 파티클 캔버스 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ willChange: 'contents', imageRendering: 'pixelated' }}
      />

      {/* ── 로고 중앙 영역 ── */}
      <div className="relative z-10 text-center select-none">

        {/* A. 3D 원근 펄싱 wrapper */}
        <div style={{
          display: 'inline-block',
          perspective: '600px',
          perspectiveOrigin: '50% 60%',
          animation: show(3) ? 'logoPulse3D 3.2s ease-in-out infinite' : 'none',
          willChange: 'transform',
        }}>

          {/* 금색 테두리 박스 */}
          <div
            className="relative overflow-hidden px-10 py-5 mb-5"
            style={{
              border: '4px solid #FFD700',
              animation: show(2) ? 'borderGlow 2s ease-in-out infinite' : 'none',
              willChange: 'box-shadow',
              transition: 'box-shadow 0.8s ease',
            }}
          >
            {/* C. 글로스 shimmer 오버레이 */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(112deg, transparent 25%, rgba(255,255,255,0.22) 50%, transparent 75%)',
                animation: show(4) ? 'logoGloss 2.8s ease-in-out infinite' : 'none',
                willChange: 'transform',
              }}
            />

            {/* FAMILY */}
            <p className="font-pixel text-gold leading-tight"
              style={{
                fontSize: 'clamp(1.7rem, 8vw, 2.4rem)',
                letterSpacing: '0.12em',
                textShadow: show(1)
                  ? '0 0 20px #FFD700, 0 0 50px rgba(255,215,0,0.4), 3px 3px 0 #7B5000'
                  : 'none',
                opacity:   show(1) ? 1 : 0,
                transform: show(1) ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.78)',
                transition:'opacity 0.55s ease, transform 0.55s cubic-bezier(0.34,1.56,0.64,1), text-shadow 0.9s ease',
                willChange: 'transform, opacity',
              }}>
              FAMILY
            </p>

            {/* QUEST */}
            <p className="font-pixel text-gold leading-tight"
              style={{
                fontSize: 'clamp(1.7rem, 8vw, 2.4rem)',
                letterSpacing: '0.12em',
                textShadow: show(2)
                  ? '0 0 20px #FFD700, 0 0 50px rgba(255,215,0,0.4), 3px 3px 0 #7B5000'
                  : 'none',
                opacity:   show(2) ? 1 : 0,
                transform: show(2) ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.78)',
                transition:'opacity 0.55s ease, transform 0.55s cubic-bezier(0.34,1.56,0.64,1), text-shadow 0.9s ease',
                willChange: 'transform, opacity',
              }}>
              QUEST
            </p>
          </div>
        </div>

        {/* 슬로건 */}
        <p className="font-korean text-stone text-sm"
          style={{
            letterSpacing: '0.16em',
            opacity:   show(3) ? 1 : 0,
            transform: show(3) ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.65s ease 0.1s, transform 0.65s ease 0.1s',
          }}>
          우리 가족 미션 보상 앱
        </p>

        {/* 픽셀 아이콘 장식 */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {(['⚔️','⛏️','🏆','⛏️','⚔️'] as const).map((icon, i) => (
            <span key={i} style={{
              fontSize: i === 2 ? '1.4rem' : '0.9rem',
              display: 'inline-block',
              opacity:   show(4) ? 1 : 0,
              transform: show(4) ? 'scale(1) translateY(0)' : 'scale(0) translateY(10px)',
              transition: `all 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.08}s`,
            }}>
              {icon}
            </span>
          ))}
        </div>
      </div>

      {/* 하단 안내 텍스트 */}
      <p
        className="absolute bottom-12 font-korean text-stone"
        style={{
          fontSize: '10px', letterSpacing: '0.1em',
          opacity:   show(3) ? 0.4 : 0,
          transition: 'opacity 0.6s ease 0.4s',
        }}>
        화면을 터치하면 건너뛰어요
      </p>

      {/* 픽셀 로딩 바 */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-36 border border-stone/20"
        style={{ height: '6px', background: 'rgba(158,158,158,0.15)' }}>
        <div
          style={{
            height: '100%',
            background: '#FFD700',
            width: `${(Math.min(phase, 4) / 4) * 100}%`,
            transition: 'width 0.55s ease',
            willChange: 'width',
          }}
        />
      </div>
    </div>
  )
}
