// Design Ref: §5.3 SCR-19 ProfilePage — 캐릭터·반려동물·장비·세계관 배너 + 닉네임 수정
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { updateMember } from '@/infrastructure/firebase/collections/members'
import { hashPin } from '@/infrastructure/firebase/auth'
import {
  selectCharacter, selectPet, selectWorldBanner,
  getUnlockedCharacters, getUnlockedPets, getUnlockedBanners,
  ALL_CHARACTERS, BASE_CHARACTERS, LEVEL_CHARACTERS, CHARACTER_EMOJI, CHARACTER_LABELS,
  PET_UNLOCKS, BANNER_UNLOCKS, BANNER_BG,
} from '@/application/use-cases/characters/selectCharacter'
import { CharacterSprite, PetSprite } from '@/presentation/components/character/CharacterSprite'
import { InventoryGrid } from '@/presentation/components/character/InventoryGrid'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import { formatNameWithAge } from '@/domain/services/KoreanAge'
import { getLevelProgress } from '@/domain/services/ExpCalc'

type Panel = 'none' | 'character' | 'pet' | 'banner'

const ROLE_LABELS: Record<string, string> = {
  DAD: '아빠 (Master)',
  MOM: '엄마 (Parent)',
  CHILD: '딸 (Child)',
  OBSERVER: '옵저버',
}

// BANNER_BG는 selectCharacter.ts에서 import
const _BANNER_BG_UNUSED: Record<string, string> = {
  // 자연 (Lv 1-14)
  overworld:      'from-grass to-green-700',
  forest:         'from-green-800 to-lime-700',
  nether:         'from-red-800 to-orange-700',
  cave:           'from-gray-800 to-gray-600',
  ocean:          'from-blue-700 to-sky',
  swamp:          'from-green-900 to-teal-700',
  jungle:         'from-green-800 to-lime-500',
  savanna:        'from-yellow-700 to-amber-600',
  snow:           'from-blue-100 to-sky/50',
  desert:         'from-yellow-600 to-amber-500',
  volcano:        'from-red-900 to-orange-600',
  mushroom:       'from-red-700 to-rose-500',
  fortress:       'from-gray-700 to-stone',
  ruins:          'from-stone to-yellow-900',
  // 환상 (Lv 15-24)
  sky:            'from-sky to-blue-200',
  'floating-isle':'from-cyan-400 to-sky',
  'crystal-cave': 'from-blue-300 to-purple',
  aurora:         'from-indigo-800 to-green-400',
  'deep-sea':     'from-blue-900 to-blue-600',
  'storm-peak':   'from-gray-900 to-blue-800',
  'moon-base':    'from-gray-700 to-gray-400',
  'shadow-realm': 'from-gray-900 to-purple',
  'dragon-peak':  'from-red-900 to-yellow-700',
  'time-ruins':   'from-amber-800 to-purple',
  // 우주 초입 (Lv 25-34)
  'star-meadow':  'from-indigo-900 to-purple',
  'nebula-cave':  'from-purple to-pink-600',
  'comet-trail':  'from-blue-900 to-orange-700',
  'space-station':'from-gray-900 to-blue-700',
  'milky-way':    'from-indigo-900 to-blue-800',
  'asteroid-belt':'from-gray-800 to-stone',
  'black-hole':   'from-black to-gray-800',
  supernova:      'from-orange-500 to-red-700',
  pulsar:         'from-blue-800 to-purple',
  quasar:         'from-purple to-yellow-600',
  // 심우주 (Lv 35-44)
  wormhole:       'from-purple to-blue-900',
  'dark-matter':  'from-indigo-950 to-purple',
  antimatter:     'from-cyan-900 to-blue-900',
  'plasma-storm': 'from-orange-700 to-purple',
  'cosmic-void':  'from-gray-950 to-indigo-900',
  'galaxy-core':  'from-orange-600 to-yellow-500',
  'quantum-realm':'from-cyan-800 to-purple',
  'dimension-rift':'from-pink-700 to-purple',
  'time-stream':  'from-amber-700 to-indigo-800',
  'crystal-cosmos':'from-blue-300 to-purple',
  // 신계 (Lv 45-50)
  'divine-realm': 'from-yellow-200 to-white',
  'celestial-sea':'from-sky to-indigo-900',
  'void-throne':  'from-purple to-black',
  eternity:       'from-white to-purple',
  genesis:        'from-orange-300 to-yellow-100',
  godverse:       'from-indigo-900 to-purple',
}

