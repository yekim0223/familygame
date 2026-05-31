// CharacterSprite — 레이어드 픽셀 아바타
// L1: 픽셀 배경 테마 (MC 다크 우드 #1A1208 통일 + 역할별 액센트 테두리)
// L2: 캐릭터 이모지 본체 (직업 또는 사람)
// L3: 반려동물 바운스 오버레이 (우하단 절대 위치, petBounce 애니메이션)
// L4: 무기 오버레이 (우하단 — job variant만)
// 안전장치: 레거시 이모지 문자열 → ID 치환 + 폴백 처리
// prop 미전달(undefined) 시 자동 폴백: characterId→currentSkin, weapon→currentWeapon, petId→currentPet
import type { Role } from '@/domain/entities/Member'
import { CHARACTER_EMOJI, CHARACTER_LABELS, PET_UNLOCKS } from '@/application/use-cases/characters/selectCharacter'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'

// ── 레거시 이모지 → ID 역방향 매핑 (안전장치) ────────────────────────
const LEGACY_EMOJI_TO_CHAR_ID: Record<string, string> = {
  '🗡️': 'rogue',   '⚔️': 'warrior',  '🏹': 'archer',
  '🧙': 'mage',    '👨‍🍳': 'chef',    '🛡️': 'warrior',
  '🔮': 'mage',    '👑': 'king',
}
const LEGACY_EMOJI_TO_WEAPON: Record<string, string> = {
  '🗡️': 'basic', '⚡': 'laser', '🔫': 'double',
  '단검': 'basic', '레이저': 'laser', '더블': 'double',
}
const LEGACY_EMOJI_TO_PET: Record<string, string> = {
  '🐱': 'cat', '🐕': 'shiba', '🐹': 'hamster', '🐰': 'rabbit', '🐥': 'chick',
  '🦊': 'ninetail', '🦅': 'griffin', '🐉': 'minidragon',
}

function normalizeCharId(raw: string): string {
  if (!raw) return 'warrior'
  if (LEGACY_EMOJI_TO_CHAR_ID[raw]) return LEGACY_EMOJI_TO_CHAR_ID[raw]
  return raw
}
function normalizeWeapon(raw: string | null | undefined): 'basic' | 'laser' | 'double' | null {
  if (!raw) return null
  if (LEGACY_EMOJI_TO_WEAPON[raw]) return LEGACY_EMOJI_TO_WEAPON[raw] as 'basic' | 'laser' | 'double'
  if (raw === 'basic' || raw === 'laser' || raw === 'double') return raw
  return 'basic'
}
export function normalizePetId(raw: string): string {
  if (!raw) return 'cat'
  if (LEGACY_EMOJI_TO_PET[raw]) return LEGACY_EMOJI_TO_PET[raw]
  return raw
}

// ── PET 이모지 맵 (PetSprite와 공유, CharacterSprite L3에서도 사용) ──
const PET_EMOJI: Record<string, string> = Object.fromEntries(
  PET_UNLOCKS.map(p => [p.id, p.emoji])
)

// ── Props ─────────────────────────────────────────────────────────────
interface CharacterSpriteProps {
  characterId?: string              // optional: undefined/'' → currentSkin 폴백
  role: Role
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: 'bob' | 'none'
  // 'job': 직업 이모지 메인 (프로필/홈/헤더)
  // 'person': 역할별 사람 이모지 메인 (로그인 캐릭터 선택)
  variant?: 'job' | 'person'
  // undefined → currentWeapon 폴백, null → 무기 없음, 값 → 해당 무기
  weapon?: 'basic' | 'laser' | 'double' | null
  // undefined → currentPet 폴백, null → 펫 없음, 값 → 해당 펫
  petId?: string | null
  className?: string
}

// ── 역할별 배경·테두리 ────────────────────────────────────────────────
// 배경: MC 다크 우드 #1A1208 통일 (레거시 navy/dark-purple 폐기)
// 테두리: 역할별 디자인 토큰 액센트 컬러 (sky/pink/purple/stone)
const ROLE_BG_CSS: Record<Role, { bg: string; border: string }> = {
  DAD:      { bg: '#1A1208', border: '#4FC3F7' },
  MOM:      { bg: '#1A1208', border: '#E8A0BF' },
  CHILD:    { bg: '#1A1208', border: '#7B5EA7' },
  OBSERVER: { bg: '#1A1208', border: '#9E9E9E' },
}

