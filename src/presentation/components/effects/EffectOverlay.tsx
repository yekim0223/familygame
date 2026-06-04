import { CSSProperties, useEffect, useMemo, useState } from 'react'

export type EffectType = 'confetti' | 'hearts' | 'stars' | 'coins' | 'fire'

interface EffectOverlayProps {
  type: EffectType
  duration?: number   // ms
  count?: number      // 파티클 수 (최대 30)
  onEnd?: () => void
}

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4FC3F7', '#7B5EA7', '#43A047', '#E8A0BF', '#FB8C00']
const HEART_EMOJIS    = ['❤️', '💖', '💕', '💗']
const STAR_EMOJIS     = ['⭐', '🌟', '✨']
const FIRE_EMOJIS     = ['🔥', '✨', '💥']
const COIN_EMOJIS     = ['🪙', '⭐', '💰']

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function buildParticles(type: EffectType, count: number) {
  const n = Math.min(count, 30)
  return Array.from({ length: n }, (_, i) => {
    const delay = rand(0, 0.6)
    const dur   = rand(0.9, 1.6)
    const size  = rand(18, 32)
    const startX = rand(10, 90)  // vw%
    const startY = rand(30, 80)  // vh%

    if (type === 'confetti') {
      const angle = (i / n) * 2 * Math.PI + rand(-0.3, 0.3)
      const dist  = rand(80, 180)
      return {
        key: i, emoji: '',
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        cls: 'animate-confetti',
        style: {
          '--ex': `${Math.cos(angle) * dist}px`,
          '--ey': `${Math.sin(angle) * dist - 60}px`,
          '--er': `${rand(-360, 360)}deg`,
          '--delay': `${delay}s`,
          '--dur': `${dur}s`,
          left: `${50 + Math.cos(angle) * 15}%`,
          top: `${45 + Math.sin(angle) * 10}%`,
          width: `${rand(8, 14)}px`,
          height: `${rand(8, 14)}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          position: 'absolute',
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        } as CSSProperties,
      }
    }

    if (type === 'hearts') {
      return {
        key: i, emoji: HEART_EMOJIS[i % HEART_EMOJIS.length],
        color: '', cls: 'animate-heart',
        style: {
          '--hx':  `${rand(-20, 20)}px`,
          '--hx2': `${rand(-15, 15)}px`,
          '--delay': `${delay}s`,
          '--dur': `${dur}s`,
          left: `${startX}%`,
          top: `${startY}%`,
          fontSize: `${size}px`,
          position: 'absolute',
        } as CSSProperties,
      }
    }

    if (type === 'stars') {
      return {
        key: i, emoji: STAR_EMOJIS[i % STAR_EMOJIS.length],
        color: '', cls: 'animate-star',
        style: {
          '--sy': `${rand(60, 160)}px`,
          '--sx': `${rand(-40, 40)}px`,
          '--delay': `${delay}s`,
          '--dur': `${rand(0.7, 1.2)}s`,
          left: `${rand(5, 95)}%`,
          top: `${rand(5, 40)}%`,
          fontSize: `${size}px`,
          position: 'absolute',
        } as CSSProperties,
      }
    }

    if (type === 'fire') {
      return {
        key: i, emoji: FIRE_EMOJIS[i % FIRE_EMOJIS.length],
        color: '', cls: 'animate-fire',
        style: {
          '--fy':  `${rand(-50, -80)}px`,
          '--fy2': `${rand(-90, -130)}px`,
          '--delay': `${delay * 0.5}s`,
          '--dur': `${rand(0.7, 1.1)}s`,
          left: `${startX}%`,
          top: `${startY}%`,
          fontSize: `${size}px`,
          position: 'absolute',
        } as CSSProperties,
      }
    }

    // coins
    return {
      key: i, emoji: COIN_EMOJIS[i % COIN_EMOJIS.length],
      color: '', cls: 'animate-confetti',
      style: {
        '--ex': `${rand(-80, 80)}px`,
        '--ey': `${rand(-100, -160)}px`,
        '--er': `${rand(-180, 180)}deg`,
        '--delay': `${delay}s`,
        '--dur': `${dur}s`,
        left: `${startX}%`,
        top: `${startY}%`,
        fontSize: `${size}px`,
        position: 'absolute',
      } as CSSProperties,
    }
  })
}

export function EffectOverlay({ type, duration = 1800, count = 24, onEnd }: EffectOverlayProps) {
  // I-2: prefers-reduced-motion 가드 — 접근성 대응
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // I-3: PixelModal 열린 중 억제 (body.modal-open 클래스로 판단)
  const modalOpen = typeof document !== 'undefined'
    && document.body.classList.contains('modal-open')

  const [visible, setVisible] = useState(true)
  // M-4: 파티클 메모이즈 — type/count 변경 시만 재계산
  const particles = useMemo(() => buildParticles(type, count), [type, count])

  useEffect(() => {
    if (prefersReduced || modalOpen) { onEnd?.(); return }
    const t = setTimeout(() => {
      setVisible(false)
      onEnd?.()
    }, duration)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 9990 }}
    >
      {particles.map(p =>
        p.emoji ? (
          <span key={p.key} className={`select-none ${p.cls}`} style={p.style}>
            {p.emoji}
          </span>
        ) : (
          <div key={p.key} className={p.cls} style={p.style} />
        )
      )}
    </div>
  )
}
