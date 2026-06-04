// Design Ref: §3-4 캐릭터 시스템 — 역할별 50종 확장 RPG 직업군
import { updateMember } from '@/infrastructure/firebase/collections/members'
import type { Role, UIRole } from '@/domain/entities/Member'

// ── 오픈 조건 헬퍼 ─────────────────────────────────────────────────
export function getUnlockedCharacters(role: Role, level: number): string[] {
  const isParent = role === 'DAD' || role === 'MOM'
  // 부모는 전부 자유 선택
  if (isParent) return ALL_CHARACTERS[role].map(c => c.id)
  // 아이: Lv 기준 오픈
  return ALL_CHARACTERS[role].filter(c => level >= c.requiredLevel).map(c => c.id)
}

export function getUnlockedPets(level: number): string[] {
  return PET_UNLOCKS.filter(p => level >= p.requiredLevel).map(p => p.id)
}

export function getUnlockedBanners(level: number): string[] {
  return BANNER_UNLOCKS.filter(b => level >= b.requiredLevel).map(b => b.id)
}

export async function selectCharacter(
  familyId: string, memberId: string, characterId: string, level: number, role: Role
): Promise<{ error: string | null }> {
  const unlocked = getUnlockedCharacters(role, level)
  if (!unlocked.includes(characterId)) return { error: '아직 오픈되지 않은 캐릭터예요 🔒' }
  return updateMember(familyId, memberId, { 'character.characterId': characterId } as any)
}

export async function selectPet(
  familyId: string, memberId: string, petId: string, level: number, role?: Role
): Promise<{ error: string | null }> {
  const isParent = role === 'DAD' || role === 'MOM'
  if (!isParent) {
    const unlocked = getUnlockedPets(level)
    if (!unlocked.includes(petId)) return { error: '아직 오픈되지 않은 펫이에요 🔒' }
  }
  return updateMember(familyId, memberId, { 'character.petId': petId } as any)
}

export async function selectWorldBanner(
  familyId: string, memberId: string, bannerId: string, level: number, role?: Role
): Promise<{ error: string | null }> {
  const isParent = role === 'DAD' || role === 'MOM'
  if (!isParent) {
    const unlocked = getUnlockedBanners(level)
    if (!unlocked.includes(bannerId)) return { error: '아직 오픈되지 않은 등급이에요 🔒' }
  }
  return updateMember(familyId, memberId, { 'character.worldBanner': bannerId } as any)
}

// ── UIRole 매핑 ─────────────────────────────────────────────────────
export const UI_ROLE_CHAR_KEY: Record<UIRole, Role> = {
  DAD: 'DAD', MOM: 'MOM', HAYOON: 'CHILD', SEOYOON: 'CHILD', OBSERVER: 'OBSERVER',
}

