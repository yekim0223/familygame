// Design Ref: §4-4 캐릭터 선택 UI — 인벤토리 격자 (v3.0 MC Dark)
// globals.css .inventory-slot / .inventory-slot.selected / .inventory-slot.unlocked 사용
import { useState } from 'react'
import { CHARACTER_EMOJI, CHARACTER_LABELS } from '@/application/use-cases/characters/selectCharacter'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'

interface InventorySlot {
  id: string
  requiredLevel?: number
  emoji?: string
  label?: string
}

interface InventoryGridProps {
  slots: InventorySlot[]
  unlockedIds: string[]
  selectedId: string
  onSelect: (id: string) => void
  currentLevel: number
  columns?: number
  pageSize?: number
}

// globals.css .inventory-slot + modifier 조합
// !w-full !h-auto overrides the fixed w-16 h-16 from .inventory-slot
const SLOT_BASE     = 'inventory-slot !w-full !h-auto min-h-[60px] flex flex-col items-center justify-center p-1.5 relative transition-all'
const SLOT_SELECTED = `${SLOT_BASE} selected`   // → .inventory-slot.selected: border-gold bg-panel-dark
const SLOT_UNLOCKED = `${SLOT_BASE} unlocked hover:!border-gold/60 active:translate-y-0.5 cursor-pointer`
const SLOT_LOCKED   = `${SLOT_BASE} opacity-40 !cursor-not-allowed`

export function InventoryGrid({
  slots, unlockedIds, selectedId, onSelect, currentLevel, columns = 5, pageSize = 20
}: InventoryGridProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? slots : slots.slice(0, pageSize)
  const hasMore = slots.length > pageSize

  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {visible.map(slot => {
          const isUnlocked = unlockedIds.includes(slot.id)
          const isSelected = selectedId === slot.id
          const emoji      = slot.emoji ?? CHARACTER_EMOJI[slot.id] ?? '❓'
          const label      = slot.label ?? CHARACTER_LABELS[slot.id] ?? slot.id

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => isUnlocked && onSelect(slot.id)}
              disabled={!isUnlocked}
              title={isUnlocked ? label : `Lv.${slot.requiredLevel} 달성 시 오픈`}
              className={isSelected ? SLOT_SELECTED : isUnlocked ? SLOT_UNLOCKED : SLOT_LOCKED}
            >
              <span className="text-2xl leading-none">{emoji}</span>
              <span className="font-korean text-xs mt-0.5 leading-tight text-center text-cream truncate w-full">
                {isUnlocked ? label : `Lv.${slot.requiredLevel ?? (currentLevel + 1)}`}
              </span>
              {!isUnlocked && (
                <span className="absolute top-0.5 right-0.5 text-xs leading-none">🔒</span>
              )}
              {isSelected && (
                <span className="absolute top-0.5 left-0.5 text-xs leading-none">✅</span>
              )}
            </button>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-2">
          <PixelButton
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => setExpanded(p => !p)}
          >
            {expanded
              ? `▲ 접기 (${slots.length}개 중 ${pageSize}개만 보기)`
              : `▼ 펼쳐보기 (${slots.length - pageSize}개 더 보기)`}
          </PixelButton>
        </div>
      )}
    </div>
  )
}
