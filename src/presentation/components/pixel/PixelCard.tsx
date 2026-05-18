// Design Ref: §5.2 Pixel UI — 돌 블록 스타일 카드
import type { HTMLAttributes } from 'react'

interface PixelCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
}

const paddingStyles = { sm: 'p-3', md: 'p-4', lg: 'p-5' }

export function PixelCard({ padding = 'md', className = '', children, ...props }: PixelCardProps) {
  return (
    <div
      {...props}
      className={`card-pixel ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </div>
  )
}