// ── 공통 직업 100종 (전 역할 공유, 아이는 레벨 해제) ─────────────
// child-* = 기존 아이 직업 (SVG 제작 중), com-* = 새 공통 직업
export const COMMON_CHARACTERS: { id: string; label: string; emoji: string; requiredLevel: number }[] = [
  // ── Lv 1~50: CHILD 직업 (54종) ─────────────────────────────────
  { id:'child-adventurer',      label:'모험가',     emoji:'🗡️', requiredLevel:1 },
  { id:'child-mage-apprentice', label:'마법사 견습', emoji:'📖', requiredLevel:1 },
  { id:'child-ninja',           label:'닌자',        emoji:'🥷', requiredLevel:1 },
  { id:'child-archer',          label:'궁수',        emoji:'🏹', requiredLevel:1 },
  { id:'child-detective',       label:'탐정',        emoji:'🔍', requiredLevel:1 },
  { id:'child-warrior',         label:'전사',        emoji:'🛡️', requiredLevel:1 },
  { id:'child-rogue',           label:'도적',        emoji:'🗝️', requiredLevel:1 },
  { id:'child-fairy',           label:'요정',        emoji:'🧚', requiredLevel:1 },
  { id:'child-student',         label:'학생',        emoji:'📚', requiredLevel:1 },
  { id:'child-hero',            label:'영웅',        emoji:'🦸', requiredLevel:1 },
  { id:'child-knight',          label:'기사',        emoji:'🛡', requiredLevel:5 },
  { id:'child-paladin',         label:'팔라딘',      emoji:'🌟', requiredLevel:5 },
  { id:'child-bard',            label:'음유시인',    emoji:'🎸', requiredLevel:5 },
  { id:'child-ranger',          label:'레인저',      emoji:'🌲', requiredLevel:5 },
  { id:'child-mage',            label:'마법사',      emoji:'🧙', requiredLevel:10 },
  { id:'child-druid',           label:'드루이드',    emoji:'🍀', requiredLevel:10 },
  { id:'child-monk',            label:'수도승',      emoji:'🙏', requiredLevel:10 },
  { id:'child-priest',          label:'사제',        emoji:'✝️', requiredLevel:10 },
  { id:'child-gladiator',       label:'검투사',      emoji:'🏟️', requiredLevel:15 },
  { id:'child-assassin',        label:'암살자',      emoji:'🌑', requiredLevel:15 },
  { id:'child-alchemist',       label:'연금술사',    emoji:'⚗️', requiredLevel:15 },
  { id:'child-shaman',          label:'주술사',      emoji:'🔮', requiredLevel:15 },
  { id:'child-dragon-rider',    label:'용기사',      emoji:'🐉', requiredLevel:20 },
  { id:'child-holy-knight',     label:'성기사',      emoji:'☀️', requiredLevel:20 },
  { id:'child-dark-blade',      label:'마검사',      emoji:'⚡', requiredLevel:20 },
  { id:'child-ice-mage',        label:'빙결마법사',  emoji:'❄️', requiredLevel:20 },
  { id:'child-dark-knight',     label:'흑기사',      emoji:'🖤', requiredLevel:25 },
  { id:'child-necromancer',     label:'강령술사',    emoji:'💀', requiredLevel:25 },
  { id:'child-elf-archer',      label:'엘프 궁수',   emoji:'🌿', requiredLevel:25 },
  { id:'child-spell-blade',     label:'마법검사',    emoji:'💠', requiredLevel:25 },
  { id:'child-archmage',        label:'대마법사',    emoji:'🌀', requiredLevel:30 },
  { id:'child-summoner',        label:'소환사',      emoji:'📿', requiredLevel:30 },
  { id:'child-angel-warrior',   label:'천사 전사',   emoji:'😇', requiredLevel:30 },
  { id:'child-blood-mage',      label:'혈술사',      emoji:'🩸', requiredLevel:30 },
  { id:'child-holy-sword',      label:'성검사',      emoji:'🗡', requiredLevel:35 },
  { id:'child-shadow-knight',   label:'그림자 기사', emoji:'🌙', requiredLevel:35 },
  { id:'child-berserker',       label:'광전사',      emoji:'🔴', requiredLevel:35 },
  { id:'child-time-mage',       label:'시공술사',    emoji:'⏳', requiredLevel:35 },
  { id:'child-hero-king',       label:'용사왕',      emoji:'👑', requiredLevel:40 },
  { id:'child-sage',            label:'현자',        emoji:'📜', requiredLevel:40 },
  { id:'child-conqueror',       label:'패왕',        emoji:'🏆', requiredLevel:40 },
  { id:'child-prophet',         label:'예언자',      emoji:'👁️', requiredLevel:40 },
  { id:'child-celestial-knight',label:'천기사',      emoji:'🌤️', requiredLevel:45 },
  { id:'child-demon-slayer',    label:'악마사냥꾼',  emoji:'🔥', requiredLevel:45 },
  { id:'child-star-mage',       label:'별의 마법사', emoji:'✨', requiredLevel:45 },
  { id:'child-myth-archer',     label:'신화 궁수',   emoji:'🎯', requiredLevel:45 },
  { id:'child-divine-warrior',  label:'신계 전사',   emoji:'💎', requiredLevel:50 },
  { id:'child-absolute-mage',   label:'절대 마법사', emoji:'🌌', requiredLevel:50 },
  { id:'child-undead-king',     label:'불사왕',      emoji:'💫', requiredLevel:50 },
  { id:'child-cosmos-hero',     label:'우주 영웅',   emoji:'🌟', requiredLevel:50 },

  // ── Lv 51~99: COM 확장 직업 (45종) — 아이 전용 고레벨 ──────────
  // 부모는 레벨 무관 자유 선택 (isParent 로직에서 전부 해제)
  { id:'com-healer',            label:'치유사',      emoji:'💊', requiredLevel:51 },
  { id:'com-chef',              label:'요리사',      emoji:'👩‍🍳', requiredLevel:51 },
  { id:'com-witch',             label:'마녀',        emoji:'🧹', requiredLevel:51 },
  { id:'com-scholar',           label:'학자',        emoji:'📜', requiredLevel:51 },
  { id:'com-dancer',            label:'무희',        emoji:'💃', requiredLevel:51 },
  { id:'com-cleric',            label:'성직자',      emoji:'✝️', requiredLevel:55 },
  { id:'com-merchant',          label:'상인',        emoji:'🛒', requiredLevel:55 },
  { id:'com-jester',            label:'광대',        emoji:'🃏', requiredLevel:55 },
  { id:'com-wanderer',          label:'방랑자',      emoji:'🧭', requiredLevel:55 },
  { id:'com-miner',             label:'광부',        emoji:'⛏️', requiredLevel:55 },
  { id:'com-blacksmith',        label:'대장장이',    emoji:'🔨', requiredLevel:58 },
  { id:'com-enchanter',         label:'마법부여사',  emoji:'💎', requiredLevel:58 },
  { id:'com-artisan',           label:'장인',        emoji:'🎨', requiredLevel:58 },
  { id:'com-seer',              label:'선견자',      emoji:'🔮', requiredLevel:58 },
  { id:'com-templar',           label:'템플러',      emoji:'⚔️', requiredLevel:58 },
  { id:'com-warden',            label:'감시자',      emoji:'🗺️', requiredLevel:58 },
  { id:'com-witch-hunter',      label:'마녀사냥꾼',  emoji:'🔫', requiredLevel:62 },
  { id:'com-oracle',            label:'신탁사',      emoji:'👁️', requiredLevel:62 },
  { id:'com-trickster',         label:'트릭스터',    emoji:'🌀', requiredLevel:62 },
  { id:'com-guardian',          label:'수호자',      emoji:'🛡', requiredLevel:62 },
  { id:'com-champion',          label:'챔피언',      emoji:'🏅', requiredLevel:62 },
  { id:'com-crusader',          label:'십자군',      emoji:'⚔️', requiredLevel:65 },
  { id:'com-ice-queen',         label:'얼음 여왕',   emoji:'❄️', requiredLevel:65 },
  { id:'com-fire-mage',         label:'불꽃 마법사', emoji:'🔥', requiredLevel:65 },
  { id:'com-wind-dancer',       label:'바람 무희',   emoji:'🌪️', requiredLevel:65 },
  { id:'com-earth-sage',        label:'대지 현자',   emoji:'🌍', requiredLevel:65 },
  { id:'com-sea-witch',         label:'바다 마녀',   emoji:'🌊', requiredLevel:65 },
  { id:'com-thunder-mage',      label:'번개 마법사', emoji:'⚡', requiredLevel:70 },
  { id:'com-void-mage',         label:'공허 마법사', emoji:'🕳️', requiredLevel:70 },
  { id:'com-storm-caller',      label:'폭풍술사',    emoji:'🌩️', requiredLevel:70 },
  { id:'com-lava-knight',       label:'용암 기사',   emoji:'🌋', requiredLevel:73 },
  { id:'com-frost-archer',      label:'서리 궁수',   emoji:'🏹', requiredLevel:73 },
  { id:'com-warlord',           label:'군주',        emoji:'⚔', requiredLevel:73 },
  { id:'com-sea-king',          label:'해왕',        emoji:'🌊', requiredLevel:76 },
  { id:'com-runemaster',        label:'룬마스터',    emoji:'🔱', requiredLevel:76 },
  { id:'com-lunar-mage',        label:'달빛 마법사', emoji:'🌙', requiredLevel:76 },
  { id:'com-solar-knight',      label:'태양 기사',   emoji:'☀️', requiredLevel:80 },
  { id:'com-chrono-mage',       label:'시간 마법사', emoji:'⏳', requiredLevel:80 },
  { id:'com-golem-master',      label:'골렘 마스터', emoji:'🗿', requiredLevel:80 },
  { id:'com-dream-weaver',      label:'꿈술사',      emoji:'💫', requiredLevel:84 },
  { id:'com-phoenix-mage',      label:'불사조 마법사',emoji:'🦅', requiredLevel:88 },
  { id:'com-chaos-knight',      label:'혼돈 기사',   emoji:'🌪️', requiredLevel:92 },
  { id:'com-balance-keeper',    label:'균형의 수호자',emoji:'⚖️', requiredLevel:95 },
  { id:'com-void-sovereign',    label:'공허 군주',   emoji:'🕳️', requiredLevel:97 },
  { id:'com-eternal-legend',    label:'영원의 전설', emoji:'🌟', requiredLevel:99 },
]

