// Design Ref: §5.3 SCR-02 LoginPage
// 로그인 흐름: landing → characters (프로필 선택형)
// 기존 기기: 캐릭터 카드 선택 → 숫자패드 PIN → /home
// 신규 기기: landing → family-id-input → 캐릭터 선택 → PIN
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { login } from '@/application/use-cases/auth/login'
import { startAnonymousSession } from '@/infrastructure/firebase/auth'
import { fsGet } from '@/infrastructure/firebase/firestore'
import { findFamilyByCode } from '@/infrastructure/firebase/collections/familyCodes'
import { getMember } from '@/infrastructure/firebase/collections/members'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import type { Member, Role } from '@/domain/entities/Member'
import type { CharacterInfo } from '@/domain/entities/Member'
import { APP_VERSION_SHORT } from '@/config/version'
import { audioManager } from '@/infrastructure/audio/audioManager'

// ── 상수 ────────────────────────────────────────────────────────
const LS_MEMBER_CACHE = 'fq_member_cache'
const LS_LAST_LOGIN   = 'fq_last_login'
const MASTER_ID       = 'kye'
const MASTER_PW       = '1111'
const MASTER_LOGIN_ID = 'kye'

// ── 타입 ────────────────────────────────────────────────────────
type View = 'landing' | 'family-id-input' | 'characters' | 'pin-entry'

interface CachedMember {
  id: string; name: string; realName: string
  role: Role; character: CharacterInfo; level: number; isActive: boolean
}

