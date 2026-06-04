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

// ── 펫 SVG 지원 목록 (/assets/pets/{id}.svg) ────────────────────────
export const PET_SVG_SET = new Set<string>([
  // Lv 1-9
  'dog', 'cat', 'hamster', 'rabbit', 'parrot', 'turtle', 'fox', 'panda', 'monkey', 'duck',
  // Lv 11-19
  'owl', 'wolf', 'lion', 'tiger', 'bear', 'eagle', 'dolphin', 'shark', 'crocodile', 'rhino',
  // Lv 21-31
  'elephant', 'gorilla', 'mini-dragon', 'giant-squid', 'whale',
  'dino', 'trex', 'cobra', 'griffin', 'werewolf', 'unicorn',
  // Lv 33-45
  'ice-wolf', 'lightning-eagle', 'sea-dragon', 'fire-phoenix', 'moon-bear',
  'star-fox', 'crystal-whale', 'cosmic-turtle', 'meteor-leopard',
  // Lv 41-50 (전설)
  'plasma-dragon', 'void-wolf', 'dimension-lion', 'crystal-pegasus', 'nebula-serpent',
  'galaxy-bear', 'thunder-dragon', 'cosmos-lion', 'divine-beast', 'legend-creature',
])

// ── 배경(내 땅) SVG 지원 목록 (/assets/backgrounds/{id}.svg) ─────────
// 배경이 추가될 때마다 여기 ID 등록
export const BANNER_SVG_SET = new Set<string>([
  // Lv 1-10 (자연) — 제작 완료
  'overworld','forest','nether','cave','ocean',
  'swamp','jungle','savanna','snow','desert',
  // Lv 11-20 (모험) — 제작 완료
  'volcano','mushroom','fortress','ruins','sky',
  'floating-isle','crystal-cave','aurora','deep-sea','storm-peak',
  // Lv 21-30 (신비) — 제작 완료
  'moon-base','shadow-realm','dragon-peak','time-ruins','star-meadow',
  'nebula-cave','comet-trail','space-station','milky-way','asteroid-belt',
  // Lv 31-40 (우주 극한)
  'black-hole','supernova','pulsar','quasar','wormhole',
  'dark-matter','antimatter','plasma-storm','cosmic-void','galaxy-core',
  // Lv 41-50 (신의 영역)
  'quantum-realm','dimension-rift','time-stream','crystal-cosmos','divine-realm',
  'celestial-sea','void-throne','eternity','genesis','godverse',
])

// ── SVG 스프라이트 지원 목록 (파일 추가 시 여기에 ID 등록) ──────────
// SVG 파일 위치: /assets/characters/{id}.svg
export const CHAR_SVG_SET = new Set<string>([
  // ── 기본 캐릭터 5종 (고정 신원) ──
  'base-dad', 'base-mom', 'base-child-1', 'base-child-2', 'base-observer',
  // ── 게스트 여행자 3종 ──
  'observer-bard', 'observer-healer', 'observer-knight',
  // ── CHILD Lv1 (배치 1) ──
  'child-warrior', 'child-adventurer', 'child-archer',
  'child-mage-apprentice', 'child-ninja', 'child-fairy',
  'child-student', 'child-rogue', 'child-detective', 'child-hero',
  // ── CHILD Lv5-15 (배치 2) ──
  'child-knight', 'child-paladin', 'child-bard', 'child-ranger',
  'child-mage', 'child-druid', 'child-monk', 'child-priest',
  'child-gladiator', 'child-assassin',
  // ── CHILD Lv15-25 (배치 3) ──
  'child-alchemist', 'child-shaman',
  'child-dragon-rider', 'child-holy-knight', 'child-dark-blade', 'child-ice-mage',
  'child-dark-knight', 'child-elf-archer',
  // ── CHILD Lv25-45 (배치 4) ──
  'child-necromancer', 'child-spell-blade',
  'child-archmage', 'child-summoner', 'child-angel-warrior', 'child-blood-mage',
  'child-shadow-knight', 'child-berserker', 'child-time-mage',
  // ── CHILD Lv35-50 (배치 5 — 완성) ──
  'child-holy-sword', 'child-hero-king', 'child-sage', 'child-conqueror', 'child-prophet',
  'child-celestial-knight', 'child-demon-slayer', 'child-star-mage', 'child-myth-archer',
  'child-divine-warrior', 'child-absolute-mage', 'child-undead-king', 'child-cosmos-hero',
  // ── COM Lv1-5 (배치 1) ──
  'com-healer', 'com-chef', 'com-witch', 'com-scholar', 'com-dancer',
  'com-cleric', 'com-merchant', 'com-jester', 'com-miner', 'com-blacksmith',
  'com-wanderer', 'com-enchanter', 'com-artisan', 'com-seer',
  // ── COM Lv5-15 (배치 2) ──
  'com-templar', 'com-warden',
  'com-ice-queen', 'com-fire-mage', 'com-guardian', 'com-champion',
  'com-witch-hunter', 'com-oracle', 'com-trickster', 'com-crusader',
  'com-wind-dancer', 'com-earth-sage', 'com-sea-witch',
  // ── COM Lv15-50 (배치 3) ──
  'com-thunder-mage', 'com-void-mage', 'com-storm-caller', 'com-lava-knight',
  'com-frost-archer', 'com-warlord',
  'com-sea-king', 'com-runemaster', 'com-lunar-mage', 'com-solar-knight',
  'com-chrono-mage', 'com-golem-master',
  'com-dream-weaver', 'com-phoenix-mage', 'com-chaos-knight',
  'com-balance-keeper', 'com-void-sovereign', 'com-eternal-legend',
])