// ── 전체 캐릭터 마스터 데이터 (역할별 베이스 + 공통 100종) ────────
// requiredLevel=0: 베이스(항상 해제) / 부모는 모든 레벨 무시
export const ALL_CHARACTERS: Record<Role, { id: string; label: string; emoji: string; requiredLevel: number }[]> = {

  // ── 아빠 (DAD) — 기본 캐릭터 + 공통 100종 + 레거시 호환 ──────
  DAD: [
    { id:'base-dad',       label:'슈퍼파파', emoji:'👨', requiredLevel:0 },
    ...COMMON_CHARACTERS,
  ],
  // ── 엄마 (MOM) — 기본 캐릭터 + 공통 100종 ────────────────────
  MOM: [
    { id:'base-mom', label:'잔소리미녀', emoji:'👩', requiredLevel:0 },
    ...COMMON_CHARACTERS,
  ],

  // ── 아이 (CHILD) — 기본 캐릭터 2종 + 공통 100종 ────────────────
  CHILD: [
    { id:'base-child-1', label:'핑크공주', emoji:'👸', requiredLevel:0 },
    { id:'base-child-2', label:'보라전사', emoji:'🗡️', requiredLevel:0 },
    ...COMMON_CHARACTERS,
  ],

  // ── 게스트 (OBSERVER) — 기본 + 여행자 게스트 3종 + 공통 100종 ──
  OBSERVER: [
    { id:'base-observer',      label:'이름없는 나그네',  emoji:'🧑',  requiredLevel:0 },
    { id:'observer-bard',      label:'방랑 음악가',      emoji:'🎵',  requiredLevel:0 },
    { id:'observer-healer',    label:'옆나라 치유사',    emoji:'💛',  requiredLevel:0 },
    { id:'observer-knight',    label:'방랑 성기사',      emoji:'⚔️',  requiredLevel:0 },
    ...COMMON_CHARACTERS,
  ],
}

