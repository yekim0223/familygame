// Design Ref: §3-2 Component System — 픽셀 카드 컴포넌트 (v3.0)
// Variant: dark(default), special, highlight, light
// Padding: none, sm, md(default), lg
import type { HTMLAttributes } from 'react'

type Variant = 'dark' | 'special' | 'highlight' | 'light'
type Padding = 'none' | 'sm' | 'md' | 'lg'

export interface PixelCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
}

const variantStyles: Record<Variant, string> = {
  // 기본 — 다크 마인크래프트 패널
  dark:      'bg-panel-mid border-4 border-panel-border shadow-pixel',
  // 특별 퀘스트 — 다크 패널 + 황금 네온 테두리 펄스 (bg-[#D4A843] 시각피로 폐기)
  special:   'bg-panel-dark border-4 border-yellow-400 card-special',
  // 홈 섹션 강조 — panel-surface 배경 + 옅은 gold 테두리
  highlight: 'bg-panel-surface border-2 border-gold/40',
  // 밝은 배경이 필요한 경우 (로그인 등)
  light:     'bg-cream border-4 border-pixel-dark shadow-pixel',
}

const paddingStyles: Record<Padding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
}

export function PixelCard({
  variant = 'dark',
  padding = 'md',
  className = '',
  children,
  ...props
}: PixelCardProps) {
  return (
    <div
      {...props}
      className={[variantStyles[variant], paddingStyles[padding], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
