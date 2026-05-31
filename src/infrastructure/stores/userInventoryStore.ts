// 전역 인벤토리 스토어 — 게임/미션으로 획득한 XP + 아이템 보유·장착 상태
import { create } from 'zustand'

// ── 타입 정의 ─────────────────────────────────────────────────────
export type WeaponType = 'basic' | 'laser' | 'double'
export type SkinType   = 'warrior' | 'archer' | 'mage' | 'rogue' | 'chef'
                       | 'dark-knight' | 'arch-mage' | 'king'
export type BgType     = 'room' | 'forest' | 'sea' | 'castle' | 'sky'
                       | 'lava' | 'neon' | 'storm'

// ── 아이템 카탈로그 ────────────────────────────────────────────────

export interface ShopItem {
  id:    string
  label: string
  emoji: string
  cost:  number   // 0 = 무료 기본 지급
}

export const SKIN_CATALOG: ShopItem[] = [
  { id: 'warrior',    label: '전사',      emoji: '⚔️',  cost: 0    },
  { id: 'archer',     label: '궁수',      emoji: '🏹',  cost: 0    },
  { id: 'mage',       label: '법사',      emoji: '🧙',  cost: 0    },
  { id: 'rogue',      label: '도적',      emoji: '🗡️',  cost: 0    },
  { id: 'chef',       label: '요리사',    emoji: '👨‍🍳', cost: 0    },
  { id: 'dark-knight',label: '흑기사',    emoji: '🛡️',  cost: 1000 },
  { id: 'arch-mage',  label: '대마도사',  emoji: '🔮',  cost: 1200 },
  { id: 'king',       label: '국왕',      emoji: '👑',  cost: 2500 },
]

export const BG_CATALOG: ShopItem[] = [
  { id: 'room',    label: '기본방',    emoji: '🏠', cost: 0    },
  { id: 'forest',  label: '숲',        emoji: '🌲', cost: 0    },
  { id: 'sea',     label: '바다',      emoji: '🌊', cost: 0    },
  { id: 'castle',  label: '성벽',      emoji: '🏰', cost: 0    },
  { id: 'sky',     label: '하늘',      emoji: '☁️', cost: 0    },
  { id: 'lava',    label: '용암 요새', emoji: '🌋', cost: 500  },
  { id: 'neon',    label: '네온 시티', emoji: '🌃', cost: 800  },
  { id: 'storm',   label: '폭풍 정상', emoji: '⛈️', cost: 1500 },
]

export const PET_SHOP_CATALOG: ShopItem[] = [
  { id: 'cat',        label: '고양이',     emoji: '🐱', cost: 0    },
  { id: 'shiba',      label: '시바견',     emoji: '🐕', cost: 0    },
  { id: 'hamster',    label: '햄스터',     emoji: '🐹', cost: 0    },
  { id: 'rabbit',     label: '토끼',       emoji: '🐰', cost: 0    },
  { id: 'chick',      label: '병아리',     emoji: '🐥', cost: 0    },
  { id: 'ninetail',   label: '구미호',     emoji: '🦊', cost: 700  },
  { id: 'griffin',    label: '그리핀',     emoji: '🦅', cost: 1000 },
  { id: 'minidragon', label: '미니 드래곤',emoji: '🐉', cost: 3000 },
]

export const WEAPON_CATALOG: ShopItem[] = [
  { id: 'basic',  label: '기본 단검', emoji: '🗡️', cost: 0 },
  { id: 'laser',  label: '레이저건', emoji: '⚡',  cost: 0 },
  { id: 'double', label: '더블총',   emoji: '🔫', cost: 0 },
]

// 기본 무료 지급 아이템 ID 목록
const FREE_SKINS    = SKIN_CATALOG.filter(i => i.cost === 0).map(i => i.id)
const FREE_BGS      = BG_CATALOG.filter(i => i.cost === 0).map(i => i.id)
const FREE_PET_SHOP = PET_SHOP_CATALOG.filter(i => i.cost === 0).map(i => i.id)
const FREE_WEAPONS  = WEAPON_CATALOG.map(i => i.id)

// XP 레벨 계산: 1,000 XP 누적당 Lv.1 (누적 XP 기준)
export function getXPLevel(totalXP: number): number {
  return Math.floor(totalXP / 1000) + 1
}

// ── Zustand 스토어 ────────────────────────────────────────────────

interface InventoryState {
  currentSkin:    string
  currentWeapon:  WeaponType
  currentPet:     string
  currentBg:      BgType
  gameXP:         number   // 현재 보유 XP (적립 및 소비 통합 잔액)
  totalEarnedXP:  number   // 누적 획득 XP (레벨 산출용, 차감되지 않음)

