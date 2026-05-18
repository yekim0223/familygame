// Design Ref: §5.2 Pixel UI — 픽셀 버튼 컴포넌트
// 폰트 정책: 한글 포함 시 font-korean, 영문 전용 시 font-pixel
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'gold' | 'danger' | 'ghost' | 'success' | 'sky'
type FontMode = 'korean' | 'pixel'

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  fontMode?: FontMode
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-purple  text-white      border-purple/80 hover:bg-purple/90',
  gold:    'bg-gold    text-pixel-dark  border-yellow-600 hover:bg-yellow-400',
  danger:  'bg-rejected text-white     border-red-800   hover:bg-red-600',
  ghost:   'bg-cream   text-pixel-dark  border-dirt      hover:border-gold',
  success: 'bg-approved text-white     border-green-800 hover:bg-green-500',
  sky:     'bg-sky     text-pixel-dark  border-blue-500  hover:bg-blue-300',
}

// 한글 포함 (Korean) — 가독성 우선
const sizeKorean: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2   text-sm',
  lg: 'px-6 py-3   text-base',
}

// 영문 전용 (Pixel) — 게임 레이블
const sizePixel: Record<string, string> = {
  sm: 'px-3 py-1.5 text-[8px]',
  md: 'px-4 py-2   text-[9px]',
  lg: 'px-6 py-3   text-[10px]',
}

export function PixelButton({
  variant  = 'primary',
  size     = 'md',
  fullWidth = false,
  fontMode  = 'korean',
  className = '',
  disabled,
  type = 'button',
  children,
  ...props
}: PixelButtonProps) {
  const fontCls   = fontMode === 'pixel' ? 'font-pixel' : 'font-korean font-bold'
  const sizeCls   = fontMode === 'pixel' ? sizePixel[size] : sizeKorean[size]

  return (
    <button
      {...props}
      type={type}
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
