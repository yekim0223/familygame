// GamePad — 공통 게임 컨트롤 패드 (완전 대칭 정사각형 도트 스타일)
// layout='dpad'   : 갤러그·너구리 — 좌/우 이동 + 액션
// layout='action' : 단일 점프 버튼 (너구리)
import React from 'react'

// ── 패드 버튼 ────────────────────────────────────────────────────────
interface PadBtnProps {
  label?: React.ReactNode
  onPress?: () => void
  onRelease?: () => void
  variant?: 'normal' | 'accent' | 'danger' | 'muted'
  wide?: boolean
}

function PadBtn({ label, onPress, onRelease, variant = 'normal', wide = false }: PadBtnProps) {
  const base = [
    'flex items-center justify-center',
    wide ? 'w-24 h-12' : 'w-12 h-12',
    'border-4 select-none',
    'shadow-[inset_2px_2px_0px_#ffffff30,inset_-2px_-2px_0px_#00000060]',
    'active:shadow-[inset_-1px_-1px_0px_#ffffff20,inset_1px_1px_0px_#00000080]',
    'active:translate-y-0.5 transition-transform duration-50',
    'touch-none',
  ]
  const vars: Record<string, string> = {
    normal: 'bg-panel-dark border-panel-border',
    accent: 'bg-gold/80 border-yellow-600',
    danger: 'bg-rejected border-red-800',
    muted:  'bg-panel-mid border-panel-border opacity-70',
  }
  return (
    <div
      className={[...base, vars[variant]].join(' ')}
      onPointerDown={e => { e.preventDefault(); onPress?.() }}
      onPointerUp={e => { e.preventDefault(); onRelease?.() }}
      onPointerLeave={e => { e.preventDefault(); onRelease?.() }}
    >
      {label}
    </div>
  )
}

// ── 방향 패드 (좌/우) + 우측 액션 ────────────────────────────────────
interface DPadProps {
  onLeft:    () => void
  onLeftEnd: () => void
  onRight:    () => void
  onRightEnd: () => void
  actionLabel?: React.ReactNode
  onAction?:    () => void
  onActionEnd?: () => void
  actionVariant?: PadBtnProps['variant']
}

export function DPad({
  onLeft, onLeftEnd, onRight, onRightEnd,
  actionLabel, onAction, onActionEnd, actionVariant = 'accent',
}: DPadProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-3 pt-1">
      {/* 좌/우 이동 */}
      <div className="flex gap-2">
        <PadBtn
          label={<span className="font-pixel text-base text-cream">◄</span>}
          onPress={onLeft}
          onRelease={onLeftEnd}
        />
        <PadBtn
          label={<span className="font-pixel text-base text-cream">►</span>}
          onPress={onRight}
          onRelease={onRightEnd}
        />
      </div>

      {/* 스페이서 */}
      <div className="w-12 h-12" />

      {/* 액션 버튼 */}
      {onAction && (
        <PadBtn
          label={actionLabel ?? <span className="font-pixel text-xs text-pixel-dark">ACT</span>}
          onPress={onAction}
          onRelease={onActionEnd}
          variant={actionVariant}
        />
      )}
    </div>
  )
}

// ── 단일 점프 버튼 (너구리) ─────────────────────────────────────────
interface JumpPadProps {
  onJump: () => void
}

export function JumpPad({ onJump }: JumpPadProps) {
  return (
    <div className="flex items-center justify-center pb-3 pt-1">
      <PadBtn
        label={
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl">🦘</span>
            <span className="font-pixel text-xs text-pixel-dark">JUMP</span>
          </div>
        }
        onPress={onJump}
        variant="accent"
        wide
      />
    </div>
  )
}