export default function ProfilePage() {
  const { currentMember, logout } = useAuth()
  const { familyId, setCurrentMember } = useAuthStore()
  const location = useLocation()

  // 홈 카드에서 직접 이동 시 해당 패널 자동 오픈
  const [activePanel, setActivePanel] = useState<Panel>(() => {
    const p = (location.state as any)?.panel as Panel | undefined
    return (p && ['character', 'pet', 'banner'].includes(p)) ? p : 'none'
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [newNickname, setNewNickname] = useState('')

  // 패널 열린 후 해당 영역 자동 스크롤
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

  // 즉시 미리보기용 로컬 state — 클릭 즉시 반영 (Firestore 완료 전에도)
  const [previewCharId, setPreviewCharId] = useState('')
  const [previewPetId,  setPreviewPetId]  = useState('')
  const [previewBanner, setPreviewBanner] = useState('')

  // currentMember 로드 시 로컬 state 초기화
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
    // 현재 PIN 검증
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
  const { current: expCurrent, needed: expNeeded } = getLevelProgress(exp)

  const unlockedCharacters = getUnlockedCharacters(role, level)
  const unlockedPets = getUnlockedPets(level)
  const unlockedBanners = getUnlockedBanners(level)

  const isParent = role === 'DAD' || role === 'MOM'

  // 전체 캐릭터 슬롯 (50종)
  const allCharSlots = ALL_CHARACTERS[role]?.map(c => ({
    id: c.id,
    requiredLevel: isParent ? 1 : c.requiredLevel, // 부모는 전부 Lv.1
  })) ?? []

  // 공통: character 전체 객체 저장 → store 직접 업데이트 (re-fetch 캐시 지연 방지)
  const saveCharacter = async (newChar: typeof currentMember.character) => {
    const safeChar = {
      characterId: newChar.characterId || currentMember.character.characterId,
      petId:       newChar.petId       || currentMember.character.petId,
      equipment:   newChar.equipment   || [],
      worldBanner: newChar.worldBanner || currentMember.character.worldBanner,
    }

    const { error } = await updateMember(familyId, currentMember.id, {
      character: safeChar,
    } as any)
    if (error) return error

    // 저장 성공 시 store를 즉시 업데이트 (Firestore 캐시 stale 문제 우회)
    setCurrentMember({ ...currentMember, character: safeChar })
    return null
  }

  const handleSelectCharacter = async (characterId: string) => {
    // 잠금 체크
    if (!isParent) {
      const unlocked = getUnlockedCharacters(role, level)
      if (!unlocked.includes(characterId)) { setMsg('아직 오픈되지 않은 캐릭터예요 🔒'); return }
    }
    const newChar = { ...currentMember.character, characterId }
    setPreviewCharId(characterId)
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
    // saveCharacter 공유 함수 우회 — petId 필드만 직접 업데이트 (가장 단순한 경로)
    setPreviewPetId(petId)
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

  // 미리보기에는 로컬 state 사용 (즉시 반영)
  const displayCharId = previewCharId || currentMember.character.characterId
  const displayPetId  = previewPetId  || currentMember.character.petId
  const displayBanner = previewBanner || currentMember.character.worldBanner

  const currentBanner = BANNER_UNLOCKS.find(b => b.id === displayBanner)
  const bannerGradient = BANNER_BG[displayBanner] ?? 'from-grass to-green-700'

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* 배너 + 캐릭터 디스플레이 */}
      <div className={`rounded-sm bg-gradient-to-b ${bannerGradient} p-4 border-4 border-pixel-dark`}>
        <div className="flex items-end gap-3">
          {/* 메인 캐릭터 (크게) */}
          <div className="relative">
            <CharacterSprite
              characterId={displayCharId}
              role={role}
              size="xl"
              animate="bob"
            />
            {/* 반려동물 (우하단) */}
            <div className="absolute -bottom-1 -right-1">
              <PetSprite petId={displayPetId} size="sm" />
            </div>
          </div>

          {/* 이름·나이·역할·레벨 */}
          <div className="flex-1">
            {/* 닉네임 (실명) + 수정 버튼 */}
            {editingNickname ? (
              <div className="flex gap-1 mb-1">
                <input
                  value={newNickname}
                  onChange={e => setNewNickname(e.target.value)}
                  maxLength={10}
                  autoFocus
                  className="flex-1 bg-pixel-dark text-gold font-korean text-sm
                             border-2 border-gold px-2 py-1 focus:outline-none"
                />
                <button onClick={handleNicknameSave} className="font-korean text-xs text-gold underline">저장</button>
                <button onClick={() => setEditingNickname(false)} className="font-korean text-xs text-cream/60 underline">취소</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="font-korean text-sm font-bold text-cream">
                  {currentMember.name}
                  {currentMember.realName && currentMember.realName !== currentMember.name && (
                    <span className="text-cream/60 font-normal ml-1">({currentMember.realName})</span>
                  )}
                </p>
                <button
                  onClick={() => { setEditingNickname(true); setNewNickname(currentMember.name) }}
                  className="font-korean text-xs text-gold/70 underline"
                >
                  수정
                </button>
              </div>
            )}
            <p className="font-korean text-xs text-cream/80 mt-0.5">{ROLE_LABELS[role]}</p>
            {/* 자녀만 EXP 바 + 레벨 표시 */}
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

      {/* ── PIN 변경 패널 ── */}
      <div className="card-pixel p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-korean text-sm font-bold text-purple">🔒 PIN 번호 변경</p>
          <button type="button" onClick={() => { setPinPanel(p => !p); setPinMsg('') }}
            className="font-korean text-xs text-stone underline">
            {pinPanel ? '닫기' : '변경하기'}
          </button>
        </div>
        {pinPanel && (
          <div className="space-y-2">
            {(['현재 PIN', '새 PIN', '새 PIN 확인'] as const).map((label, i) => {
              const val     = [pinCurrent, pinNew, pinConfirm][i]
              const setter  = [setPinCurrent, setPinNew, setPinConfirm][i]
              return (
                <input key={label} type="password" value={val}
                  onChange={e => setter(e.target.value.slice(0, 8))}
                  placeholder={label}
                  className="w-full bg-pixel-dark text-gold font-korean text-sm
                             border-4 border-pixel-dark px-3 py-2
                             focus:outline-none focus:border-gold"
                />
              )
            })}
            {pinMsg && (
              <p className={`font-korean text-xs ${pinMsg.includes('✅') ? 'text-approved' : 'text-rejected'}`}>
                {pinMsg}
              </p>
            )}
            <button type="button" onClick={handlePinChange}
              disabled={pinSaving || !pinCurrent || !pinNew || !pinConfirm}
              className="w-full py-2.5 bg-purple border-4 border-pixel-dark font-korean text-sm font-bold
                         text-white hover:bg-purple/90 active:translate-y-0.5 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed">
              {pinSaving ? '변경 중...' : 'PIN 변경'}
            </button>
          </div>
        )}
      </div>

      {/* 변경 버튼들 — panelRef: 자동 스크롤 앵커 */}
      <div ref={panelRef} className="grid grid-cols-3 gap-2">
        {([
          { key: 'character', icon: '👾', label: '캐릭터' },
          { key: 'pet',       icon: '🐶', label: '마이 펫' },
          { key: 'banner',    icon: '🌌', label: '등급' },
        ] as const).map(({ key, icon, label }) => (
          <button key={key} type="button"
            onClick={() => setActivePanel(activePanel === key ? 'none' : key)}
            className={[
              'py-2 border-4 font-korean text-sm font-bold transition-all active:translate-y-0.5 shadow-pixel',
              activePanel === key
                ? 'bg-purple text-white border-purple'
                : 'bg-cream text-pixel-dark border-dirt hover:bg-yellow-50',
            ].join(' ')}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* 캐릭터 인벤토리 (50종, 5열) */}
      {activePanel === 'character' && (
        <PixelCard padding="sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-korean text-sm font-bold text-purple">캐릭터 선택 (50종)</p>
            {!isParent && <p className="font-korean text-[10px] text-stone">🔒 레벨 달성 시 오픈!</p>}
            {isParent  && <p className="font-korean text-[10px] text-approved">✅ 전부 자유 선택!</p>}
          </div>
          <InventoryGrid
            slots={allCharSlots}
            unlockedIds={unlockedCharacters}
            selectedId={displayCharId}
            onSelect={handleSelectCharacter}
            currentLevel={level}
            columns={5}
          />
        </PixelCard>
      )}

      {/* 마이 펫 선택 (50종, 5열) */}
      {activePanel === 'pet' && (
        <PixelCard padding="sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-korean text-sm font-bold text-purple">마이 펫 선택 (50종)</p>
            <p className="font-korean text-[10px] text-stone">레벨이 높을수록 강한 펫 오픈!</p>
          </div>
          <InventoryGrid
            slots={PET_UNLOCKS.map(p => ({ id: p.id, requiredLevel: isParent ? 1 : p.requiredLevel, emoji: p.emoji, label: p.label }))}
            unlockedIds={isParent ? PET_UNLOCKS.map(p => p.id) : unlockedPets}
            selectedId={displayPetId}
            onSelect={handleSelectPet}
            currentLevel={level}
            columns={5}
          />
        </PixelCard>
      )}

      {/* 세계관 배너 선택 (50종, 5열) */}
      {activePanel === 'banner' && (
        <PixelCard padding="sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-korean text-sm font-bold text-purple">배너 선택 (50종)</p>
            <p className="font-korean text-[10px] text-stone">레벨이 높을수록 신비한 배너 오픈!</p>
          </div>
          <InventoryGrid
            slots={BANNER_UNLOCKS.map(b => ({ id: b.id, requiredLevel: isParent ? 1 : b.requiredLevel, emoji: b.emoji, label: b.label }))}
            unlockedIds={isParent ? BANNER_UNLOCKS.map(b => b.id) : unlockedBanners}
            selectedId={displayBanner}
            onSelect={handleSelectBanner}
            currentLevel={level}
            columns={5}
          />
          <p className="font-korean text-[9px] text-stone mt-2 text-center">
            배너는 프로필 배경에 표시됩니다
          </p>
        </PixelCard>
      )}

      {/* 레벨 해금 로드맵 — 아이만 표시 */}
      {!isParent && <PixelCard padding="sm">
        <p className="font-korean text-sm font-bold text-purple mb-2">다음 해금 목록</p>
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
            <div key={item.label} className="flex items-center justify-between text-xs font-korean">
              <span className="text-pixel-dark">{item.label}</span>
              <span className="text-stone">Lv.{item.level}</span>
            </div>
          ))}
          {level >= 25 && <p className="font-korean text-xs text-approved text-center">모든 기본 캐릭터 해금 완료! 🎉</p>}
        </div>
      </PixelCard>}

      {/* 로그아웃 */}
      <div className="pt-2">
        <button type="button" onClick={logout}
          className="w-full py-2 bg-cream border-4 border-dirt font-korean text-sm
                     font-bold text-pixel-dark hover:bg-yellow-50 active:translate-y-0.5
                     transition-all shadow-pixel">
          로그아웃
        </button>
      </div>
    </div>
  )
}
