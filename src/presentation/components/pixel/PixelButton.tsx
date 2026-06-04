// Design Ref: §3-1 Component System — 픽셀 버튼 컴포넌트 (v3.0)
// Variant: gold(primary), purple(secondary), ghost, danger, success, sky, hold
// 폰트 정책: 한글 포함 시 font-korean, 영문 전용 시 font-pixel
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'purple' | 'gold' | 'danger' | 'ghost' | 'success' | 'sky' | 'hold'
type FontMode = 'korean' | 'pixel'

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  fontMode?: FontMode
}

const variantStyles: Record<Variant, string> = {
  // primary = purple alias (하위 호환)
  primary: 'bg-purple  text-white      border-purple/80 hover:bg-purple/90',
  purple:  'bg-purple  text-white      border-purple/80 hover:bg-purple/90',
  gold:    'bg-gold    text-pixel-dark  border-yellow-600 hover:bg-yellow-400',
  danger:  'bg-rejected text-white     border-red-800   hover:bg-red-600',
  // ghost: 다크 테마 전용 — 투명 배경 + panel-border 테두리
  ghost:   'bg-transparent text-cream  border-panel-border hover:border-gold',
  success: 'bg-approved text-white     border-green-800 hover:bg-green-500',
  sky:     'bg-sky     text-pixel-dark  border-blue-500  hover:bg-blue-300',
  hold:    'bg-hold    text-white      border-orange-700 hover:bg-orange-500',
}

// 한글 포함 (Korean) — 가독성 우선, md: 터치 높이 ~40px (py-2.5)
const sizeKorean: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3   text-base',
}

// 영문 전용 (Pixel) — 게임 레이블
const sizePixel: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-xs',
  lg: 'px-6 py-3   text-xs',
}

export function PixelButton({
  variant  = 'purple',
  size     = 'md',
  fullWidth = false,
  fontMode  = 'korean',
  className = '',
  disabled,
  children,
  ...props
}: PixelButtonProps) {
  const fontCls   = fontMode === 'pixel' ? 'font-pixel' : 'font-korean font-bold'
  const sizeCls   = fontMode === 'pixel' ? sizePixel[size] : sizeKorean[size]

  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      disabled={disabled}
      className={[
        'btn-pixel',
        fontCls,
        sizeCls,
        variantStyles[variant],
        fullWidth ? 'w-full' : '',
        disabled
          ? 'opacity-50 cursor-not-allowed active:translate-y-0 active:shadow-pixel'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