// ── 역할 기본 SVG 매핑 (variant='person' 시 사용) ──────────────────
const ROLE_BASE_SVG: Record<string, string> = {
  DAD:      '/assets/characters/base-dad.svg',
  MOM:      '/assets/characters/base-mom.svg',
  CHILD:    '/assets/characters/base-child-1.svg',
  OBSERVER: '/assets/characters/base-observer.svg',
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
  // 내 땅 배경 ID — BANNER_SVG_SET에 있으면 SVG 배경 표시
  worldBanner?: string
  // true면 박스 테두리·배경 제거 (배경 위에 캐릭터만 표시)
  transparent?: boolean
  // 장비 SVG 오버레이 (gearWeapon=오른쪽, gearHelmet=위, gearShield=왼쪽, gearArmor=몸통)
  gearWeapon?: string | null
  gearHelmet?: string | null
  gearShield?: string | null
  gearArmor?:  string | null
  // false면 펫 바운스 애니메이션 없음 (프리뷰 등 정적 표시)
  petAnimate?: boolean
  className?: string
}

// ── 장비 슬롯 위치 상수 (v2 장비 레이어 시스템용) ─────────────────────
// 각 슬롯의 오버레이 위치·크기를 CharacterSprite 크기별로 정의
export const EQUIPMENT_SLOTS = {
  weapon: {  // 무기: 왼손 (좌하단) — v2.2 위치 교체
    sm:  { bottom: -4, left: -4,   size: 17 },
    md:  { bottom: -5, left: -5,   size: 22 },
    lg:  { bottom: -6, left: -6,   size: 26 },
    xl:  { bottom: -8, left: -8,   size: 34 },
  },
  shield: {  // 방패: 오른손 (우하단) — v2.2 위치 교체
    sm:  { bottom: -4, right: -4,  size: 17 },
    md:  { bottom: -5, right: -5,  size: 22 },
    lg:  { bottom: -6, right: -6,  size: 26 },
    xl:  { bottom: -8, right: -8,  size: 34 },
  },
  helmet: {  // 투구: 머리 위 (상단 중앙) — v2
    sm:  { top: -6,  size: 19 },
    md:  { top: -8,  size: 24 },
    lg:  { top: -10, size: 31 },
    xl:  { top: -14, size: 38 },
  },
} as const

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
  weapon, petId, worldBanner, transparent = false,
  gearWeapon, gearHelmet, gearShield, gearArmor, petAnimate = true, className = '',
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
  const hasBannerSvg = !!(worldBanner && BANNER_SVG_SET.has(worldBanner))
  const boxStyle: React.CSSProperties = {
    width: s.box, height: s.box,
    position: 'relative',
    border: transparent ? 'none' : `4px solid ${theme.border}`,
    overflow: 'hidden',
    flexShrink: 0,
    background: transparent ? 'transparent' : undefined,
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
    animation: petAnimate ? 'petBounce 0.9s ease-in-out infinite' : undefined,
    flexShrink: 0,
  }

  const patternCount = Math.ceil((s.box / (s.box / 5)) ** 2)

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>

      {/* 박스 + L3 펫 래퍼 — overflow: visible で펫이 박스 밖으로 튀어나옴 */}
      <div className="relative inline-block" style={{ flexShrink: 0 }}>

        {/* 본체 박스 (overflow: hidden) */}
        <div style={boxStyle}>

          {/* L1: 배경 — 내 땅 SVG (Safari 호환: 명시적 px 크기, 노멀 플로우) 또는 기본 픽셀 패턴 */}
          {transparent ? null : hasBannerSvg ? (
            <img
              src={`/assets/backgrounds/${worldBanner}.svg`}
              width={s.box}
              height={s.box}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{
                display: 'block',
                width: s.box,
                height: s.box,
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          ) : (
            <>
              {/* L1: 픽셀 패턴 */}
              <div style={bgStyle} aria-hidden="true">
                {Array.from({ length: patternCount + 4 }, (_, i) => (
                  <span key={i}>{pattern}</span>
                ))}
              </div>
              {/* L2: 솔리드 오버레이 */}
              <div style={{ position: 'absolute', inset: 0, background: theme.bg, opacity: 0.65 }} />
            </>
          )}

          {/* L3: 메인 캐릭터 — SVG 우선, 없으면 이모지 폴백 */}
          <div style={mainStyle}>
            {(() => {
              // person variant: base-* 명시 또는 역할 기본 SVG
              if (variant === 'person') {
                const src = safeCharId.startsWith('base-')
                  ? `/assets/characters/${safeCharId}.svg`
                  : (ROLE_BASE_SVG[role] ?? null)
                if (src) return (
                  <img src={src} alt={role} draggable={false}
                    style={{ width: s.fontSize * 1.5, height: s.fontSize * 1.5,
                      objectFit: 'contain', imageRendering: 'pixelated', userSelect: 'none' }} />
                )
              }
              // job variant: 등록된 SVG 사용
              if (variant === 'job' && CHAR_SVG_SET.has(safeCharId)) return (
                <img src={`/assets/characters/${safeCharId}.svg`} alt={jobLabel ?? safeCharId}
                  draggable={false}
                  style={{ width: s.fontSize * 1.5, height: s.fontSize * 1.5,
                    objectFit: 'contain', imageRendering: 'pixelated', userSelect: 'none' }} />
              )
              // 폴백: 이모지
              return <span role="img" style={{ userSelect: 'none' }}>{mainEmoji}</span>
            })()}
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

        {/* 장비 오버레이 — Z순서: 갑옷(8) < 투구(10) < 방패(12) < 무기(13) */}
        {(() => {
          const charSize = s.fontSize * 1.5
          const topPad   = (s.box - charSize) / 2
          const ppx      = charSize / 32

          // 크기: charSize 비례
          const ags = Math.round(charSize * 0.46)   // 갑옷 (몸통, 얼굴 아래)
          const hgs = Math.round(charSize * 0.396)  // 투구 (20% 증가)
          const wgs = Math.round(charSize * 0.444)  // 무기 (20% 증가)
          const sgs = Math.round(charSize * 0.444)  // 방패 (20% 증가)

          // ── 갑옷: 어깨~허리 (SVG y≈20/32 중심, 얼굴 비침 방지)
          const armorTop  = Math.round(topPad + charSize * (20/32) - ags / 2)
          const armorLeft = Math.round(s.box / 2 - ags / 2)

          // ── 투구: 머리카락 끝(y≈7)
          const headBottom = topPad + ppx * 7
          const headTop  = Math.round(headBottom - hgs)
          const headLeft = Math.round(s.box / 2 - hgs / 2)

          // ── 무기(왼손으로 교체): 손 중심(SVG x=5,y=22) — 위로 올림
          const weapTop  = Math.round(topPad + charSize * (22/32) - wgs / 2)
          const weapLeft = Math.round(topPad + charSize * (5/32)  - wgs / 2)

          // ── 방패(오른손으로 교체): 손 중심(SVG x=23,y=22) — 위로 올림
          const shieldTop  = Math.round(topPad + charSize * (22/32) - sgs / 2)
          const shieldLeft = Math.round(topPad + charSize * (23/32) - sgs / 2)

          const imgStyle = (z: number): React.CSSProperties => ({
            position: 'absolute', imageRendering: 'pixelated',
            objectFit: 'contain', display: 'block', zIndex: z,
          })
          return (
            <>
              {/* 갑옷: 몸통 중앙, 뒤(z=8) */}
              {gearArmor && (
                <img src={`/assets/gear/armor/${gearArmor}.svg`} width={ags} height={ags}
                  draggable={false}
                  style={{ ...imgStyle(8), top: armorTop, left: armorLeft }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              {/* 투구: 머리 위(z=10) */}
              {gearHelmet && (
                <img src={`/assets/gear/helmet/${gearHelmet}.svg`} width={hgs} height={hgs}
                  draggable={false}
                  style={{ ...imgStyle(10), top: headTop, left: headLeft }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              {/* 방패: 오른손(z=12), 무기보다 뒤 — v2.2 위치 교체 */}
              {gearShield && (
                <img src={`/assets/gear/shield/${gearShield}.svg`} width={sgs} height={sgs}
                  draggable={false}
                  style={{ ...imgStyle(12), top: shieldTop, left: shieldLeft }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              {/* 무기: 왼손(z=13), 최전면 — v2.2 위치 교체 */}
              {gearWeapon && (
                <img src={`/assets/gear/weapon/${gearWeapon}.svg`} width={wgs} height={wgs}
                  draggable={false}
                  style={{ ...imgStyle(13), top: weapTop, left: weapLeft }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
            </>
          )
        })()}

        {/* L3 펫: 우하단 바운스 오버레이 — SVG 우선, 없으면 이모지 */}
        {safePetId && (
          <div style={petStyle} aria-hidden="true">
            {PET_SVG_SET.has(safePetId) ? (
              <img
                src={`/assets/pets/${safePetId}.svg`}
                alt={safePetId}
                draggable={false}
                style={{ width: s.petSize, height: s.petSize, imageRendering: 'pixelated', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: s.petSize - 2, userSelect: 'none' }}>{petEmoji}</span>
            )}
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

      {/* 직업 라벨 — transparent 모드에서는 숨김 */}
      {jobLabel && size !== 'sm' && !transparent && (
        <span
          className="font-korean text-cream/70 mt-0.5 truncate max-w-full text-center"
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
