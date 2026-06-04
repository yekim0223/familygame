// Design Ref: §4-4 캐릭터 선택 UI — 인벤토리 격자 (v3.0 MC Dark)
// globals.css .inventory-slot / .inventory-slot.selected / .inventory-slot.unlocked 사용
import { useState } from 'react'
import { CHARACTER_EMOJI, CHARACTER_LABELS } from '@/application/use-cases/characters/selectCharacter'
import { CHAR_SVG_SET, PET_SVG_SET, BANNER_SVG_SET } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'

interface InventorySlot {
  id: string
  requiredLevel?: number
  emoji?: string
  label?: string
  svgPath?: string   // 장비 등 직접 경로 지정 시
}

interface InventoryGridProps {
  slots: InventorySlot[]
  unlockedIds: string[]
  selectedId: string
  onSelect: (id: string) => void
  currentLevel: number
  columns?: number
  pageSize?: number
  allowDeselect?: boolean  // 선택된 아이템 재클릭 시 해제 (두 번 클릭 = 선택 해제)
}

// globals.css .inventory-slot + modifier 조합
// !w-full !h-auto overrides the fixed w-16 h-16 from .inventory-slot
const SLOT_BASE     = 'inventory-slot !w-full !h-auto min-h-[60px] min-w-0 flex flex-col items-center justify-center p-1.5 relative transition-colors'
const SLOT_SELECTED = `${SLOT_BASE} selected`   // → .inventory-slot.selected: border-gold bg-panel-dark
const SLOT_UNLOCKED = `${SLOT_BASE} unlocked hover:!border-gold/60 active:translate-y-0.5 cursor-pointer`
const SLOT_LOCKED   = `${SLOT_BASE} opacity-40 !cursor-not-allowed`

export function InventoryGrid({
  slots, unlockedIds, selectedId, onSelect, currentLevel, columns = 5, pageSize = 20,
  allowDeselect = false,
}: InventoryGridProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? slots : slots.slice(0, pageSize)
  const hasMore = slots.length > pageSize

  return (
    <div className="w-full overflow-x-hidden">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, minWidth: 0 }}>
        {visible.map(slot => {
          const isUnlocked = unlockedIds.includes(slot.id)
          const isSelected = selectedId === slot.id
          const emoji      = slot.emoji ?? CHARACTER_EMOJI[slot.id] ?? '❓'
          const label      = slot.label ?? CHARACTER_LABELS[slot.id] ?? slot.id

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => {
                if (!isUnlocked) return
                if (isSelected && allowDeselect) { onSelect(''); return }
                onSelect(slot.id)
              }}
              disabled={!isUnlocked}
              title={isUnlocked ? label : `Lv.${slot.requiredLevel} 달성 시 오픈`}
              className={isSelected ? SLOT_SELECTED : isUnlocked ? SLOT_UNLOCKED : SLOT_LOCKED}
            >
              {slot.svgPath ? (
                <img src={slot.svgPath} alt={label} draggable={false}
                  style={{ width: 36, height: 36, objectFit: 'contain', imageRendering: 'pixelated' }} />
              ) : CHAR_SVG_SET.has(slot.id) ? (
                <img src={`/assets/characters/${slot.id}.svg`} alt={label} draggable={false}
                  style={{ width: 36, height: 36, objectFit: 'contain', imageRendering: 'pixelated' }} />
              ) : PET_SVG_SET.has(slot.id) ? (
                <img src={`/assets/pets/${slot.id}.svg`} alt={label} draggable={false}
                  style={{ width: 36, height: 36, objectFit: 'contain', imageRendering: 'pixelated' }} />
              ) : BANNER_SVG_SET.has(slot.id) ? (
                <img src={`/assets/backgrounds/${slot.id}.svg`} alt={label} draggable={false}
                  style={{ width: 36, height: 36, objectFit: 'cover', imageRendering: 'pixelated', borderRadius: 2 }} />
              ) : (
                <span className="text-2xl leading-none">{emoji}</span>
              )}
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
