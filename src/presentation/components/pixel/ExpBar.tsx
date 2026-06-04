// Design Ref: §5.2 Pixel UI — 픽셀 블록 경험치 바
import { getLevelProgress } from '@/domain/services/ExpCalc'

interface ExpBarProps {
  exp: number
  level: number
  showLabel?: boolean
  className?: string
}

export function ExpBar({ exp, level, showLabel = true, className = '' }: ExpBarProps) {
  const { current, needed } = getLevelProgress(exp)
  const percent = needed > 0 ? Math.min(100, (current / needed) * 100) : 100

  return (
    <div className={`space-y-0.5 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center">
          <span className="font-pixel text-xs text-purple">Lv.{level}</span>
          <span className="font-korean text-xs text-cream/70">{current}/{needed} EXP</span>
        </div>
      )}
      <div className="exp-bar">
        <div className="exp-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
