// CharacterSprite — 레이어드 픽셀 아바타
// L1: 픽셀 배경 테마 (숲/성/우주/돌)
// L2: 캐릭터 이모지 본체 (직업 또는 사람)
// L3: 반려동물 바운스 (우하단)
// L4: 무기 오버레이 (우측 하단 — job variant만)
// 안전장치: 하이브리드 딕셔너리 매핑 — 레거시 이모지 문자열을 ID로 치환 후 폴백 처리
// weapon prop 폴백: undefined이면 전역 인벤토리 스토어의 currentWeapon으로 자동 합성
import type { Role } from '@/domain/entities/Member'
import { CHARACTER_EMOJI, CHARACTER_LABELS, PET_UNLOCKS } from '@/application/use-cases/characters/selectCharacter'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'

// ── 레거시 이모지 → characterId 역방향 매핑 (안전장치) ─────────────────
// DB에 이모지가 직접 저장된 경우 대응 (예: "🗡️" → "rogue")
const LEGACY_EMOJI_TO_CHAR_ID: Record<string, string> = {
  '🗡️': 'rogue',   '⚔️': 'warrior',  '🏹': 'archer',
  '🧙': 'mage',    '👨‍🍳': 'chef',    '🛡️': 'warrior',
  '🔮': 'mage',    '👑': 'king',
}
// 레거시 무기 이모지 → WeaponType 역방향 매핑
const LEGACY_EMOJI_TO_WEAPON: Record<string, string> = {
  '🗡️': 'basic', '⚡': 'laser', '🔫': 'double',
  '단검': 'basic', '레이저': 'laser', '더블': 'double',
}
// 레거시 펫 이모지 → petId 역방향 매핑 (PET_UNLOCKS에 없는 경우 대비)
const LEGACY_EMOJI_TO_PET: Record<string, string> = {
  '🐱': 'cat', '🐕': 'shiba', '🐹': 'hamster', '🐰': 'rabbit', '🐥': 'chick',
  '🦊': 'ninetail', '🦅': 'griffin', '🐉': 'minidragon',
}

// characterId가 레거시 이모지 문자열인 경우 정규화
function normalizeCharId(raw: string): string {
  if (!raw) return 'warrior'
  if (LEGACY_EMOJI_TO_CHAR_ID[raw]) return LEGACY_EMOJI_TO_CHAR_ID[raw]
  return raw
}
// weapon이 레거시 이모지 문자열인 경우 정규화
function normalizeWeapon(raw: string | null | undefined): 'basic' | 'laser' | 'double' | null {
  if (!raw) return null
  if (LEGACY_EMOJI_TO_WEAPON[raw]) return LEGACY_EMOJI_TO_WEAPON[raw] as 'basic' | 'laser' | 'double'
  if (raw === 'basic' || raw === 'laser' || raw === 'double') return raw
  return 'basic' // 폴백: 기본 단검
}
// petId가 레거시 이모지 문자열인 경우 정규화
export function normalizePetId(raw: string): string {
  if (!raw) return 'cat'
  if (LEGACY_EMOJI_TO_PET[raw]) return LEGACY_EMOJI_TO_PET[raw]
  return raw
}

interface CharacterSpriteProps {
  characterId: string
  role: Role
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: 'bob' | 'none'
  // 'job': 직업 도구 이모지를 메인으로 (프로필/홈/헤더)
  // 'person': 역할별 사람 이모지를 메인으로 (로그인 캐릭터 선택)
  variant?: 'job' | 'person'
  // undefined = 전역 인벤토리 스토어 폴백, null = 무기 없음, 값 = 해당 무기 표시
  weapon?: 'basic' | 'laser' | 'double' | null
  className?: string
}

// ── 역할별 픽셀 배경 테마 ────────────────────────────────────────────
// 이모지로 표현하는 도트 배경 (green grid 완전 폐기)
const ROLE_BG_CSS: Record<Role, { bg: string; border: string }> = {
  DAD:      { bg: '#0d1b2a', border: '#4FC3F7' },  // 밤하늘 (하늘색 테두리)
  MOM:      { bg: '#1a0d1a', border: '#E8A0BF' },  // 마법 숲 (핑크 테두리)
  CHILD:    { bg: '#0f0a1e', border: '#7B5EA7' },  // 던전 (보라 테두리)
  OBSERVER: { bg: '#1a1208', border: '#9E9E9E' },  // 돌성 (회색 테두리)
}

// 배경 픽셀 패턴 (CSS pattern via small dots)
const ROLE_BG_PATTERN: Record<Role, string> = {
  DAD:      '⭐', // 별 패턴 → 밤하늘
  MOM:      '🌸', // 꽃 패턴 → 마법 숲
  CHILD:    '💎', // 다이아 → 던전
  OBSERVER: '🪨', // 돌 → 돌성
}

// 역할별 베이스 사람 이모지
const ROLE_PERSON: Record<Role, string> = {
  DAD:      '👨',
  MOM:      '👩',
  CHILD:    '👧',
  OBSERVER: '🧑',
}