const ROLE_BG_PATTERN: Record<Role, string> = {
  DAD:      '⭐',
  MOM:      '🌸',
  CHILD:    '💎',
  OBSERVER: '🪨',
}

const ROLE_PERSON: Record<Role, string> = {
  DAD:      '👨',
  MOM:      '👩',
  CHILD:    '👧',
  OBSERVER: '🧑',
}

const WEAPON_ICON: Record<string, string> = {
  basic:  '🗡️',
  laser:  '⚡',
  double: '🔫',
}

const SIZE: Record<string, {
  box: number; fontSize: number; badge: number; badgePos: string
  petSize: number; petPos: string; weaponSize: number
}> = {
  sm: {
    box: 40, fontSize: 20, badge: 16, badgePos: '-top-1 -right-1',
    petSize: 14, petPos: '-bottom-1 -right-1', weaponSize: 12,
  },
  md: {
    box: 56, fontSize: 28, badge: 20, badgePos: '-top-1.5 -right-1.5',
    petSize: 18, petPos: '-bottom-1 -right-1', weaponSize: 16,
  },
  lg: {
    box: 80, fontSize: 40, badge: 28, badgePos: '-top-2 -right-2',
    petSize: 24, petPos: '-bottom-1.5 -right-1.5', weaponSize: 20,
  },
  xl: {
    box: 112, fontSize: 56, badge: 36, badgePos: '-top-2 -right-2',
    petSize: 30, petPos: '-bottom-2 -right-2', weaponSize: 26,
  },
}