// 하위 호환: BASE_CHARACTERS (가입 화면 등에서 사용)
export const BASE_CHARACTERS: Record<Role, string[]> = {
  DAD:      ALL_CHARACTERS.DAD.slice(0, 10).map(c => c.id),
  MOM:      ALL_CHARACTERS.MOM.slice(0, 10).map(c => c.id),
  CHILD:    ALL_CHARACTERS.CHILD.filter(c => c.requiredLevel === 1).map(c => c.id),
  OBSERVER: ALL_CHARACTERS.OBSERVER.map(c => c.id),
}

// 하위 호환: LEVEL_CHARACTERS (ProfilePage 슬롯 구성용)
export const LEVEL_CHARACTERS: Record<Role, { id: string; requiredLevel: number }[]> = {
  DAD:      [],
  MOM:      [],
  CHILD:    ALL_CHARACTERS.CHILD.filter(c => c.requiredLevel > 1).map(c => ({ id: c.id, requiredLevel: c.requiredLevel })),
  OBSERVER: [],
}

// 가입 화면용 (처음 10종)
export const REGISTER_CHARACTERS: Record<UIRole, Array<{ id: string; label: string; emoji: string }>> = {
  DAD:      ALL_CHARACTERS.DAD.slice(0, 10).map(c => ({ id: c.id, label: c.label, emoji: c.emoji })),
  MOM:      ALL_CHARACTERS.MOM.slice(0, 10).map(c => ({ id: c.id, label: c.label, emoji: c.emoji })),
  HAYOON:   ALL_CHARACTERS.CHILD.filter(c => c.requiredLevel === 1).map(c => ({ id: c.id, label: c.label, emoji: c.emoji })),
  SEOYOON:  ALL_CHARACTERS.CHILD.filter(c => c.requiredLevel === 1).map(c => ({ id: c.id, label: c.label, emoji: c.emoji })),
  OBSERVER: ALL_CHARACTERS.OBSERVER.map(c => ({ id: c.id, label: c.label, emoji: c.emoji })),
}

// 이모지·레이블 조회맵 (전 역할 통합)
export const CHARACTER_EMOJI: Record<string, string> = Object.fromEntries(
  Object.values(ALL_CHARACTERS).flat().map(c => [c.id, c.emoji])
)
export const CHARACTER_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(ALL_CHARACTERS).flat().map(c => [c.id, c.label])
)