// ── 로컬 캐시 헬퍼 ───────────────────────────────────────────────
function readMemberCache(familyId: string): CachedMember[] {
  try {
    const raw = localStorage.getItem(LS_MEMBER_CACHE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (parsed.familyId !== familyId) return []
    return (parsed.members as CachedMember[]).filter(m => m.isActive)
  } catch { return [] }
}

function writeMemberCache(familyId: string, members: Member[]) {
  const cache: CachedMember[] = members.filter(m => m.isActive).map(m => ({
    id: m.id, name: m.name, realName: m.realName,
    role: m.role, character: m.character, level: m.level, isActive: m.isActive,
  }))
  localStorage.setItem(LS_MEMBER_CACHE, JSON.stringify({ familyId, members: cache }))
}

// ── 숫자 키패드 컴포넌트 ────────────────────────────────────────
function NumPad({ onKey }: { onKey: (k: string) => void }) {
  const KEYS = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['⌫','0','✓'],
  ]
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mx-auto">
      {KEYS.flat().map(k => (
        <button
          key={k}
          type="button"
          onPointerDown={e => { e.preventDefault(); onKey(k) }}
          className={[
            'h-14 border-4 font-pixel text-base leading-none',
            'active:scale-95 transition-transform duration-75',
            'shadow-[inset_2px_2px_0px_#ffffff30,inset_-2px_-2px_0px_#00000060]',
            k === '✓'
              ? 'bg-gold/80 border-gold text-pixel-dark'
              : k === '⌫'
              ? 'bg-panel-mid border-panel-border text-cream'
              : 'bg-panel-dark border-panel-border text-cream hover:border-gold/60',
          ].join(' ')}
        >
          {k}
        </button>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const navigate = useNavigate()
  const { setCurrentMember, setFamilyId, isPinLocked,
          incrementPinFail, resetPinFail, pinLockedUntil } = useAuthStore()

  const [familyId, setFamilyIdLocal] = useState(localStorage.getItem('familyId') ?? '')
  const lastMemberId = localStorage.getItem(LS_LAST_LOGIN) ?? ''

  const [view, setView] = useState<View>('landing')

  const cachedRef = useRef(familyId ? readMemberCache(familyId) : [])
  const [members, setMembers]                   = useState<CachedMember[]>(cachedRef.current)
  const [membersLoading, setMembersLoading]     = useState(false)
  const [membersLoadFailed, setMembersLoadFailed] = useState(false)

  const [selected, setSelected] = useState<CachedMember | null>(null)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState('')
  const [loading, setLoading]   = useState(false)
  const [lockRemaining, setLockRemaining] = useState(0)

  const [fidInput, setFidInput]         = useState('')
  const [fidError, setFidError]         = useState('')
  const [verifying, setVerifying]       = useState(false)
  const [autoDetecting, setAutoDetecting] = useState(false)

  const [showMasterPanel, setShowMasterPanel] = useState(false)
  const [masterId, setMasterId] = useState('')
  const [masterPw, setMasterPw] = useState('')
  const [masterError, setMasterError] = useState('')

  // ── 비밀코드 입력 → 개인ID/가족코드 조회 → Firestore 검증 ───────
  const handleFidSubmit = async () => {
    const code = fidInput.trim()
    if (!code) { setFidError('개인 ID 또는 가족코드를 입력해줘요'); return }
    setVerifying(true)
    setFidError('')

    const { uid } = await startAnonymousSession()
    if (!uid) {
      setFidError('Firebase 연결에 실패했어요. 인터넷을 확인해줘요')
      setVerifying(false)
      return
    }

    const { data: loginIdDoc } = await fsGet<{ familyId: string; memberId: string }>(
      `member_login_ids/${code.toLowerCase()}`
    )
    if (loginIdDoc?.familyId && loginIdDoc?.memberId) {
      const { data: memberData } = await getMember(loginIdDoc.familyId, loginIdDoc.memberId)
      if (memberData) {
        const cached: CachedMember = {
          id: memberData.id, name: memberData.name, realName: memberData.realName,
          role: memberData.role, character: memberData.character,
          level: memberData.level, isActive: memberData.isActive,
        }
        localStorage.setItem('familyId', loginIdDoc.familyId)
        setFamilyIdLocal(loginIdDoc.familyId)
        setMembers([cached])
        setSelected(cached)
        setVerifying(false)
        setFidError('')
        setView('pin-entry')
        return
      }
    }

    const { familyId: foundId, error: codeErr } = await findFamilyByCode(code)
    if (codeErr) { setFidError(codeErr); setVerifying(false); return }

    if (!foundId) {
      const { data } = await fsGet<{ familyCodeHash?: string }>(`families/${code}/config/settings`)
      if (!data) {
        setFidError('ID 또는 가족 코드를 찾을 수 없어요 🔍')
        setVerifying(false)
        return
      }
      localStorage.setItem('familyId', code)
      setFamilyIdLocal(code)
    } else {
      localStorage.setItem('familyId', foundId)
      setFamilyIdLocal(foundId)
    }

    setVerifying(false)
    setFidError('')
    setMembersLoading(true)
    setView('characters')
  }

  // ── Firestore 구독 (characters 뷰 진입 시) ────────────────────
  useEffect(() => {
    if (view !== 'characters' || !familyId) return
    const hasCache = cachedRef.current.length > 0
    let firstLoad  = !hasCache

    const onData = (data: Member[]) => {
      writeMemberCache(familyId, data)
      const mapped: CachedMember[] = data.filter(m => m.isActive).map(m => ({
        id: m.id, name: m.name, realName: m.realName,
        role: m.role, character: m.character, level: m.level, isActive: m.isActive,
      }))
      setMembers(mapped)
      if (firstLoad) {
        firstLoad = false
        setMembersLoading(false)
        setMembersLoadFailed(false)
        const last = mapped.find(m => m.id === lastMemberId) ?? null
        if (last && !selected) setSelected(last)
      }
    }

    const onError = () => {
      if (firstLoad) { firstLoad = false; setMembersLoading(false); setMembersLoadFailed(true) }
    }

    const timer = !hasCache ? setTimeout(onError, 5000) : undefined
    let unsubRef: (() => void) | null = null
    let cancelled = false

    startAnonymousSession().then(() => {
      if (!cancelled) unsubRef = subscribeMembers(familyId, onData, onError)
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      unsubRef?.()
    }
  }, [view, familyId])

  // ── PIN 잠금 카운트다운 ──────────────────────────────────────
  useEffect(() => {
    if (!pinLockedUntil) return
    const interval = setInterval(() => {
      const remain = Math.ceil((pinLockedUntil - Date.now()) / 1000)
      if (remain <= 0) { clearInterval(interval); setLockRemaining(0) }
      else setLockRemaining(remain)
    }, 1000)
    return () => clearInterval(interval)
  }, [pinLockedUntil])

  const handleSelectMember = (member: CachedMember) => {
    audioManager.resume()
    audioManager.keyClick()
    setSelected(member); setPin(''); setPinError('')
    setView('pin-entry')
  }

  // ── 숫자 키패드 처리 ─────────────────────────────────────────
  const handleNumKey = (k: string) => {
    audioManager.resume()
    if (k === '⌫') {
      audioManager.keyClick()
      setPin(p => p.slice(0, -1))
      setPinError('')
    } else if (k === '✓') {
      handleLogin()
    } else {
      audioManager.keyClick()
      setPin(p => (p.length < 8 ? p + k : p))
      setPinError('')
    }
  }

  // ── PIN 로그인 ───────────────────────────────────────────────
  const handleLogin = async () => {
    if (!selected || !familyId) return
    if (isPinLocked()) { setPinError(`잠시 기다려줘요. (${lockRemaining}초)`); return }
    setLoading(true); setPinError('')
    const { success, member, error: loginErr } = await login(familyId, selected.id, pin)
    setLoading(false)
    if (!success || !member) {
      incrementPinFail()
      setPinError(loginErr ?? 'PIN이 맞지 않아요')
      setPin('')
      return
    }
    resetPinFail()
    audioManager.loginFanfare()
    audioManager.startAfterLogin()
    localStorage.setItem('familyId', familyId)
    localStorage.setItem(LS_LAST_LOGIN, member.id)
    localStorage.setItem('fq_login_at', Date.now().toString())
    setCurrentMember(member)
    setFamilyId(familyId)
    navigate('/home')
  }

  const handleMasterLogin = () => {
    setMasterError('')
    if (masterId.trim() !== MASTER_ID || masterPw.trim() !== MASTER_PW) {
      setMasterError('마스터 ID 또는 비밀번호가 맞지 않아요'); return
    }
    navigate('/master')
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 1: LANDING
  // ════════════════════════════════════════════════════════════════
  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-panel-darkest">

        {/* ── 2D 블록 애니메이션 로고 ── */}
        <div style={{
          display: 'inline-block',
          animation: 'logoFloat 2.6s ease-in-out infinite',
          willChange: 'transform',
          marginBottom: '16px',
        }}>
          <div style={{
            position: 'relative', overflow: 'hidden',
            border: '5px solid #FFD700', padding: '18px 36px',
            animation: 'borderGlow 2s ease-in-out infinite',
            willChange: 'box-shadow',
          }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(112deg, transparent 25%, rgba(255,255,255,0.16) 50%, transparent 75%)',
              animation: 'logoGloss 3.2s ease-in-out infinite',
              willChange: 'transform',
            }} />
            {[{top:5,left:5},{top:5,right:5},{bottom:5,left:5},{bottom:5,right:5}].map((pos,i)=>(
              <div key={i} style={{ position:'absolute', width:7, height:7, background:'#FFD700', opacity:0.9, ...pos }} />
            ))}
            <div style={{ display:'flex', justifyContent:'center', gap:'3px', marginBottom:'6px' }}>
              {'FAMILY'.split('').map((ch,i) => (
                <span key={i} style={{
                  fontFamily:'"Press Start 2P",cursive', fontSize:'clamp(1.55rem,8vw,2.3rem)',
                  color:'#FFD700', textShadow:'0 0 14px #FFD700, 3px 3px 0 #7B5000',
                  display:'inline-block', lineHeight:1.15,
                  animation:'letterWave 1.8s ease-in-out infinite',
                  animationDelay:`${i*0.11}s`, willChange:'transform',
                }}>{ch}</span>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:'3px' }}>
              {'QUEST'.split('').map((ch,i) => (
                <span key={i} style={{
                  fontFamily:'"Press Start 2P",cursive', fontSize:'clamp(1.55rem,8vw,2.3rem)',
                  color:'#FFD700', textShadow:'0 0 14px #FFD700, 3px 3px 0 #7B5000',
                  display:'inline-block', lineHeight:1.15,
                  animation:'letterWave 1.8s ease-in-out infinite',
                  animationDelay:`${(i+6)*0.11}s`, willChange:'transform',
                }}>{ch}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="font-pixel text-cream/60 text-center mb-10 text-xs">{APP_VERSION_SHORT}</p>

        {/* FAMILY LOGIN 버튼 */}
        <div className="w-full max-w-xs">
          <PixelButton
            variant="gold"
            fontMode="pixel"
            fullWidth
            size="lg"
            disabled={autoDetecting}
            onClick={async () => {
              audioManager.resume()
              audioManager.loginIntro()
              setAutoDetecting(true)
              await startAnonymousSession()
              const { data: loginIdDoc } = await fsGet<{ familyId: string; memberId: string }>(
                `member_login_ids/${MASTER_LOGIN_ID}`
              )
              const resolvedFamilyId = loginIdDoc?.familyId || familyId

              if (resolvedFamilyId) {
                localStorage.setItem('familyId', resolvedFamilyId)
                setFamilyIdLocal(resolvedFamilyId)
                const cache = readMemberCache(resolvedFamilyId)
                cachedRef.current = cache
                setMembers(cache)
                setSelected(cache.find(m => m.id === lastMemberId) ?? null)
                setAutoDetecting(false)
                setMembersLoading(cache.length === 0)
                setView('characters')
              } else {
                setAutoDetecting(false)
                setView('family-id-input')
              }
            }}
          >
            {autoDetecting ? 'CONNECTING...' : 'FAMILY LOGIN'}
          </PixelButton>
        </div>

        {/* 하단 링크 */}
        <div className="flex items-center gap-2 mt-5">
          <button type="button" onClick={() => navigate('/register')}
            className="font-pixel text-cream/90 text-xs underline underline-offset-2 hover:text-cream whitespace-nowrap">
            VERIFY ACCOUNT
          </button>
          <span className="text-cream/30 text-xs">|</span>
          <button type="button" onClick={() => setShowMasterPanel(p => !p)}
            className="font-pixel text-cream/80 text-xs underline underline-offset-2 hover:text-cream whitespace-nowrap">
            SETTING
          </button>
        </div>

        {showMasterPanel && (
          <div className="w-full max-w-xs mt-3">
            <PixelCard padding="sm" className="animate-fade-slide-up">
              <p className="font-pixel text-xs text-gold mb-3">아빠 작업방 (Master)</p>
              <input type="text" value={masterId} onChange={e => setMasterId(e.target.value)}
                placeholder="ID" className="input-pixel mb-2" />
              <input type="password" value={masterPw} onChange={e => setMasterPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMasterLogin()}
                placeholder="Password" className="input-pixel mb-2" />
              {masterError && <p className="font-korean text-sm text-rejected mb-2">{masterError}</p>}
              <PixelButton variant="gold" fullWidth size="sm" onClick={handleMasterLogin}>접속</PixelButton>
            </PixelCard>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 2: FAMILY ID INPUT — 신규 기기 (ID 직접 입력)
  // ════════════════════════════════════════════════════════════════
  if (view === 'family-id-input') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-panel-darkest">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <p className="font-pixel text-gold text-xs tracking-widest mb-2">FAMILY QUEST</p>
            <p className="font-korean text-cream text-base font-bold">🔑 새 기기 등록</p>
            <p className="font-korean text-cream/80 text-sm mt-2 leading-relaxed">
              아빠가 알려준 개인 ID를 입력해요
            </p>
          </div>

          <PixelCard padding="sm" className="mb-4">
            <p className="font-korean text-sm font-bold text-gold mb-3">개인 ID 입력</p>
            <input
              type="text"
              value={fidInput}
              onChange={e => { setFidInput(e.target.value); setFidError('') }}
              onKeyDown={e => e.key === 'Enter' && !verifying && handleFidSubmit()}
              placeholder="개인 ID 입력"
              className="input-pixel mb-2"
              autoFocus
            />
            {fidError && <p className="font-korean text-xs text-rejected font-bold mb-2">{fidError}</p>}
            {verifying && (
              <p className="font-korean text-xs text-sky text-center mb-2 animate-pulse">
                가족 데이터 확인 중...
              </p>
            )}
            <PixelButton variant="gold" fullWidth size="lg"
              disabled={verifying || !fidInput.trim()} onClick={handleFidSubmit}>
              {verifying ? '확인 중...' : '🔍 입장하기'}
            </PixelButton>
          </PixelCard>

          <div className="bg-panel-dark border-2 border-panel-border px-3 py-3 mb-4">
            <p className="font-korean text-sm text-cream leading-relaxed">
              💡 <strong className="text-gold">처음 시작하나요?</strong><br/>
              아빠가 먼저 가입 후 ID를 공유해줘야 해요.
            </p>
            <button type="button" onClick={() => navigate('/register')}
              className="mt-2 font-korean text-xs text-gold underline hover:text-yellow-300">
              새 가족 만들기 →
            </button>
          </div>

          <PixelButton variant="ghost" fullWidth onClick={() => setView('landing')}>
            ← 뒤로
          </PixelButton>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 3: CHARACTERS — 프로필 선택 (대형 카드 그리드)
  // ════════════════════════════════════════════════════════════════
  if (view === 'characters') {
    return (
      <div className="min-h-screen flex flex-col bg-panel-darkest">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-gold/20">
          <button type="button"
            onClick={() => { setView('landing'); setSelected(null); setPin('') }}
            className="flex items-center gap-1 px-3 py-1.5 bg-panel-dark border-2 border-panel-border
                       font-korean text-cream text-sm font-bold hover:border-gold transition-all active:scale-95">
            ← 뒤로
          </button>
          <div className="text-center">
            <p className="font-pixel text-gold text-[10px]">FAMILY QUEST</p>
            <p className="font-korean text-cream text-sm font-semibold mt-0.5">누가 오셨나요? 👋</p>
          </div>
          <div className="w-14" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {/* 로딩 */}
          {membersLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-4xl animate-bounce">⚔️</p>
              <p className="font-korean text-cream/80 text-sm animate-pulse">구성원 불러오는 중...</p>
            </div>
          )}

          {/* 실패 */}
          {!membersLoading && (membersLoadFailed || members.length === 0) && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <p className="text-4xl">😢</p>
              <p className="font-korean text-cream/80 text-sm">
                구성원을 불러올 수 없어요.<br/>
                가족 ID가 올바른지 확인해주세요.
              </p>
              <PixelButton variant="ghost" size="sm" onClick={() => setView('family-id-input')}>
                가족 ID 다시 입력
              </PixelButton>
            </div>
          )}

          {/* 대형 프로필 카드 그리드 */}
          {!membersLoading && members.length > 0 && (
            <div className={`grid gap-4 ${
              members.length === 1 ? 'grid-cols-1 max-w-[220px] mx-auto' : 'grid-cols-2'
            }`}>
              {members.map(member => {
                const isLast = member.id === lastMemberId
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    className={[
                      'flex flex-col items-center gap-3 py-6 px-3',
                      'border-4 transition-all duration-150 relative',
                      'active:scale-95',
                      'bg-panel-dark border-panel-border hover:border-gold hover:bg-gold/10',
                      'shadow-[inset_2px_2px_0px_#ffffff15,inset_-2px_-2px_0px_#00000060]',
                    ].join(' ')}
                  >
                    {/* 마지막 접속 배지 */}
                    {isLast && (
                      <span className="absolute top-2 right-2 font-pixel text-xs text-gold
                                       bg-gold/10 border border-gold px-1 leading-none py-0.5">
                        ★
                      </span>
                    )}

                    {/* 캐릭터 스프라이트 — 내 땅 배경 + 펫 없음 */}
                    <div className="scale-125 mb-1">
                      <CharacterSprite
                        characterId={member.character.characterId}
                        role={member.role}
                        size="lg"
                        variant="job"
                        petId={null}
                        weapon={null}
                        worldBanner={member.character.worldBanner}
                      />
                    </div>

                    {/* 이름 */}
                    <div className="text-center">
                      <p className="font-korean text-cream text-base font-bold leading-tight">
                        {member.name}
                      </p>
                      {member.role === 'CHILD' && (
                        <p className="font-pixel text-xs text-gold/80 mt-1">Lv.{member.level}</p>
                      )}
                    </div>

                    {/* 탭 힌트 */}
                    <p className="font-korean text-xs text-gold/60 mt-1">탭해서 입장 →</p>
                  </button>
                )
              })}
            </div>
          )}

          {/* 새 기기 등록 링크 */}
          {!membersLoading && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setView('family-id-input')}
                className="font-korean text-xs text-panel-sub underline hover:text-cream/70">
                다른 기기로 오셨나요? → ID 입력
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 4: PIN-ENTRY — 숫자패드 PIN 입력 (프로필 포커스)
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col bg-panel-darkest">
      {/* 헤더 — 다른 캐릭터 선택 */}
      <div className="flex items-center px-4 pt-5 pb-3 border-b border-gold/20">
        <button type="button"
          onClick={() => {
            setSelected(null); setPin(''); setPinError('')
            setView(members.length > 0 ? 'characters' : 'landing')
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-panel-dark border-2 border-panel-border
                     font-korean text-cream text-sm font-bold hover:border-gold transition-all active:scale-95">
          ← 다른 캐릭터
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 gap-6">
        {selected && (
          <>
            {/* 선택된 캐릭터 프로필 — 크게 + 내 땅 배경 */}
            <div className="flex flex-col items-center gap-3">
              <div className="scale-150 mb-2">
                <CharacterSprite
                  characterId={selected.character.characterId}
                  role={selected.role}
                  size="lg"
                  variant="job"
                  petId={null}
                  weapon={null}
                  worldBanner={selected.character.worldBanner}
                />
              </div>
              <div className="text-center">
                <p className="font-korean text-cream text-xl font-bold t-pixel-shadow">
                  {selected.name}
                </p>
              </div>
            </div>

            {/* PIN 도트 표시 */}
            <div className="flex flex-col items-center gap-3">
              <p className="font-korean text-cream/70 text-sm">PIN 번호를 입력해요</p>
              <div className="flex gap-3 justify-center">
                {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                  <div key={i}
                    className={`w-5 h-5 border-2 transition-all duration-100
                      ${i < pin.length
                        ? 'bg-gold border-gold shadow-[0_0_8px_#FFD700]'
                        : 'bg-panel-darkest border-panel-border'}`}
                  />
                ))}
              </div>
              {pinError && (
                <p className="font-korean text-sm text-rejected font-bold animate-pulse">
                  {pinError}
                </p>
              )}
              {loading && (
                <p className="font-korean text-sm text-sky animate-pulse">확인 중...</p>
              )}
            </div>

            {/* 숫자 키패드 */}
            <NumPad onKey={handleNumKey} />

            {/* 키보드 입력 지원 (숨김 input) */}
            <input
              type="password"
              value={pin}
              onChange={e => { setPin(e.target.value.slice(0, 8)); setPinError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
          </>
        )}
      </div>
    </div>
  )
}