export function CharacterSprite({
  characterId, role, size = 'md', animate = 'none', variant = 'job',
  weapon, petId, className = '',
}: CharacterSpriteProps) {
  // 전역 인벤토리 스토어 — 스킨·무기·펫 모두 구독하여 실시간 반영
  const storeSkin   = useInventoryStore(s => s.currentSkin)
  const storeWeapon = useInventoryStore(s => s.currentWeapon)
  const storePet    = useInventoryStore(s => s.currentPet)

  // characterId: prop 없거나 빈 문자열 → 스토어 currentSkin 폴백
  const safeCharId = normalizeCharId(characterId || storeSkin)

  // weapon: undefined → 스토어, null → 무기 없음, 값 → 해당 무기
  const resolvedWeapon = weapon !== undefined ? weapon : storeWeapon
  const safeWeapon     = normalizeWeapon(resolvedWeapon)

  // petId: undefined → 스토어, null → 없음, 값 → 해당 펫
  const resolvedPet = petId !== undefined ? petId : storePet
  const safePetId   = resolvedPet ? normalizePetId(resolvedPet) : null
  const petEmoji    = safePetId ? (PET_EMOJI[safePetId] ?? null) : null

  const s       = SIZE[size]         ?? SIZE.md
  const theme   = ROLE_BG_CSS[role]  ?? ROLE_BG_CSS.OBSERVER
  const pattern = ROLE_BG_PATTERN[role] ?? '🪨'
  const person  = ROLE_PERSON[role]  ?? '👤'

  const jobEmoji  = CHARACTER_EMOJI[safeCharId] ?? CHARACTER_EMOJI['warrior'] ?? '⚔️'
  const jobLabel  = CHARACTER_LABELS[safeCharId]
  const mainEmoji = variant === 'job' ? (jobEmoji ?? person) : person

  // ── 스타일 객체 ───────────────────────────────────────────────────
  const boxStyle: React.CSSProperties = {
    width: s.box, height: s.box,
    position: 'relative',
    border: `4px solid ${theme.border}`,
    overflow: 'hidden',
    flexShrink: 0,
  }
  const bgStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: theme.bg,
    display: 'flex', flexWrap: 'wrap',
    alignContent: 'flex-start',
    opacity: 0.35,
    fontSize: Math.max(6, s.box / 5),
    lineHeight: 1,
    pointerEvents: 'none',
    overflow: 'hidden',
  }
  const mainStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: s.fontSize,
    lineHeight: 1,
    animation: animate === 'bob' ? 'characterBob 1.4s ease-in-out infinite' : undefined,
  }

  // L3 펫 오버레이: 박스 우하단 외곽에 걸쳐 배치 (overflow visible 래퍼 필요)
  const petBoxSize = s.petSize + 4
  const petOffset  = -Math.floor(s.petSize / 3)
  const petStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: petOffset,
    right:  petOffset,
    width:  petBoxSize,
    height: petBoxSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1A1208',
    border: `2px solid ${theme.border}`,
    fontSize: s.petSize - 2,
    lineHeight: 1,
    zIndex: 10,
    animation: 'petBounce 0.9s ease-in-out infinite',
    flexShrink: 0,
  }

  const patternCount = Math.ceil((s.box / (s.box / 5)) ** 2)

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>

      {/* 박스 + L3 펫 래퍼 — overflow: visible で펫이 박스 밖으로 튀어나옴 */}
      <div className="relative inline-block" style={{ flexShrink: 0 }}>

        {/* 본체 박스 (overflow: hidden) */}
        <div style={boxStyle}>

          {/* L1: 픽셀 배경 패턴 타일 */}
          <div style={bgStyle} aria-hidden="true">
            {Array.from({ length: patternCount + 4 }, (_, i) => (
              <span key={i}>{pattern}</span>
            ))}
          </div>

          {/* L2: 배경 솔리드 오버레이 */}
          <div style={{ position: 'absolute', inset: 0, background: theme.bg, opacity: 0.65 }} />

          {/* L3: 메인 캐릭터 이모지 */}
          <div style={mainStyle}>
            <span role="img" style={{ userSelect: 'none' }}>{mainEmoji}</span>
          </div>

          {/* L4: 무기 오버레이 — job variant + weapon 있을 때만 */}
          {variant === 'job' && safeWeapon && (
            <div
              style={{
                position: 'absolute', bottom: 2, right: 2,
                fontSize: s.weaponSize, lineHeight: 1,
                filter: 'drop-shadow(1px 1px 0px #000)',
              }}
              aria-hidden="true"
            >
              {WEAPON_ICON[safeWeapon] ?? '🗡️'}
            </div>
          )}

        </div>

        {/* L3 펫: 우하단 바운스 오버레이 (박스 overflow hidden 영역 밖) */}
        {petEmoji && (
          <div style={petStyle} aria-hidden="true">
            <span style={{ userSelect: 'none' }}>{petEmoji}</span>
          </div>
        )}

      </div>

      {/* 직업 뱃지 (person variant — 좌상단) */}
      {variant === 'person' && jobEmoji && (
        <div
          className={`absolute flex items-center justify-center bg-gold border-2 border-pixel-dark ${s.badgePos}`}
          style={{ width: s.badge, height: s.badge, position: 'absolute', zIndex: 10 }}
        >
          <span style={{ fontSize: s.badge * 0.65, lineHeight: 1, userSelect: 'none' }}>{jobEmoji}</span>
        </div>
      )}

      {/* 직업 라벨 */}
      {jobLabel && size !== 'sm' && (
        <span
          className="font-korean text-stone mt-0.5 truncate max-w-full text-center"
          style={{ fontSize: Math.max(10, s.box / 8) }}
        >
          {jobLabel}
        </span>
      )}

    </div>
  )
}

// ── 반려동물 스프라이트 독립 컴포넌트 (50종 완전 지원) ───────────────

interface PetSpriteProps {
  petId: string
  size?: 'sm' | 'md'
  bounce?: boolean
  className?: string
}

export function PetSprite({ petId, size = 'sm', bounce = false, className = '' }: PetSpriteProps) {
  const safePetId = normalizePetId(petId ?? '')
  const emoji = PET_EMOJI[safePetId] ?? PET_EMOJI['cat'] ?? '🐕'
  const px = size === 'sm' ? 32 : 48
  const fs = size === 'sm' ? 18 : 24
  return (
    <div
      className={`flex items-center justify-center bg-stone border-2 border-pixel-dark ${className}`}
      style={{
        width: px, height: px,
        animation: bounce ? 'petBounce 0.9s ease-in-out infinite' : undefined,
      }}
    >
      <span style={{ fontSize: fs, lineHeight: 1, userSelect: 'none' }}>{emoji}</span>
    </div>
  )
}