// ── 마이 펫 (50종) — 레벨이 오를수록 강력한 동물 ─────────────────
export const PET_UNLOCKS = [
  // 레벨 1~2: 친근한 반려동물 (얼굴형 이모지)
  { id:'dog',           requiredLevel:1,  label:'강아지',     emoji:'🐶' },
  { id:'cat',           requiredLevel:1,  label:'고양이',     emoji:'🐱' },
  { id:'hamster',       requiredLevel:3,  label:'햄스터',     emoji:'🐹' },
  { id:'rabbit',        requiredLevel:3,  label:'토끼',       emoji:'🐰' },
  { id:'parrot',        requiredLevel:5,  label:'앵무새',     emoji:'🦜' },
  { id:'turtle',        requiredLevel:5,  label:'거북이',     emoji:'🐢' },
  { id:'fox',           requiredLevel:7,  label:'여우',       emoji:'🦊' },
  { id:'panda',         requiredLevel:7,  label:'판다',       emoji:'🐼' },
  { id:'monkey',        requiredLevel:9,  label:'원숭이',     emoji:'🐵' },
  { id:'duck',          requiredLevel:9,  label:'오리',       emoji:'🐥' },
  { id:'owl',           requiredLevel:11, label:'부엉이',     emoji:'🦉' },
  { id:'wolf',          requiredLevel:11, label:'늑대',       emoji:'🐺' },
  { id:'lion',          requiredLevel:13, label:'사자',       emoji:'🦁' },
  { id:'tiger',         requiredLevel:13, label:'호랑이',     emoji:'🐯' },
  { id:'bear',          requiredLevel:15, label:'곰',         emoji:'🐻' },
  { id:'eagle',         requiredLevel:15, label:'독수리',     emoji:'🦅' },
  { id:'dolphin',       requiredLevel:17, label:'돌고래',     emoji:'🐬' },
  { id:'shark',         requiredLevel:17, label:'상어',       emoji:'🦈' },
  { id:'crocodile',     requiredLevel:19, label:'악어',       emoji:'🐊' },
  { id:'rhino',         requiredLevel:19, label:'코뿔소',     emoji:'🦏' },
  { id:'elephant',      requiredLevel:21, label:'코끼리',     emoji:'🐘' },
  { id:'gorilla',       requiredLevel:21, label:'고릴라',     emoji:'🦍' },
  { id:'mini-dragon',   requiredLevel:23, label:'아기용',     emoji:'🐲' },
  { id:'giant-squid',   requiredLevel:23, label:'대왕오징어', emoji:'🦑' },
  { id:'whale',         requiredLevel:25, label:'고래',       emoji:'🐋' },
  { id:'dino',          requiredLevel:25, label:'공룡',       emoji:'🦕' },
  { id:'trex',          requiredLevel:27, label:'티라노사우루스',emoji:'🦖' },
  { id:'cobra',         requiredLevel:27, label:'코브라',     emoji:'🐍' },
  { id:'griffin',       requiredLevel:29, label:'그리핀',     emoji:'🦅' },
  { id:'werewolf',      requiredLevel:29, label:'늑대인간',   emoji:'🌙' },
  { id:'unicorn',       requiredLevel:31, label:'유니콘',     emoji:'🦄' },
  { id:'ice-wolf',      requiredLevel:31, label:'빙결늑대',   emoji:'❄️' },
  { id:'lightning-eagle',requiredLevel:33,label:'번개매',     emoji:'⚡' },
  { id:'sea-dragon',    requiredLevel:33, label:'해룡',       emoji:'🌊' },
  { id:'fire-phoenix',  requiredLevel:35, label:'불사조',     emoji:'🔥' },
  { id:'moon-bear',     requiredLevel:35, label:'달빛곰',     emoji:'🌕' },
  { id:'star-fox',      requiredLevel:37, label:'별빛여우',   emoji:'⭐' },
  { id:'crystal-whale', requiredLevel:37, label:'수정고래',   emoji:'💎' },
  { id:'cosmic-turtle', requiredLevel:39, label:'우주거북',   emoji:'🌌' },
  { id:'meteor-leopard',requiredLevel:39, label:'운석표범',   emoji:'☄️' },
  { id:'plasma-dragon', requiredLevel:41, label:'플라즈마용', emoji:'💫' },
  { id:'void-wolf',     requiredLevel:41, label:'공허늑대',   emoji:'🕳️' },
  { id:'dimension-lion',requiredLevel:43, label:'차원사자',   emoji:'🌀' },
  { id:'crystal-pegasus',requiredLevel:43,label:'수정페가수스',emoji:'🔮' },
  { id:'nebula-serpent',requiredLevel:45, label:'성운뱀',     emoji:'🌠' },
  { id:'galaxy-bear',   requiredLevel:45, label:'은하곰',     emoji:'🐻‍❄️' },
  { id:'thunder-dragon',requiredLevel:47, label:'번개용',     emoji:'⚡' },
  { id:'cosmos-lion',   requiredLevel:47, label:'우주사자',   emoji:'🦁' },
  { id:'divine-beast',  requiredLevel:49, label:'신수',       emoji:'🌟' },
  { id:'legend-creature',requiredLevel:50,label:'전설의존재', emoji:'✨' },
]

