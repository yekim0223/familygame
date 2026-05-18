// Design Ref: §4-4 캐릭터 선택 UI — 인벤토리 격자 (펼쳐보기 지원)
import { useState } from 'react'
import { CHARACTER_EMOJI, CHARACTER_LABELS } from '@/application/use-cases/characters/selectCharacter'

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
  pageSize?: number  // 초기 표시 수 (기본 20)
}

export function InventoryGrid({
  slots, unlockedIds, selectedId, onSelect, currentLevel, columns = 5, pageSize = 20
}: InventoryGridProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? slots : slots.slice(0, pageSize)
  const hasMore = slots.length > pageSize

  return (
    <div>
      <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {visible.map(slot => {
          const isUnlocked = unlockedIds.includes(slot.id)
          const isSelected = selectedId === slot.id
          const emoji = slot.emoji ?? CHARACTER_EMOJI[slot.id] ?? '❓'
          const label = slot.label ?? CHARACTER_LABELS[slot.id] ?? slot.id

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => isUnlocked && onSelect(slot.id)}
              disabled={!isUnlocked}
              title={isUnlocked ? label : `Lv.${slot.requiredLevel} 달성 시 오픈`}
              className={[
                'flex flex-col items-center justify-center p-1.5 border-4 border-pixel-dark',
                'min-h-[60px] relative transition-all',
                isSelected
                  ? 'bg-gold/30 border-gold shadow-pixel'
                  : isUnlocked
                    ? 'bg-cream hover:bg-yellow-50 hover:border-gold active:translate-y-0.5'
                    : 'bg-stone/30 cursor-not-allowed opacity-60',
              ].join(' ')}
            >
              <span className="text-2xl leading-none">{emoji}</span>
              <span className="font-korean text-[8px] mt-0.5 leading-tight text-center text-pixel-dark truncate w-full">
                {isUnlocked ? label : `Lv.${slot.requiredLevel}`}
              </span>
              {!isUnlocked && (
                <span className="absolute top-0.5 right-0.5 text-[10px]">🔒</span>
              )}
              {isSelected && (
                <span className="absolute top-0.5 left-0.5 text-[10px]">✅</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 펼쳐보기 / 접기 버튼 */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          className="w-full mt-2 py-2 font-korean text-xs font-bold border-2 border-pixel-dark
                     bg-cream text-pixel-dark hover:border-gold hover:bg-gold/10 transition-all"
        >
          {expanded
            ? `▲ 접기 (${slots.length}개 중 ${pageSize}개만 보기)`
            : `▼ 펼쳐보기 (${slots.length - pageSize}개 더 보기)`}
        </button>
      )}
    </div>
  )
}
