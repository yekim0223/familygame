// Design Ref: §3-3 Component System — 공통 팝업 컴포넌트 (v3.0)
// 모든 팝업은 이 컴포넌트를 사용한다. z-[9999] 고정, dimming bg-black/60 고정.
import type { ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg'

export interface PixelModalProps {
  open: boolean
  onClose?: () => void
  title?: string
  children: ReactNode
  size?: ModalSize
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-xs',
  md: 'max-w-sm',
  lg: 'max-w-md',
}

export function PixelModal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: PixelModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6">
      <div
        className={`bg-panel-mid border-4 border-panel-border shadow-pixel w-full ${sizeStyles[size]}`}
      >
        {/* title 또는 onClose 중 하나라도 있으면 헤더 렌더링 */}
        {(title || onClose) && (
          <div className="px-4 border-b-4 border-panel-border flex items-center justify-between"
               style={{ minHeight: '52px' }}>
            {title ? (
              <p className="font-korean font-bold text-base text-gold">{title}</p>
            ) : (
              <span />
            )}
            {onClose && (
              /* 터치 영역 44×44px 확보 — 아이 터치 기준 */
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center font-pixel text-sm
                           text-panel-sub hover:text-cream flex-shrink-0"
                style={{ width: '44px', height: '44px' }}
                aria-label="닫기"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
