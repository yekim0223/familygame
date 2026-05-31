// Design Ref: §5.3 SCR-19 ProfilePage — 캐릭터·반려동물·장비·세계관 배너 + 닉네임 수정 (v3.0 MC Dark)
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { updateMember } from '@/infrastructure/firebase/collections/members'
import { hashPin } from '@/infrastructure/firebase/auth'
import {
  getUnlockedCharacters, getUnlockedPets, getUnlockedBanners,
  ALL_CHARACTERS, LEVEL_CHARACTERS, CHARACTER_EMOJI, CHARACTER_LABELS,
  PET_UNLOCKS, BANNER_UNLOCKS, BANNER_BG,
} from '@/application/use-cases/characters/selectCharacter'
import { CharacterSprite, PetSprite } from '@/presentation/components/character/CharacterSprite'
import { InventoryGrid } from '@/presentation/components/character/InventoryGrid'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import {
  useInventoryStore,
  SKIN_CATALOG, BG_CATALOG, PET_SHOP_CATALOG, WEAPON_CATALOG,
  getXPLevel,
  type ShopItem, type BgType, type WeaponType,
} from '@/infrastructure/stores/userInventoryStore'

type Panel    = 'none' | 'character' | 'pet' | 'banner'
type ShopTab  = 'skin' | 'bg' | 'pet' | 'weapon'

const ROLE_LABELS: Record<string, string> = {
  DAD: '아빠 (Master)',
  MOM: '엄마 (Parent)',
  CHILD: '딸 (Child)',
  OBSERVER: '옵저버',
}

const INPUT_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'