  // 보유 아이템 목록 (구매 완료 or 무료 기본 지급)
  ownedSkins:    string[]
  ownedBgs:      string[]
  ownedPetShop:  string[]
  ownedWeapons:  string[]

  // 액션
  setWeapon:   (w: WeaponType) => void
  setSkin:     (s: string) => void
  setPet:      (p: string) => void
  setBg:       (b: BgType) => void
  addGameXP:   (pts: number) => void
  spendXP:     (cost: number) => boolean           // 잔액 부족 시 false 반환
  unlockItem:  (type: 'skin' | 'bg' | 'pet' | 'weapon', id: string) => void
  hasItem:     (type: 'skin' | 'bg' | 'pet' | 'weapon', id: string) => boolean
}

// ── localStorage 헬퍼 ─────────────────────────────────────────────

function loadLS<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? (JSON.parse(v) as T) : def
  } catch { return def }
}
function saveLS(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ── 스토어 생성 ───────────────────────────────────────────────────

export const useInventoryStore = create<InventoryState>((set, get) => ({
  currentSkin:   loadLS<string>('fq_inv_skin',      'warrior'),
  currentWeapon: loadLS<WeaponType>('fq_inv_weapon', 'basic'),
  currentPet:    loadLS<string>('fq_inv_pet',        ''),
  currentBg:     loadLS<BgType>('fq_inv_bg',         'room'),
  gameXP:        loadLS<number>('fq_inv_xp',         0),
  totalEarnedXP: loadLS<number>('fq_inv_total_xp',   0),

  ownedSkins:   loadLS<string[]>('fq_inv_owned_skins',   FREE_SKINS),
  ownedBgs:     loadLS<string[]>('fq_inv_owned_bgs',     FREE_BGS),
  ownedPetShop: loadLS<string[]>('fq_inv_owned_pet_shop', FREE_PET_SHOP),
  ownedWeapons: loadLS<string[]>('fq_inv_owned_weapons', FREE_WEAPONS),

  setWeapon: (w) => { set({ currentWeapon: w }); saveLS('fq_inv_weapon', w) },
  setSkin:   (s) => { set({ currentSkin:   s }); saveLS('fq_inv_skin',   s) },
  setPet:    (p) => { set({ currentPet:    p }); saveLS('fq_inv_pet',    p) },
  setBg:     (b) => { set({ currentBg:     b }); saveLS('fq_inv_bg',     b) },

  addGameXP: (pts) => {
    const gained = Math.floor(pts / 100)   // 100점당 1 XP
    if (gained <= 0) return
    const { gameXP, totalEarnedXP } = get()
    const nextXP      = gameXP      + gained
    const nextTotalXP = totalEarnedXP + gained
    set({ gameXP: nextXP, totalEarnedXP: nextTotalXP })
    saveLS('fq_inv_xp',       nextXP)
    saveLS('fq_inv_total_xp', nextTotalXP)
  },

  // XP 잔액에서 cost 차감. 성공 시 true, 잔액 부족 시 false
  spendXP: (cost) => {
    const { gameXP } = get()
    if (gameXP < cost) return false
    const next = gameXP - cost
    set({ gameXP: next })
    saveLS('fq_inv_xp', next)
    return true
  },

  // 아이템 해금 (구매 성공 후 호출)
  unlockItem: (type, id) => {
    const s = get()
    if (type === 'skin') {
      if (s.ownedSkins.includes(id)) return
      const next = [...s.ownedSkins, id]
      set({ ownedSkins: next }); saveLS('fq_inv_owned_skins', next)
    } else if (type === 'bg') {
      if (s.ownedBgs.includes(id)) return
      const next = [...s.ownedBgs, id]
      set({ ownedBgs: next }); saveLS('fq_inv_owned_bgs', next)
    } else if (type === 'pet') {
      if (s.ownedPetShop.includes(id)) return
      const next = [...s.ownedPetShop, id]
      set({ ownedPetShop: next }); saveLS('fq_inv_owned_pet_shop', next)
    } else if (type === 'weapon') {
      if (s.ownedWeapons.includes(id)) return
      const next = [...s.ownedWeapons, id]
      set({ ownedWeapons: next }); saveLS('fq_inv_owned_weapons', next)
    }
  },

  hasItem: (type, id) => {
    const s = get()
    if (type === 'skin')   return s.ownedSkins.includes(id)
    if (type === 'bg')     return s.ownedBgs.includes(id)
    if (type === 'pet')    return s.ownedPetShop.includes(id)
    if (type === 'weapon') return s.ownedWeapons.includes(id)
    return false
  },
}))