// ── 세계관 배너 (50종) — 레벨이 오를수록 신비하고 우주적인 공간 ──
export const BANNER_UNLOCKS = [
  { id:'overworld',     requiredLevel:1,  label:'초원',       emoji:'🌿' },
  { id:'forest',        requiredLevel:2,  label:'숲속',       emoji:'🌲' },
  { id:'nether',        requiredLevel:3,  label:'네더',       emoji:'🔥' },
  { id:'cave',          requiredLevel:4,  label:'동굴',       emoji:'🪨' },
  { id:'ocean',         requiredLevel:5,  label:'바다',       emoji:'🌊' },
  { id:'swamp',         requiredLevel:6,  label:'습지',       emoji:'🌾' },
  { id:'jungle',        requiredLevel:7,  label:'정글',       emoji:'🌴' },
  { id:'savanna',       requiredLevel:8,  label:'사바나',     emoji:'🦁' },
  { id:'snow',          requiredLevel:9,  label:'설원',       emoji:'❄️' },
  { id:'desert',        requiredLevel:10, label:'사막',       emoji:'🏜️' },
  { id:'volcano',       requiredLevel:11, label:'화산',       emoji:'🌋' },
  { id:'mushroom',      requiredLevel:12, label:'버섯섬',     emoji:'🍄' },
  { id:'fortress',      requiredLevel:13, label:'고대요새',   emoji:'🏰' },
  { id:'ruins',         requiredLevel:14, label:'고대유적',   emoji:'🗿' },
  { id:'sky',           requiredLevel:15, label:'구름왕국',   emoji:'☁️' },
  { id:'floating-isle', requiredLevel:16, label:'부유섬',     emoji:'🏝️' },
  { id:'crystal-cave',  requiredLevel:17, label:'수정동굴',   emoji:'💎' },
  { id:'aurora',        requiredLevel:18, label:'오로라설원', emoji:'🌌' },
  { id:'deep-sea',      requiredLevel:19, label:'심해',       emoji:'🌊' },
  { id:'storm-peak',    requiredLevel:20, label:'폭풍정상',   emoji:'⚡' },
  { id:'moon-base',     requiredLevel:21, label:'달기지',     emoji:'🌕' },
  { id:'shadow-realm',  requiredLevel:22, label:'어둠왕국',   emoji:'🌑' },
  { id:'dragon-peak',   requiredLevel:23, label:'용의산',     emoji:'🐉' },
  { id:'time-ruins',    requiredLevel:24, label:'시간유적',   emoji:'⏳' },
  { id:'star-meadow',   requiredLevel:25, label:'별의들판',   emoji:'⭐' },
  { id:'nebula-cave',   requiredLevel:26, label:'성운동굴',   emoji:'🌠' },
  { id:'comet-trail',   requiredLevel:27, label:'혜성궤적',   emoji:'☄️' },
  { id:'space-station', requiredLevel:28, label:'우주정거장', emoji:'🛸' },
  { id:'milky-way',     requiredLevel:29, label:'은하수',     emoji:'🌌' },
  { id:'asteroid-belt', requiredLevel:30, label:'소행성대',   emoji:'🪨' },
  { id:'black-hole',    requiredLevel:31, label:'블랙홀',     emoji:'🕳️' },
  { id:'supernova',     requiredLevel:32, label:'초신성',     emoji:'💥' },
  { id:'pulsar',        requiredLevel:33, label:'펄서',       emoji:'💫' },
  { id:'quasar',        requiredLevel:34, label:'퀘이사',     emoji:'✨' },
  { id:'wormhole',      requiredLevel:35, label:'웜홀',       emoji:'🌀' },
  { id:'dark-matter',   requiredLevel:36, label:'암흑물질',   emoji:'🔮' },
  { id:'antimatter',    requiredLevel:37, label:'반물질영역', emoji:'⚡' },
  { id:'plasma-storm',  requiredLevel:38, label:'플라즈마폭풍',emoji:'🌪️' },
  { id:'cosmic-void',   requiredLevel:39, label:'우주공허',   emoji:'🌑' },
  { id:'galaxy-core',   requiredLevel:40, label:'은하핵',     emoji:'🌟' },
  { id:'quantum-realm', requiredLevel:41, label:'양자영역',   emoji:'💠' },
  { id:'dimension-rift',requiredLevel:42, label:'차원의틈',   emoji:'🔯' },
  { id:'time-stream',   requiredLevel:43, label:'시간의흐름', emoji:'⏳' },
  { id:'crystal-cosmos',requiredLevel:44, label:'수정우주',   emoji:'💎' },
  { id:'divine-realm',  requiredLevel:45, label:'신의영역',   emoji:'😇' },
  { id:'celestial-sea', requiredLevel:46, label:'천상의바다', emoji:'🌊' },
  { id:'void-throne',   requiredLevel:47, label:'공허의왕좌', emoji:'👑' },
  { id:'eternity',      requiredLevel:48, label:'영원의공간', emoji:'♾️' },
  { id:'genesis',       requiredLevel:49, label:'창세의빛',   emoji:'🌅' },
  { id:'godverse',      requiredLevel:50, label:'신의우주',   emoji:'🌌' },
]