export default function ProfilePage() {
  const { currentMember, logout } = useAuth()
  const { familyId, setCurrentMember } = useAuthStore()
  const location = useLocation()

  const [activePanel, setActivePanel] = useState<Panel>(() => {
    const p = (location.state as any)?.panel as Panel | undefined
    return (p && ['character', 'pet', 'banner'].includes(p)) ? p : 'none'
  })
  const [saving,  setSaving] = useState(false)
  const [msg,     setMsg]    = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [newNickname, setNewNickname] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (activePanel !== 'none') {
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }, [activePanel])

  // PIN 변경
  const [pinPanel,   setPinPanel]   = useState(false)
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew,     setPinNew]     = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinMsg,     setPinMsg]     = useState('')
  const [pinSaving,  setPinSaving]  = useState(false)

  // 즉시 미리보기용 로컬 state
  const [previewCharId, setPreviewCharId] = useState('')
  const [previewPetId,  setPreviewPetId]  = useState('')
  const [previewBanner, setPreviewBanner] = useState('')

  // ── XP 상점 상태 ────────────────────────────────────────────────
  const [shopTab,    setShopTab]    = useState<ShopTab>('skin')
  const [buyTarget,  setBuyTarget]  = useState<ShopItem | null>(null)
  const [buyMsg,     setBuyMsg]     = useState<string | null>(null)

  // XP 인벤토리 스토어
  const {
    currentSkin, currentWeapon, currentPet: invPet, currentBg,
    ownedSkins, ownedBgs, ownedPetShop, ownedWeapons,
    gameXP, totalEarnedXP,
    setSkin, setWeapon, setPet: setInvPet, setBg,
    spendXP, unlockItem,
  } = useInventoryStore()

  const xpLevel = getXPLevel(totalEarnedXP)

  const handleBuyConfirm = () => {
    if (!buyTarget) return
    const ok = spendXP(buyTarget.cost)
    if (!ok) { setBuyMsg('XP가 부족해요! 🎮 게임을 플레이해서 XP를 모아보세요'); return }
    unlockItem(shopTab, buyTarget.id)
    setBuyMsg(`${buyTarget.emoji} ${buyTarget.label} 해금 완료! ✅`)
    setTimeout(() => { setBuyTarget(null); setBuyMsg(null) }, 1800)
  }

  const handleEquip = async (type: ShopTab, id: string) => {
    if (!currentMember || !familyId) return

    // 1. 로컬 인벤토리 스토어 상태 변경
    if (type === 'skin')   setSkin(id)
    if (type === 'bg')     setBg(id as BgType)
    if (type === 'pet')    setInvPet(id)
    if (type === 'weapon') setWeapon(id as WeaponType)

    // 2. 현재 메모리에 들고 있는 최신 장착본으로 객체 재구성
    const updatedCharacter = {
      characterId: type === 'skin'   ? id : (currentSkin   || currentMember.character.characterId),
      petId:       type === 'pet'    ? id : (invPet        || currentMember.character.petId),
      worldBanner: type === 'bg'     ? id : (currentBg     || currentMember.character.worldBanner),
      equipment:   type === 'weapon' ? [id] : (currentMember.character.equipment || []),
    }

    // 3. Firebase Firestore 원격 동기화
    await updateMember(familyId, currentMember.id, { character: updatedCharacter } as any)

    // 4. 전역 Auth 세션 강제 덮어씌기 → 패밀리뉴스·화면 전체 리렌더링 유도
    setCurrentMember({ ...currentMember, character: updatedCharacter })
  }

  const isOwned = (type: ShopTab, id: string): boolean => {
    if (type === 'skin') {
      // XP 구매 보유 OR Firebase 레벨 언락 합집합
      const lvlUnlocked = currentMember
        ? getUnlockedCharacters(currentMember.role, currentMember.level)
        : []
      return ownedSkins.includes(id) || lvlUnlocked.includes(id)
    }
    if (type === 'bg') return ownedBgs.includes(id)
    if (type === 'pet') {
      // XP 구매 보유 OR Firebase 레벨 언락 합집합
      const lvlUnlocked = currentMember ? getUnlockedPets(currentMember.level) : []
      return ownedPetShop.includes(id) || lvlUnlocked.includes(id)
    }
    if (type === 'weapon') return ownedWeapons.includes(id)
    return false
  }

  const isEquipped = (type: ShopTab, id: string): boolean => {
    if (type === 'skin')   return currentSkin   === id
    if (type === 'bg')     return currentBg     === id
    if (type === 'pet')    return invPet         === id
    if (type === 'weapon') return currentWeapon === id
    return false
  }

  const shopCatalog: Record<ShopTab, ShopItem[]> = {
    skin:   SKIN_CATALOG,
    bg:     BG_CATALOG,
    pet:    PET_SHOP_CATALOG,
    weapon: WEAPON_CATALOG,
  }

  useEffect(() => {
    if (!currentMember) return
    setPreviewCharId(currentMember.character.characterId)
    setPreviewPetId(currentMember.character.petId)
    setPreviewBanner(currentMember.character.worldBanner)
  }, [currentMember?.id])

  if (!currentMember || !familyId) return null

  const handlePinChange = async () => {
    if (pinNew.length < 2 || pinNew.length > 8) { setPinMsg('PIN은 2~8자로 입력해줘요'); return }
    if (pinNew !== pinConfirm) { setPinMsg('새 PIN이 일치하지 않아요'); return }
    setPinSaving(true); setPinMsg('')
    const currentHash = await hashPin(pinCurrent)
    if (currentHash !== currentMember.pinHash) {
      setPinSaving(false); setPinMsg('현재 PIN이 틀렸어요 🔒'); return
    }
    const newHash = await hashPin(pinNew)
    const { error } = await updateMember(familyId, currentMember.id, { pinHash: newHash } as any)
    setPinSaving(false)
    if (error) { setPinMsg('변경 실패: ' + error); return }
    setPinMsg('PIN이 변경됐어요! ✅')
    setPinCurrent(''); setPinNew(''); setPinConfirm('')
    setTimeout(() => { setPinMsg(''); setPinPanel(false) }, 2000)
  }

  const handleNicknameSave = async () => {
    if (!newNickname.trim()) return
    const { error } = await updateMember(familyId, currentMember.id, { name: newNickname.trim() } as any)
    if (error) { setMsg(error); return }
    setCurrentMember({ ...currentMember, name: newNickname.trim() })
    setEditingNickname(false)
    setMsg('닉네임이 변경되었어요')
    setTimeout(() => setMsg(''), 2000)
  }

  const { level, exp, role } = currentMember

  const unlockedCharacters = getUnlockedCharacters(role, level)
  const unlockedPets       = getUnlockedPets(level)
  const unlockedBanners    = getUnlockedBanners(level)
  const isParent           = role === 'DAD' || role === 'MOM'

  const allCharSlots = ALL_CHARACTERS[role]?.map(c => ({
    id: c.id,
    requiredLevel: isParent ? 1 : c.requiredLevel,
  })) ?? []

  const saveCharacter = async (newChar: typeof currentMember.character) => {
    const safeChar = {
      characterId: newChar.characterId || currentMember.character.characterId,
      petId:       newChar.petId       || currentMember.character.petId,
      equipment:   newChar.equipment   || [],
      worldBanner: newChar.worldBanner || currentMember.character.worldBanner,
    }
    const { error } = await updateMember(familyId, currentMember.id, { character: safeChar } as any)
    if (error) return error
    setCurrentMember({ ...currentMember, character: safeChar })
    return null
  }

  const handleSelectCharacter = async (characterId: string) => {
    if (!isParent) {
      const unlocked = getUnlockedCharacters(role, level)
      if (!unlocked.includes(characterId)) { setMsg('아직 오픈되지 않은 캐릭터예요 🔒'); return }
    }
    const newChar = { ...currentMember.character, characterId }
    setPreviewCharId(characterId)
    setSkin(characterId)  // 인벤토리 스토어와 동기화
    setSaving(true)
    const error = await saveCharacter(newChar)
    setSaving(false)
    if (error) { setPreviewCharId(currentMember.character.characterId); setMsg('저장 실패: ' + error); return }
    setMsg('')
  }

  const handleSelectPet = async (petId: string) => {
    if (!isParent) {
      const unlocked = getUnlockedPets(level)
      if (!unlocked.includes(petId)) { setMsg('아직 오픈되지 않은 펫이에요 🔒'); return }
    }
    setPreviewPetId(petId)
    setInvPet(petId)  // 인벤토리 스토어와 동기화
    setSaving(true)
    const { error } = await updateMember(familyId, currentMember.id, {
      'character.petId': petId,
    } as any)
    setSaving(false)
    if (error) {
      setPreviewPetId(currentMember.character.petId)
      setMsg('저장 실패: ' + error)
      return
    }
    setCurrentMember({ ...currentMember, character: { ...currentMember.character, petId } })
    setMsg('')
  }

  const handleSelectBanner = async (bannerId: string) => {
    if (!isParent) {
      const unlocked = getUnlockedBanners(level)
      if (!unlocked.includes(bannerId)) { setMsg('아직 오픈되지 않은 등급이에요 🔒'); return }
    }
    const newChar = { ...currentMember.character, worldBanner: bannerId }
    setPreviewBanner(bannerId)
    setSaving(true)
    const error = await saveCharacter(newChar)
    setSaving(false)
    if (error) { setPreviewBanner(currentMember.character.worldBanner); setMsg('저장 실패: ' + error); return }
    setMsg('')
  }

  // 우선순위: 스토어 장착값 > 로컬 프리뷰 > Firebase 기본값
  const displayCharId = currentSkin   || previewCharId || currentMember.character.characterId
  const displayPetId  = invPet        || previewPetId  || currentMember.character.petId
  const displayBanner = previewBanner || currentMember.character.worldBanner

  const currentBanner  = BANNER_UNLOCKS.find(b => b.id === displayBanner)
  const bannerGradient = BANNER_BG[displayBanner] ?? 'from-grass to-green-700'

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* ── 배너 + 캐릭터 디스플레이 ─────────────────────────────── */}
      <div className={`bg-gradient-to-b ${bannerGradient} p-4 border-4 border-black`}>
        <div className="flex items-end gap-3">
          <div className="relative">
            <CharacterSprite
              characterId={currentSkin || currentMember.character.characterId}
              role={role}
              size="xl"
              animate="bob"
              weapon={currentWeapon || (currentMember.character.equipment?.[0] as any)}
            />
            <div className="absolute -bottom-1 -right-1">
              <PetSprite petId={displayPetId} size="sm" />
            </div>
          </div>

          <div className="flex-1">
            {editingNickname ? (
              <div className="flex gap-1 mb-1">
                <input
                  value={newNickname}
                  onChange={e => setNewNickname(e.target.value)}
                  maxLength={10}
                  autoFocus
                  className="flex-1 input-pixel font-korean text-sm text-gold min-h-[36px] px-2 py-1 focus:outline-none focus:border-gold"
                />
                <PixelButton size="sm" variant="gold" onClick={handleNicknameSave}>저장</PixelButton>
                <PixelButton size="sm" variant="ghost" onClick={() => setEditingNickname(false)}>취소</PixelButton>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="font-korean text-sm font-bold text-cream">
                  {currentMember.name}
                  {currentMember.realName && currentMember.realName !== currentMember.name && (
                    <span className="text-cream/80 font-normal ml-1">({currentMember.realName})</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => { setEditingNickname(true); setNewNickname(currentMember.name) }}
                  className="font-korean text-xs text-gold/70 underline"
                >
                  수정
                </button>
              </div>
            )}
            <p className="font-korean text-xs text-cream/80 mt-0.5">{ROLE_LABELS[role]}</p>
            {role === 'CHILD' && (
              <div className="mt-2">
                <ExpBar exp={exp} level={level} className="text-cream" />
              </div>
            )}
            <p className="font-korean text-xs text-gold mt-1">
              {currentBanner?.emoji} {currentBanner?.label ?? '초원 세계'}
            </p>
          </div>
        </div>
      </div>

      {/* 메시지 */}
      {msg && (
        <div className="text-center">
          <span className="font-korean text-sm text-approved">{msg}</span>
        </div>
      )}

      {/* ── PIN 변경 ────────────────────────────────────────────── */}
      <div className="card-pixel p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="t-sub font-bold text-gold">🔒 PIN 번호 변경</p>
          <PixelButton
            size="sm"
            variant="ghost"
            onClick={() => { setPinPanel(p => !p); setPinMsg('') }}
          >
            {pinPanel ? '닫기' : '변경하기'}
          </PixelButton>
        </div>
        {pinPanel && (
          <div className="space-y-2">
            {(['현재 PIN', '새 PIN', '새 PIN 확인'] as const).map((label, i) => {
              const val    = [pinCurrent, pinNew, pinConfirm][i]
              const setter = [setPinCurrent, setPinNew, setPinConfirm][i]
              return (
                <input
                  key={label}
                  type="password"
                  value={val}
                  onChange={e => setter(e.target.value.slice(0, 8))}
                  placeholder={label}
                  className={INPUT_CLS}
                />
              )
            })}
            {pinMsg && (
              <p className={`font-korean text-sm font-bold ${pinMsg.includes('✅') ? 'text-approved' : 'text-rejected'}`}>
                {pinMsg}
              </p>
            )}
            <PixelButton
              variant="purple"
              size="md"
              fullWidth
              disabled={pinSaving || !pinCurrent || !pinNew || !pinConfirm}
              onClick={handlePinChange}
            >
              {pinSaving ? '변경 중...' : 'PIN 변경'}
            </PixelButton>
          </div>
        )}
      </div>

      {/* ── XP 상점 (마인크래프트 인벤토리 슬롯 체계) ─────────────── */}
      <div className="card-pixel p-3 space-y-3">
        {/* XP 잔액 헤더 */}
        <div className="flex items-center justify-between">
          <p className="t-sub font-bold text-gold">🎒 아이템 상점</p>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs text-gold t-pixel-shadow">Lv.{xpLevel}</span>
            <span className="font-korean text-xs text-panel-sub">|</span>
            <span className="font-pixel text-xs text-yellow-400 t-pixel-shadow">{gameXP.toLocaleString()} XP</span>
          </div>
        </div>

        {/* 4탭 + 아바타 프리뷰 분할 레이아웃 */}
        <div className="flex gap-3">
          {/* 좌측 — 실시간 아바타 프리뷰 */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <CharacterSprite
              characterId={displayCharId}
              role={role}
              size="lg"
              animate="bob"
              variant="job"
              weapon={currentWeapon}
              className=""
            />
            {/* 장착 정보 미니 뱃지 */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-pixel text-[9px] text-yellow-400 t-pixel-shadow text-center">
                {SKIN_CATALOG.find(s => s.id === currentSkin)?.emoji} {SKIN_CATALOG.find(s => s.id === currentSkin)?.label ?? '전사'}
              </span>
              <span className="font-pixel text-[9px] text-sky text-center">
                {BG_CATALOG.find(b => b.id === currentBg)?.emoji} {BG_CATALOG.find(b => b.id === currentBg)?.label ?? '기본방'}
              </span>
            </div>
          </div>

          {/* 우측 — 탭 + 슬롯 그리드 */}
          <div className="flex-1 min-w-0">
            {/* 4탭 선택 */}
            <div className="grid grid-cols-4 gap-1 mb-2">
              {([
                { key: 'skin'  , icon: '👕', label: '직업' },
                { key: 'bg'    , icon: '🖼️', label: '배경' },
                { key: 'pet'   , icon: '🐱', label: '펫' },
                { key: 'weapon', icon: '⚔️', label: '무기' },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setShopTab(key)}
                  className={[
                    'flex flex-col items-center py-1.5 border-4 text-center',
                    'active:scale-95 transition-transform duration-75',
                    shopTab === key
                      ? 'bg-gold border-gold text-pixel-dark shadow-[inset_2px_2px_0px_#ffffff40]'
                      : 'bg-panel-mid border-panel-border text-panel-sub hover:border-gold/50',
                  ].join(' ')}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className="font-korean text-[10px] font-bold mt-0.5">{label}</span>
                </button>
              ))}
            </div>

            {/* 아이템 슬롯 그리드 (4열) */}
            <div className="grid grid-cols-4 gap-1">
              {shopCatalog[shopTab].map(item => {
                const owned    = isOwned(shopTab, item.id)
                const equipped = isEquipped(shopTab, item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (equipped) return
                      if (owned) { handleEquip(shopTab, item.id) } else { setBuyTarget(item) }
                    }}
                    className={[
                      'relative flex flex-col items-center justify-center gap-0.5',
                      'border-4 py-1.5 px-1 min-h-[56px]',
                      'active:scale-95 transition-transform duration-75',
                      equipped
                        ? 'bg-gold/20 border-yellow-400 card-special'
                        : owned
                        ? 'bg-panel-dark border-panel-border hover:border-gold/60 shadow-[inset_2px_2px_0px_#ffffff10]'
                        : 'bg-panel-darkest border-black opacity-70',
                    ].join(' ')}
                    title={owned ? (equipped ? '장착 중' : '장착하기') : `해금: ${item.cost} XP`}
                  >
                    <span className="text-xl leading-none">{item.emoji}</span>
                    <span className={`font-korean text-[9px] leading-tight text-center ${equipped ? 'text-yellow-400 font-bold' : owned ? 'text-panel-sub' : 'text-stone/60'}`}>
                      {item.label}
                    </span>
                    {/* 장착 중 표시 */}
                    {equipped && (
                      <span className="absolute top-0.5 right-0.5 font-pixel text-[7px] text-yellow-400 leading-none">ON</span>
                    )}
                    {/* 자물쇠 오버레이 */}
                    {!owned && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55">
                        <span className="text-base leading-none">🔒</span>
                        <span className="font-pixel text-[7px] text-yellow-400 mt-0.5">{item.cost}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 구매 확인 모달 ─────────────────────────────────────────── */}
      {buyTarget && (
        <PixelModal
          open={!!buyTarget}
          title={`${buyTarget.emoji} ${buyTarget.label} 해금`}
          onClose={() => { setBuyTarget(null); setBuyMsg(null) }}
        >
          <div className="space-y-3">
            {buyMsg ? (
              <p className={`font-korean text-sm text-center font-bold ${buyMsg.includes('✅') ? 'text-approved' : 'text-rejected'}`}>
                {buyMsg}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 py-2">
                  <span className="text-4xl">{buyTarget.emoji}</span>
                  <div>
                    <p className="font-korean text-sm font-bold text-cream">{buyTarget.label}</p>
                    <p className="font-pixel text-xs text-yellow-400 mt-0.5">
                      {buyTarget.cost.toLocaleString()} XP 필요
                    </p>
                    <p className="font-pixel text-xs text-panel-sub">
                      보유: {gameXP.toLocaleString()} XP
                    </p>
                  </div>
                </div>
                {gameXP < buyTarget.cost && (
                  <p className="font-korean text-xs text-rejected text-center">
                    XP 부족 (필요: {(buyTarget.cost - gameXP).toLocaleString()} XP 더 필요)
                  </p>
                )}
                <div className="flex gap-2">
                  <PixelButton
                    variant="gold"
                    size="md"
                    fullWidth
                    disabled={gameXP < buyTarget.cost}
                    onClick={handleBuyConfirm}
                  >
                    🔓 해금하기
                  </PixelButton>
                  <PixelButton
                    variant="ghost"
                    size="md"
                    onClick={() => { setBuyTarget(null); setBuyMsg(null) }}
                  >
                    취소
                  </PixelButton>
                </div>
              </>
            )}
          </div>
        </PixelModal>
      )}

      {/* ── 패널 전환 버튼 ──────────────────────────────────────── */}
      <div ref={panelRef} className="grid grid-cols-3 gap-2">
        {([
          { key: 'character', icon: '👾', label: '캐릭터' },
          { key: 'pet',       icon: '🐶', label: '마이 펫' },
          { key: 'banner',    icon: '🌌', label: '등급' },
        ] as const).map(({ key, icon, label }) => (
          <PixelButton
            key={key}
            variant={activePanel === key ? 'purple' : 'ghost'}
            size="md"
            disabled={saving}
            onClick={() => setActivePanel(activePanel === key ? 'none' : key)}
          >
            {icon} {label}
          </PixelButton>
        ))}
      </div>

      {/* ── 캐릭터 인벤토리 ─────────────────────────────────────── */}
      {activePanel === 'character' && (
        <div className="card-pixel p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="t-sub font-bold text-gold">캐릭터 선택 (50종)</p>
            {!isParent && <p className="t-micro text-panel-sub">🔒 레벨 달성 시 오픈!</p>}
            {isParent  && <p className="t-micro text-approved">✅ 전부 자유 선택!</p>}
          </div>
          <InventoryGrid
            slots={allCharSlots}
            unlockedIds={unlockedCharacters}
            selectedId={displayCharId}
            onSelect={handleSelectCharacter}
            currentLevel={level}
            columns={5}
          />
        </div>
      )}

      {/* ── 마이 펫 ─────────────────────────────────────────────── */}
      {activePanel === 'pet' && (
        <div className="card-pixel p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="t-sub font-bold text-gold">마이 펫 선택 (50종)</p>
            <p className="t-micro text-panel-sub">레벨이 높을수록 강한 펫 오픈!</p>
          </div>
          <InventoryGrid
            slots={PET_UNLOCKS.map(p => ({ id: p.id, requiredLevel: isParent ? 1 : p.requiredLevel, emoji: p.emoji, label: p.label }))}
            unlockedIds={isParent ? PET_UNLOCKS.map(p => p.id) : unlockedPets}
            selectedId={displayPetId}
            onSelect={handleSelectPet}
            currentLevel={level}
            columns={5}
          />
        </div>
      )}

      {/* ── 세계관 배너 ─────────────────────────────────────────── */}
      {activePanel === 'banner' && (
        <div className="card-pixel p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="t-sub font-bold text-gold">배너 선택 (50종)</p>
            <p className="t-micro text-panel-sub">레벨이 높을수록 신비한 배너 오픈!</p>
          </div>
          <InventoryGrid
            slots={BANNER_UNLOCKS.map(b => ({ id: b.id, requiredLevel: isParent ? 1 : b.requiredLevel, emoji: b.emoji, label: b.label }))}
            unlockedIds={isParent ? BANNER_UNLOCKS.map(b => b.id) : unlockedBanners}
            selectedId={displayBanner}
            onSelect={handleSelectBanner}
            currentLevel={level}
            columns={5}
          />
          <p className="t-micro text-panel-sub mt-2 text-center">
            배너는 프로필 배경에 표시됩니다
          </p>
        </div>
      )}

      {/* ── 다음 해금 로드맵 (아이만) ──────────────────────────── */}
      {!isParent && (
        <div className="card-pixel p-3">
          <p className="t-sub font-bold text-gold mb-2">다음 해금 목록</p>
          <div className="space-y-1">
            {[
              ...PET_UNLOCKS.filter(p => level < p.requiredLevel).slice(0, 1).map(p => ({
                level: p.requiredLevel, label: `${p.emoji} ${p.label} 해금`
              })),
              ...BANNER_UNLOCKS.filter(b => level < b.requiredLevel).slice(0, 1).map(b => ({
                level: b.requiredLevel, label: `${b.emoji} ${b.label} 배너 해금`
              })),
              ...(LEVEL_CHARACTERS[role] ?? [])
                .filter(c => level < c.requiredLevel).slice(0, 1).map(c => ({
                  level: c.requiredLevel,
                  label: `${CHARACTER_EMOJI[c.id] ?? '👤'} ${CHARACTER_LABELS[c.id] ?? c.id} 캐릭터 해금`
                })),
            ].sort((a, b) => a.level - b.level).slice(0, 3).map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="t-sub text-cream">{item.label}</span>
                <span className="t-sub text-panel-sub">Lv.{item.level}</span>
              </div>
            ))}
            {level >= 25 && (
              <p className="t-sub text-approved text-center">모든 기본 캐릭터 해금 완료! 🎉</p>
            )}
          </div>
        </div>
      )}

      {/* ── 로그아웃 ────────────────────────────────────────────── */}
      <div className="pt-2">
        <PixelButton variant="danger" size="lg" fullWidth onClick={logout}>
          로그아웃
        </PixelButton>
      </div>
    </div>
  )
}