// 무기 아이콘
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
  weapon, className = '',
}: CharacterSpriteProps) {
  // 전역 인벤토리 스토어에서 현재 장착 무기 구독 (weapon prop이 undefined일 때 폴백)
  const storeWeapon = useInventoryStore(s => s.currentWeapon)
  // 안전장치: 레거시 이모지 문자열이 오더라도 정규화하여 화면 뻗음 방지
  const safeCharId = normalizeCharId(characterId ?? '')
  // weapon이 undefined → 스토어 폴백, null → 무기 없음, 값 → 해당 무기
  const resolvedWeapon = weapon !== undefined ? weapon : storeWeapon
  const safeWeapon = normalizeWeapon(resolvedWeapon)

  const s        = SIZE[size] ?? SIZE.md
  const theme    = ROLE_BG_CSS[role]    ?? ROLE_BG_CSS.OBSERVER
  const pattern  = ROLE_BG_PATTERN[role] ?? '🪨'
  const person   = ROLE_PERSON[role]    ?? '👤'
  const jobEmoji = CHARACTER_EMOJI[safeCharId] ?? CHARACTER_EMOJI['warrior'] ?? '⚔️'
  const jobLabel = CHARACTER_LABELS[safeCharId]
  const mainEmoji = variant === 'job' ? (jobEmoji ?? person) : person

  // ── 박스 스타일 ─────────────────────────────────────────────────
  const boxStyle: React.CSSProperties = {
    width:    s.box,
    height:   s.box,
    position: 'relative',
    border:   `4px solid ${theme.border}`,
    overflow: 'hidden',
    flexShrink: 0,
  }

  // L1 — 픽셀 배경 (작은 패턴 타일)
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
  const patternCount = Math.ceil((s.box / (s.box / 5)) ** 2)

  // L2 — 메인 이모지
  const mainStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: s.fontSize,
    lineHeight: 1,
    animation: animate === 'bob' ? 'characterBob 1.4s ease-in-out infinite' : undefined,
  }

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      {/* 본체 박스 */}
      <div style={boxStyle}>
        {/* L1: 배경 패턴 */}
        <div style={bgStyle} aria-hidden="true">
          {Array.from({ length: patternCount + 4 }, (_, i) => (
            <span key={i}>{pattern}</span>
          ))}
        </div>

        {/* L2: 배경 색상 솔리드 */}
        <div style={{ position: 'absolute', inset: 0, background: theme.bg, opacity: 0.65 }} />

        {/* L3: 메인 캐릭터 이모지 */}
        <div style={mainStyle}>
          <span role="img" style={{ userSelect: 'none' }}>{mainEmoji}</span>
        </div>

        {/* L4: 무기 오버레이 — job variant + weapon 있을 때만 (레거시 폴백 포함) */}
        {variant === 'job' && safeWeapon && (
          <div style={{
            position: 'absolute',
            bottom: 2, right: 2,
            fontSize: s.weaponSize,
            lineHeight: 1,
            filter: 'drop-shadow(1px 1px 0px #000)',
          }} aria-hidden="true">
            {WEAPON_ICON[safeWeapon] ?? '🗡️'}
          </div>
        )}
      </div>

      {/* 직업 뱃지 (person variant) */}
      {variant === 'person' && jobEmoji && (
        <div className={`absolute flex items-center justify-center bg-gold border-2 border-pixel-dark ${s.badgePos}`}
          style={{ width: s.badge, height: s.badge, position: 'absolute', zIndex: 10 }}>
          <span style={{ fontSize: s.badge * 0.65, lineHeight: 1, userSelect: 'none' }}>{jobEmoji}</span>
        </div>
      )}

      {/* 직업 라벨 */}
      {jobLabel && size !== 'sm' && (
        <span className="font-korean text-stone mt-0.5 truncate max-w-full text-center"
          style={{ fontSize: Math.max(10, s.box / 8) }}>
          {jobLabel}
        </span>
      )}
    </div>
  )
}

// ── 반려동물 스프라이트 (PET_UNLOCKS 전체 50종 매핑) ────────────────
const PET_EMOJI: Record<string, string> = Object.fromEntries(
  PET_UNLOCKS.map(p => [p.id, p.emoji])
)

interface PetSpriteProps {
  petId: string
  size?: 'sm' | 'md'
  bounce?: boolean
  className?: string
}

export function PetSprite({ petId, size = 'sm', bounce = false, className = '' }: PetSpriteProps) {
  // 안전장치: 레거시 이모지 문자열 petId를 정규화 ID로 변환 후 조회
  const safePetId = normalizePetId(petId ?? '')
  const emoji = PET_EMOJI[safePetId] ?? PET_EMOJI['cat'] ?? '🐕'
  const px = size === 'sm' ? 32 : 48
  const fs = size === 'sm' ? 18 : 24
  return (
    <div className={`flex items-center justify-center bg-stone border-2 border-pixel-dark ${className}`}
      style={{
        width: px, height: px,
        animation: bounce ? 'petBounce 0.9s ease-in-out infinite' : undefined,
      }}>
      <span style={{ fontSize: fs, lineHeight: 1, userSelect: 'none' }}>{emoji}</span>
    </div>
  )
}