// 장비 (기존 호환 유지)
export const EQUIPMENT_UNLOCKS = [
  { id:'sword-wood',    requiredLevel:5,  label:'나무검',     emoji:'🗡️' },
  { id:'armor-leather', requiredLevel:10, label:'가죽갑옷',   emoji:'🛡️' },
  { id:'wand-magic',    requiredLevel:15, label:'마법지팡이', emoji:'🪄' },
  { id:'crown-silver',  requiredLevel:20, label:'은왕관',     emoji:'👑' },
  { id:'sword-diamond', requiredLevel:25, label:'다이아검',   emoji:'💎' },
]

// 배너(등급) 배경 그라디언트 — ProfilePage·HomePage 공유
export const BANNER_BG: Record<string, string> = {
  overworld:'from-grass to-green-700', forest:'from-green-800 to-lime-700',
  nether:'from-red-800 to-orange-700', cave:'from-gray-800 to-gray-600',
  ocean:'from-blue-700 to-sky', swamp:'from-green-900 to-teal-700',
  jungle:'from-green-800 to-lime-500', savanna:'from-yellow-700 to-amber-600',
  snow:'from-blue-100 to-sky/50', desert:'from-yellow-600 to-amber-500',
  volcano:'from-red-900 to-orange-600', mushroom:'from-red-700 to-rose-500',
  fortress:'from-gray-700 to-stone', ruins:'from-stone to-yellow-900',
  sky:'from-sky to-blue-200', 'floating-isle':'from-cyan-400 to-sky',
  'crystal-cave':'from-blue-300 to-purple', aurora:'from-indigo-800 to-green-400',
  'deep-sea':'from-blue-900 to-blue-600', 'storm-peak':'from-gray-900 to-blue-800',
  'moon-base':'from-gray-700 to-gray-400', 'shadow-realm':'from-gray-900 to-purple',
  'dragon-peak':'from-red-900 to-yellow-700', 'time-ruins':'from-amber-800 to-purple',
  'star-meadow':'from-indigo-900 to-purple', 'nebula-cave':'from-purple to-pink-600',
  'comet-trail':'from-blue-900 to-orange-700', 'space-station':'from-gray-900 to-blue-700',
  'milky-way':'from-indigo-900 to-blue-800', 'asteroid-belt':'from-gray-800 to-stone',
  'black-hole':'from-black to-gray-800', supernova:'from-orange-500 to-red-700',
  pulsar:'from-blue-800 to-purple', quasar:'from-purple to-yellow-600',
  wormhole:'from-purple to-blue-900', 'dark-matter':'from-indigo-950 to-purple',
  antimatter:'from-cyan-900 to-blue-900', 'plasma-storm':'from-orange-700 to-purple',
  'cosmic-void':'from-gray-950 to-indigo-900', 'galaxy-core':'from-orange-600 to-yellow-500',
  'quantum-realm':'from-cyan-800 to-purple', 'dimension-rift':'from-pink-700 to-purple',
  'time-stream':'from-amber-700 to-indigo-800', 'crystal-cosmos':'from-blue-300 to-purple',
  'divine-realm':'from-yellow-200 to-white', 'celestial-sea':'from-sky to-indigo-900',
  'void-throne':'from-purple to-black', eternity:'from-white to-purple',
  genesis:'from-orange-300 to-yellow-100', godverse:'from-indigo-900 to-purple',
}


// ── 장비 카탈로그 (무기·투구·방패) ─────────────────────────────────
export interface GearItem {
  id: string
  label: string
  emoji: string
  requiredLevel: number
  slot: 'weapon' | 'helmet' | 'shield' | 'armor'
  svgPath: string
}

