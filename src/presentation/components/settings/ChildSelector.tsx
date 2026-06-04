// 자녀 선택 공통 버튼 그룹 — SettingsPage 칭찬/응원 섹션에서 공유 사용
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import type { Member } from '@/domain/entities/Member'

interface Props {
  children: Member[]
  selectedId: string
  onSelect: (id: string) => void
  showAvatar?: boolean
}

export function ChildSelector({ children, selectedId, onSelect, showAvatar = false }: Props) {
  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {children.map(c => (
        <PixelButton
          key={c.id}
          variant={selectedId === c.id ? 'gold' : 'ghost'}
          size="sm"
          onClick={() => onSelect(c.id)}
          className={showAvatar ? 'flex items-center gap-1.5' : ''}
        >
          {showAvatar && (
            <CharacterSprite
              characterId={c.character.characterId}
              role={c.role}
              size="sm"
              weapon={null}
              petId={null}
              className="pointer-events-none"
            />
          )}
          {c.name}
        </PixelButton>
      ))}
    </div>
  )
}
