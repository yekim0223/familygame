// Design Ref: §5.3 SCR-19 ProfilePage — 캐릭터·반려동물·장비·세계관 배너 + 닉네임 수정 (v4.1 Compact Preview)
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { updateMember } from '@/infrastructure/firebase/collections/members'
import { hashPin } from '@/infrastructure/firebase/auth'
import {
  getUnlockedCharacters, getUnlockedPets, getUnlockedBanners, getUnlockedGear,
  ALL_CHARACTERS, LEVEL_CHARACTERS, CHARACTER_EMOJI, CHARACTER_LABELS,
  PET_UNLOCKS, BANNER_UNLOCKS, WEAPON_ITEMS, HELMET_ITEMS, SHIELD_ITEMS, ARMOR_ITEMS,
} from '@/application/use-cases/characters/selectCharacter'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { InventoryGrid } from '@/presentation/components/character/InventoryGrid'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'

type Panel = 'none' | 'character' | 'pet' | 'gear' | 'banner'

const ROLE_LABELS: Record<string, string> = {
  DAD: '아빠 (Master)',
  MOM: '엄마 (Parent)',
  CHILD: '아이 (Child)',
  OBSERVER: '옵저버',
}

const INPUT_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'

export default function ProfilePage() {
  const { currentMember, logout } = useAuth()
  const { familyId, setCurrentMember } = useAuthStore()
  const location = useLocation()

  const [activePanel, setActivePanel] = useState<Panel>(() => {
    const p = (location.state as any)?.panel as Panel | undefined
    return (p && ['character', 'pet', 'gear', 'banner'].includes(p)) ? p : 'character'
  })
  const [saving,  setSaving] = useState(false)
  const [msg,     setMsg]    = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [newNickname, setNewNickname] = useState('')

  const isFirstRender = useRef(true)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (activePanel !== 'none') {
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150)
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

  const { setSkin: setInvSkin, setPet: setInvPet } = useInventoryStore()

  useEffect(() => {
    if (!currentMember) return
    setPreviewCharId(currentMember.character.characterId)
    setPreviewPetId(currentMember.character.petId)
    setPreviewBanner(currentMember.character.worldBanner)
  }, [currentMember?.id, currentMember?.character.worldBanner])

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
    setMsg('닉네임이 변경되었어요 ✅')
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
      if (!getUnlockedCharacters(role, level).includes(characterId)) {
        setMsg('아직 오픈되지 않은 캐릭터예요 🔒'); return
      }
    }
    setPreviewCharId(characterId)
    setInvSkin(characterId)
    setSaving(true)
    const error = await saveCharacter({ ...currentMember.character, characterId })
    setSaving(false)
    if (error) { setPreviewCharId(currentMember.character.characterId); setMsg('저장 실패: ' + error); return }
    setMsg('')
  }

  const handleSelectPet = async (petId: string) => {
    // petId='' → 선택 해제 (unlock 체크 건너뜀)
    if (petId !== '' && !isParent) {
      if (!getUnlockedPets(level).includes(petId)) { setMsg('아직 오픈되지 않은 펫이에요 🔒'); return }
    }
    setPreviewPetId(petId)
    setInvPet(petId)
    setSaving(true)
    const { error } = await updateMember(familyId, currentMember.id, { 'character.petId': petId } as any)
    setSaving(false)
    if (error) { setPreviewPetId(currentMember.character.petId); setMsg('저장 실패: ' + error); return }
    setCurrentMember({ ...currentMember, character: { ...currentMember.character, petId } })
    setMsg('')
  }

  const handleSelectBanner = async (bannerId: string) => {
    if (!isParent) {
      if (!getUnlockedBanners(level).includes(bannerId)) { setMsg('아직 오픈되지 않은 땅이에요 🔒'); return }
    }
    setPreviewBanner(bannerId)
    setSaving(true)
    const error = await saveCharacter({ ...currentMember.character, worldBanner: bannerId })
    setSaving(false)
    if (error) { setPreviewBanner(currentMember.character.worldBanner); setMsg('저장 실패: ' + error); return }
    setMsg('')
  }

  const ROLE_DEFAULT_CHAR: Record<string, string> = {
    DAD: 'base-dad', MOM: 'base-mom', CHILD: 'base-child-1', OBSERVER: 'base-observer',
  }
  const displayCharId = previewCharId || currentMember.character.characterId || ROLE_DEFAULT_CHAR[role]
  const displayPetId  = previewPetId  || currentMember.character.petId
  const displayBanner = previewBanner || currentMember.character.worldBanner
  const bannerInfo    = BANNER_UNLOCKS.find(b => b.id === displayBanner)

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* ── 캐릭터 프리뷰 카드 ───────────────────────────────────────── */}
      {/* 구조: 좌측 캐릭터 스프라이트(lg, 정적) + 우측 정보 */}
      {/* 패딩: top 22px(투구 오버플로), left 10px(방패 오버플로), bottom/right 10px(펫 오버플로) */}
      <div className="card-pixel flex items-start gap-3 overflow-visible"
        style={{ padding: '8px 12px 8px 12px' }}>

        {/* 캐릭터 — 오버플로 허용 wrapper (투구·방패·펫 겹침 보장) */}
        <div style={{ flexShrink: 0, paddingTop: 22, paddingLeft: 8, paddingBottom: 12, paddingRight: 8 }}>
          <CharacterSprite
            characterId={displayCharId}
            role={role}
            size="lg"
            animate="none"
            weapon={null}
            petId={displayPetId}
            worldBanner={displayBanner}
            petAnimate={false}
            gearWeapon={currentMember.character.equipment?.[0] || null}
            gearHelmet={currentMember.character.equipment?.[1] || null}
            gearShield={currentMember.character.equipment?.[2] || null}
            gearArmor={currentMember.character.equipment?.[3] || null}
          />
        </div>

        {/* 정보 영역 */}
        <div className="flex-1 min-w-0 pt-2">
          {/* 닉네임 */}
          {editingNickname ? (
            <div className="flex gap-1 mb-1.5 flex-wrap">
              <input
                value={newNickname}
                onChange={e => setNewNickname(e.target.value)}
                maxLength={10}
                autoFocus
                className="flex-1 input-pixel font-korean text-sm text-gold min-h-[36px] px-2 py-1 focus:outline-none focus:border-gold min-w-0"
              />
              <PixelButton size="sm" variant="gold" onClick={handleNicknameSave}>저장</PixelButton>
              <PixelButton size="sm" variant="ghost" onClick={() => setEditingNickname(false)}>취소</PixelButton>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="font-korean text-base font-bold text-gold truncate">
                {currentMember.name}
                {currentMember.realName && currentMember.realName !== currentMember.name && (
                  <span className="text-cream/70 font-normal text-sm ml-1">({currentMember.realName})</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => { setEditingNickname(true); setNewNickname(currentMember.name) }}
                className="font-korean text-xs text-cream/50 underline flex-shrink-0"
              >수정</button>
            </div>
          )}

          {/* 역할 + Lv */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-korean text-xs text-cream/70">{ROLE_LABELS[role]}</span>
            <span className="font-pixel text-xs text-gold">Lv.{level}</span>
          </div>

          {/* 내 땅 */}
          {bannerInfo && (
            <p className="font-korean text-xs text-gold/80 mb-0.5">
              {bannerInfo.emoji} {bannerInfo.label}
            </p>
          )}

          {/* EXP바 (아이) */}
          {role === 'CHILD' && <ExpBar exp={exp} level={level} className="mt-1" />}

          {/* 메시지 */}
          {msg && <p className="font-korean text-xs text-approved mt-1">{msg}</p>}
        </div>
      </div>

      {/* ── PIN 변경 ────────────────────────────────────────────── */}
      <div className="card-pixel p-3">
        <div className="flex items-center justify-between">
          <p className="t-sub font-bold text-gold flex items-center gap-1.5">
            <img src="/assets/icons/save.svg" width={16} height={16} style={{ imageRendering: 'pixelated' }} />
            PIN 번호 변경
          </p>
          <PixelButton size="sm" variant="ghost"
            onClick={() => { setPinPanel(p => !p); setPinMsg('') }}>
            {pinPanel ? '닫기' : '변경하기'}
          </PixelButton>
        </div>
        {pinPanel && (
          <div className="space-y-2 mt-2">
            {(['현재 PIN', '새 PIN', '새 PIN 확인'] as const).map((label, i) => {
              const val    = [pinCurrent, pinNew, pinConfirm][i]
              const setter = [setPinCurrent, setPinNew, setPinConfirm][i]
              return (
                <input key={label} type="password" value={val}
                  onChange={e => setter(e.target.value.slice(0, 8))}
                  placeholder={label} className={INPUT_CLS} />
              )
            })}
            {pinMsg && (
              <p className={`font-korean text-sm font-bold ${pinMsg.includes('✅') ? 'text-approved' : 'text-rejected'}`}>
                {pinMsg}
              </p>
            )}
            <PixelButton variant="purple" size="md" fullWidth
              disabled={pinSaving || !pinCurrent || !pinNew || !pinConfirm}
              onClick={handlePinChange}>
              {pinSaving ? '변경 중...' : 'PIN 변경'}
            </PixelButton>
          </div>
        )}
      </div>

      {/* ── 탭 버튼 (4열 컴팩트 — 원래 스타일) ─────────────────── */}
      <div ref={panelRef} className="grid grid-cols-4 gap-1.5">
        {([
          { key: 'character' as const, label: '캐릭터' },
          { key: 'pet'       as const, label: '마이 펫' },
          { key: 'gear'      as const, label: '장비' },
          { key: 'banner'    as const, label: '내 땅' },
        ]).map(({ key, label }) => (
          <PixelButton key={key}
            variant={activePanel === key ? 'purple' : 'ghost'}
            size="md"
            disabled={saving}
            onClick={() => setActivePanel(activePanel === key ? 'none' : key)}>
            {label}
          </PixelButton>
        ))}
      </div>

      {/* ── 캐릭터 인벤토리 ─────────────────────────────────────── */}
      {activePanel === 'character' && (
        <div className="card-pixel p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="t-sub font-bold text-gold">캐릭터 선택</p>
            {isParent
              ? <p className="t-micro text-approved">✅ 전부 자유 선택!</p>
              : <p className="t-micro text-panel-sub">🔒 레벨 달성 시 오픈!</p>}
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
            <p className="t-sub font-bold text-gold">마이 펫 선택</p>
            <p className="t-micro text-panel-sub">레벨이 높을수록 강한 펫 오픈!</p>
          </div>
          <InventoryGrid
            slots={PET_UNLOCKS.map(p => ({ id: p.id, requiredLevel: isParent ? 1 : p.requiredLevel, emoji: p.emoji, label: p.label }))}
            unlockedIds={isParent ? PET_UNLOCKS.map(p => p.id) : unlockedPets}
            selectedId={displayPetId}
            onSelect={handleSelectPet}
            currentLevel={level}
            columns={5}
            allowDeselect={true}
          />
        </div>
      )}

      {/* ── 장비 ─────────────────────────────────────────────────── */}
      {activePanel === 'gear' && (
        <div className="card-pixel p-3 space-y-4">
          <p className="t-sub font-bold text-gold">⚔️ 장비 선택
            <span className="font-korean text-xs text-panel-sub font-normal ml-1">— 각 슬롯 독립 선택</span>
          </p>
          {([
            { label: '🗡️ 무기',  items: WEAPON_ITEMS, slot: 0, type: 'weapon' as const },
            { label: '🪖 투구',  items: HELMET_ITEMS, slot: 1, type: 'helmet' as const },
            { label: '🛡️ 방패', items: SHIELD_ITEMS, slot: 2, type: 'shield' as const },
            { label: '🧥 갑옷',  items: ARMOR_ITEMS,  slot: 3, type: 'armor'  as const },
          ]).map(({ label, items, slot, type }) => (
            <div key={type}>
              <p className="font-korean text-xs font-bold text-cream/80 mb-2">{label}</p>
              <InventoryGrid
                slots={items.map(i => ({ id: i.id, requiredLevel: isParent ? 1 : i.requiredLevel, emoji: i.emoji, label: i.label, svgPath: i.svgPath }))}
                unlockedIds={getUnlockedGear(type, level, isParent)}
                selectedId={currentMember.character.equipment?.[slot] ?? ''}
                onSelect={async (id) => {
                  const eq = [...(currentMember.character.equipment ?? [])]
                  eq[slot] = id  // '' = 선택 해제
                  setSaving(true)
                  await saveCharacter({ ...currentMember.character, equipment: eq })
                  setSaving(false)
                  setMsg('')
                }}
                currentLevel={level}
                columns={5}
                allowDeselect={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── 내 땅 ───────────────────────────────────────────────── */}
      {activePanel === 'banner' && (
        <div className="card-pixel p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="t-sub font-bold text-gold">내 땅 선택</p>
            <p className="t-micro text-panel-sub">선택 즉시 위 프리뷰 적용!</p>
          </div>
          <InventoryGrid
            slots={BANNER_UNLOCKS.map(b => ({ id: b.id, requiredLevel: isParent ? 1 : b.requiredLevel, emoji: b.emoji, label: b.label }))}
            unlockedIds={isParent ? BANNER_UNLOCKS.map(b => b.id) : unlockedBanners}
            selectedId={displayBanner}
            onSelect={handleSelectBanner}
            currentLevel={level}
            columns={5}
          />
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