export const WEAPON_ITEMS: GearItem[] = [
  { id:'sword-basic',   label:'나무 검',    emoji:'🗡️', requiredLevel:1,  slot:'weapon', svgPath:'/assets/gear/weapon/sword-basic.svg' },
  { id:'bow-basic',     label:'기본 활',    emoji:'🏹', requiredLevel:3,  slot:'weapon', svgPath:'/assets/gear/weapon/bow-basic.svg' },
  { id:'axe-iron',      label:'철 도끼',    emoji:'🪓', requiredLevel:5,  slot:'weapon', svgPath:'/assets/gear/weapon/axe-iron.svg' },
  { id:'sword-iron',    label:'철 검',      emoji:'⚔️', requiredLevel:8,  slot:'weapon', svgPath:'/assets/gear/weapon/sword-iron.svg' },
  { id:'hammer-war',    label:'전쟁 해머',  emoji:'🔨', requiredLevel:10, slot:'weapon', svgPath:'/assets/gear/weapon/hammer-war.svg' },
  { id:'staff-magic',   label:'마법 지팡이',emoji:'🪄', requiredLevel:12, slot:'weapon', svgPath:'/assets/gear/weapon/staff-magic.svg' },
  { id:'sword-dark',    label:'암흑 검',    emoji:'🌑', requiredLevel:15, slot:'weapon', svgPath:'/assets/gear/weapon/sword-dark.svg' },
  { id:'sword-gold',    label:'황금 검',    emoji:'✨', requiredLevel:20, slot:'weapon', svgPath:'/assets/gear/weapon/sword-gold.svg' },
  { id:'lance-dragon',  label:'용 창',      emoji:'🐉', requiredLevel:25, slot:'weapon', svgPath:'/assets/gear/weapon/lance-dragon.svg' },
  { id:'sword-crystal', label:'수정 검',    emoji:'💎', requiredLevel:30, slot:'weapon', svgPath:'/assets/gear/weapon/sword-crystal.svg' },
]

export const HELMET_ITEMS: GearItem[] = [
  { id:'helmet-leather', label:'가죽 투구', emoji:'🪖', requiredLevel:2,  slot:'helmet', svgPath:'/assets/gear/helmet/helmet-leather.svg' },
  { id:'helmet-iron',    label:'철 투구',   emoji:'🪖', requiredLevel:10, slot:'helmet', svgPath:'/assets/gear/helmet/helmet-iron.svg' },
  { id:'helmet-gold',    label:'황금 왕관', emoji:'👑', requiredLevel:18, slot:'helmet', svgPath:'/assets/gear/helmet/helmet-gold.svg' },
  { id:'helmet-magic',   label:'마법 투구', emoji:'💙', requiredLevel:22, slot:'helmet', svgPath:'/assets/gear/helmet/helmet-magic.svg' },
  { id:'helmet-dragon',  label:'용 투구',   emoji:'🐉', requiredLevel:28, slot:'helmet', svgPath:'/assets/gear/helmet/helmet-dragon.svg' },
]

export const SHIELD_ITEMS: GearItem[] = [
  { id:'shield-wood',   label:'나무 방패', emoji:'🛡️', requiredLevel:4,  slot:'shield', svgPath:'/assets/gear/shield/shield-wood.svg' },
  { id:'shield-iron',   label:'철 방패',   emoji:'🛡️', requiredLevel:14, slot:'shield', svgPath:'/assets/gear/shield/shield-iron.svg' },
  { id:'shield-gold',   label:'황금 방패', emoji:'⭐', requiredLevel:22, slot:'shield', svgPath:'/assets/gear/shield/shield-gold.svg' },
  { id:'shield-magic',  label:'마법 방패', emoji:'💠', requiredLevel:28, slot:'shield', svgPath:'/assets/gear/shield/shield-magic.svg' },
  { id:'shield-dragon', label:'용 방패',   emoji:'🔥', requiredLevel:32, slot:'shield', svgPath:'/assets/gear/shield/shield-dragon.svg' },
]

export const ARMOR_ITEMS: GearItem[] = [
  { id:'armor-leather', label:'가죽 갑옷', emoji:'🧥', requiredLevel:2,  slot:'armor', svgPath:'/assets/gear/armor/armor-leather.svg' },
  { id:'armor-iron',    label:'철 갑옷',   emoji:'🛡️', requiredLevel:8,  slot:'armor', svgPath:'/assets/gear/armor/armor-iron.svg' },
  { id:'armor-chain',   label:'사슬 갑옷', emoji:'⛓️', requiredLevel:14, slot:'armor', svgPath:'/assets/gear/armor/armor-chain.svg' },
  { id:'armor-gold',    label:'황금 갑옷', emoji:'✨', requiredLevel:20, slot:'armor', svgPath:'/assets/gear/armor/armor-gold.svg' },
  { id:'armor-dragon',  label:'드래곤 갑옷',emoji:'🐉', requiredLevel:28, slot:'armor', svgPath:'/assets/gear/armor/armor-dragon.svg' },
]

export function getGearBySlot(slot: 'weapon'|'helmet'|'shield'|'armor'): GearItem[] {
  if (slot === 'weapon') return WEAPON_ITEMS
  if (slot === 'helmet') return HELMET_ITEMS
  if (slot === 'shield') return SHIELD_ITEMS
  return ARMOR_ITEMS
}
export function getUnlockedGear(slot: 'weapon'|'helmet'|'shield'|'armor', level: number, isParent: boolean): string[] {
  const items = getGearBySlot(slot)
  if (isParent) return items.map(i => i.id)
  return items.filter(i => level >= i.requiredLevel).map(i => i.id)
}
