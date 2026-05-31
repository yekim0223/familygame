// Design Ref: §5.3 SCR-02 LoginPage
// 로그인 흐름: landing → characters (기존 기기) | landing → family-id-input → characters (신규 기기)
// 신규 기기: 가족 ID 입력 → 캐릭터 선택 → PIN
// 기존 기기: 바로 캐릭터 선택 → PIN
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

// ── 상수 ────────────────────────────────────────────────────────
const LS_MEMBER_CACHE = 'fq_member_cache'
const LS_LAST_LOGIN   = 'fq_last_login'
const MASTER_ID   = 'kye'
const MASTER_PW   = '1111'
const MASTER_LOGIN_ID = 'kye'

// ── 타입 ────────────────────────────────────────────────────────
type View = 'landing' | 'family-id-input' | 'characters'

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

  // ── 비밀코드 입력 → family_codes 조회 → Firestore 검증 ────────
  const handleFidSubmit = async () => {
    const code = fidInput.trim()
    if (!code) { setFidError('비밀코드를 입력해줘요'); return }

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
        setView('characters')
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
    setSelected(member); setPin(''); setPinError('')
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
  // VIEW 1: LANDING — 대형 타이틀
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

        {/* 버전 */}
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
          <button type="button" onClick={() => navigate('/observer-login')}
            className="font-pixel text-cream/90 text-xs underline underline-offset-2 hover:text-cream whitespace-nowrap">
            GUEST
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
              <input
                type="text"
                value={masterId}
                onChange={e => setMasterId(e.target.value)}
                placeholder="ID"
                className="input-pixel mb-2"
              />
              <input
                type="password"
                value={masterPw}
                onChange={e => setMasterPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMasterLogin()}
                placeholder="Password"
                className="input-pixel mb-2"
              />
              {masterError && <p className="font-korean text-sm text-rejected mb-2">{masterError}</p>}
              <PixelButton variant="gold" fullWidth size="sm" onClick={handleMasterLogin}>접속</PixelButton>
            </PixelCard>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 2: FAMILY ID INPUT — 가족 ID 입력 (신규 기기)
  // ════════════════════════════════════════════════════════════════
  if (view === 'family-id-input') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-panel-darkest">
        <div className="w-full max-w-xs">

          {/* 헤더 */}
          <div className="text-center mb-8">
            <p className="font-pixel text-gold text-xs tracking-widest mb-2">FAMILY QUEST</p>
            <p className="font-korean text-cream text-base font-bold">🔑 로그인</p>
            <p className="font-korean text-cream/80 text-sm mt-2 leading-relaxed">
              개인 ID를 입력해주세요
            </p>
          </div>

          <PixelCard padding="sm" className="mb-4">
            <p className="font-korean text-sm font-bold text-gold mb-3">ID 입력</p>

            <input
              type="text"
              value={fidInput}
              onChange={e => { setFidInput(e.target.value); setFidError('') }}
              onKeyDown={e => e.key === 'Enter' && !verifying && handleFidSubmit()}
              placeholder="개인 ID 입력"
              className="input-pixel mb-2"
              autoFocus
            />

            {fidError && (
              <p className="font-korean text-xs text-rejected font-bold mb-2">{fidError}</p>
            )}

            {verifying && (
              <p className="font-korean text-xs text-sky text-center mb-2 animate-pulse">
                가족 데이터 확인 중...
              </p>
            )}

            <PixelButton
              variant="gold"
              fullWidth
              size="lg"
              disabled={verifying || !fidInput.trim()}
              onClick={handleFidSubmit}
            >
              {verifying ? '확인 중...' : '🔍 입장하기'}
            </PixelButton>
          </PixelCard>

          {/* 신규 가입 안내 */}
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
  // VIEW 3: CHARACTERS — 캐릭터 선택 + PIN 입력
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col bg-panel-darkest">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <button type="button"
          onClick={() => { setView(familyId ? 'landing' : 'family-id-input'); setSelected(null); setPin('') }}
          className="flex items-center gap-1 px-3 py-1.5 bg-panel-dark border-2 border-panel-border
                     font-korean text-cream text-sm font-bold hover:border-gold transition-all active:scale-95">
          ← 뒤로
        </button>
        <div className="text-center">
          <p className="font-pixel text-gold text-xs">FAMILY QUEST</p>
          <p className="font-korean text-cream text-sm font-semibold">
            {selected ? `${selected.name}, PIN 입력` : '누가 오셨나요?'}
          </p>
        </div>
        <div className="w-12" />
      </div>

      <div className="px-4 flex-1">

        {/* 로딩 */}
        {membersLoading && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="font-korean text-cream/80 text-sm animate-pulse">구성원 불러오는 중...</p>
            <p className="font-korean text-cream/60 text-xs">최대 5초 소요</p>
          </div>
        )}

        {/* 실패 / 빈 상태 */}
        {!membersLoading && (membersLoadFailed || members.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <p className="font-korean text-cream/80 text-sm">
              구성원을 불러올 수 없어요.<br/>
              가족 ID가 올바른지 확인해주세요.
            </p>
            <PixelButton variant="ghost" size="sm" onClick={() => setView('family-id-input')}>
              가족 ID 다시 입력
            </PixelButton>
            {membersLoadFailed && (
              <button type="button"
                onClick={() => { setMembersLoading(true); setMembersLoadFailed(false) }}
                className="font-korean text-cream/70 text-xs underline">
                다시 불러오기
              </button>
            )}
          </div>
        )}

        {/* 캐릭터 그리드 */}
        {!membersLoading && members.length > 0 && (
          <div className={`grid gap-3 py-4 ${
            members.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' : 'grid-cols-2'
          }`}>
            {members.map(member => {
              const isSelected = selected?.id === member.id
              const isLast     = member.id === lastMemberId && !isSelected
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectMember(member)}
                  className={[
                    'flex flex-col items-center gap-2 py-5 px-2',
                    'border-4 transition-all duration-150',
                    'hover:scale-[1.05] active:scale-95',
                    isSelected
                      ? 'bg-gold/20 border-gold scale-[1.03] shadow-pixel'
                      : 'bg-panel-dark border-panel-border hover:border-gold hover:bg-gold/10',
                  ].join(' ')}
                >
                  <CharacterSprite
                    characterId={member.character.characterId}
                    role={member.role}
                    size="lg"
                    variant="job"
                  />
                  <div className="text-center">
                    <p className="font-korean text-cream text-sm font-bold leading-tight">
                      {member.name}
                    </p>
                    {member.realName && member.realName !== member.name && (
                      <p className="font-korean text-cream/80 text-xs">({member.realName})</p>
                    )}
                    {member.role === 'CHILD' && (
                      <p className="font-pixel text-xs text-gold/70 mt-0.5">Lv.{member.level}</p>
                    )}
                    {isLast && (
                      <p className="font-korean text-xs text-gold mt-0.5">마지막 접속</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* PIN 입력 패널 */}
        {selected && (
          <div className="mt-1 animate-fade-slide-up">
            <div className="card-pixel p-4">
              <div className="flex items-center gap-3 mb-3">
                <CharacterSprite
                  characterId={selected.character.characterId}
                  role={selected.role}
                  size="sm"
                  variant="job"
                />
                <div>
                  <p className="font-korean text-sm font-bold text-cream leading-tight">
                    {selected.name}
                    {selected.realName && selected.realName !== selected.name && (
                      <span className="font-normal text-panel-sub text-xs ml-1">({selected.realName})</span>
                    )}
                  </p>
                  <p className="font-korean text-xs text-panel-sub">PIN 번호를 입력해주세요</p>
                </div>
              </div>

              {/* PIN 도트 표시 */}
              <div className="flex gap-2 justify-center mb-3">
                {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 border-2 border-panel-border
                    ${i < pin.length ? 'bg-gold' : 'bg-panel-darkest'}`} />
                ))}
              </div>

              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value.slice(0, 8)); setPinError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="PIN (숫자 또는 영문, 2~8자)"
                maxLength={8}
                className="input-pixel text-center mb-2 tracking-widest"
                autoFocus
              />

              {pinError && (
                <p className="font-korean text-xs text-rejected font-bold text-center mb-2">
                  {pinError}
                </p>
              )}

              <div className="flex gap-2">
                <PixelButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => { setSelected(null); setPin('') }}
                >
                  취소
                </PixelButton>
                <PixelButton
                  variant="gold"
                  size="lg"
                  className="flex-[2]"
                  disabled={loading || pin.length < 2}
                  onClick={handleLogin}
                >
                  {loading ? '확인 중...' : '입장 (Enter)'}
                </PixelButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
