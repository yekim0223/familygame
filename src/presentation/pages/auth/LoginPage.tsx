// Design Ref: §5.3 SCR-02 LoginPage
// 로그인 흐름: landing → family-code → (family-id-input) → characters → PIN → /home
// 신규 기기: 초대코드 → 가족ID 입력(Firestore 검증) → 캐릭터 선택
// 기존 기기: 초대코드 → 캐릭터 선택 (familyId 캐시 있음)
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { login } from '@/application/use-cases/auth/login'
import { startAnonymousSession } from '@/infrastructure/firebase/auth'
import { fsGet } from '@/infrastructure/firebase/firestore'
import { findFamilyByCode } from '@/infrastructure/firebase/collections/familyCodes'
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
const MASTER_ID   = 'master'
const MASTER_PW   = '10040101'
const INVITE_CODE = 'family'   // 가족 초대 코드

// ── 타입 ────────────────────────────────────────────────────────
// landing → family-code → family-id-input (新기기) → characters
//                       ↘ characters (旧기기, familyId 있음)
type View = 'landing' | 'family-code' | 'family-id-input' | 'characters'

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

  // ── familyId (localStorage 우선) ────────────────────────────
  const [familyId, setFamilyIdLocal] = useState(localStorage.getItem('familyId') ?? '')
  const lastMemberId = localStorage.getItem(LS_LAST_LOGIN) ?? ''

  const [view, setView] = useState<View>('landing')

  // ── 멤버 관련 상태 ──────────────────────────────────────────
  const cachedRef = useRef(familyId ? readMemberCache(familyId) : [])
  const [members, setMembers]                   = useState<CachedMember[]>(cachedRef.current)
  const [membersLoading, setMembersLoading]     = useState(false)
  const [membersLoadFailed, setMembersLoadFailed] = useState(false)

  // ── 캐릭터 선택 / PIN ──────────────────────────────────────
  const [selected, setSelected] = useState<CachedMember | null>(null)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState('')
  const [loading, setLoading]   = useState(false)
  const [lockRemaining, setLockRemaining] = useState(0)

  // ── 초대코드 입력 ──────────────────────────────────────────
  const [inviteCode, setInviteCode]   = useState('')
  const [inviteError, setInviteError] = useState('')
  const [showCode, setShowCode]       = useState(false)

  // ── 가족 ID 입력 (신규 기기) ───────────────────────────────
  const [fidInput, setFidInput]         = useState('')
  const [fidError, setFidError]         = useState('')
  const [verifying, setVerifying]       = useState(false)

  // ── 마스터 패널 ─────────────────────────────────────────────
  const [showMasterPanel, setShowMasterPanel] = useState(false)
  const [masterId, setMasterId] = useState('')
  const [masterPw, setMasterPw] = useState('')
  const [masterError, setMasterError] = useState('')

  // ── 초대코드 확인 → 다음 단계 분기 ───────────────────────────
  const handleCodeSubmit = () => {
    if (inviteCode.trim().toLowerCase() !== INVITE_CODE) {
      setInviteError('초대 코드가 맞지 않아요 🔒')
      return
    }
    setInviteError('')
    if (familyId) {
      // 이미 familyId 있는 기기 → 바로 캐릭터 선택
      const cache = readMemberCache(familyId)
      cachedRef.current = cache
      setMembers(cache)
      setSelected(cache.find(m => m.id === lastMemberId) ?? null)
      setView('characters')
      if (cache.length === 0) setMembersLoading(true)
    } else {
      // 신규 기기 → 가족 ID 입력 단계
      setView('family-id-input')
    }
  }

  // ── 비밀코드 입력 → family_codes 조회 → Firestore 검증 ────────
  const handleFidSubmit = async () => {
    const code = fidInput.trim()
    if (!code) { setFidError('비밀코드를 입력해줘요'); return }

    setVerifying(true)
    setFidError('')

    // Firebase Auth 세션 확보
    const { uid } = await startAnonymousSession()
    if (!uid) {
      setFidError('Firebase 연결에 실패했어요. 인터넷을 확인해줘요')
      setVerifying(false)
      return
    }

    // 비밀코드로 familyId 조회
    const { familyId: foundId, error: codeErr } = await findFamilyByCode(code)
    if (codeErr) { setFidError(codeErr); setVerifying(false); return }

    if (!foundId) {
      // 직접 familyId 입력으로도 시도 (하위 호환)
      const { data } = await fsGet<{ familyCodeHash?: string }>(`families/${code}/config/settings`)
      if (!data) {
        setFidError('비밀코드를 찾을 수 없어요. 아빠에게 다시 확인해줘요 🔍')
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

  // ── 마스터 패널 ──────────────────────────────────────────────
  const MasterPanel = () => (
    <PixelCard padding="sm" className="mt-3 w-full animate-fade-slide-up">
      <p className="font-pixel text-[8px] text-purple mb-3">아빠 작업방 (Master)</p>
      <input type="text" value={masterId} onChange={e => setMasterId(e.target.value)}
        placeholder="ID" className="w-full bg-pixel-dark text-gold font-korean text-sm
                   border-4 border-pixel-dark px-3 py-2.5 mb-2 focus:outline-none focus:border-gold" />
      <input type="password" value={masterPw} onChange={e => setMasterPw(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleMasterLogin()}
        placeholder="Password" className="w-full bg-pixel-dark text-gold font-korean text-sm
                   border-4 border-pixel-dark px-3 py-2.5 mb-2 focus:outline-none focus:border-gold" />
      {masterError && <p className="font-korean text-sm text-rejected mb-2">{masterError}</p>}
      <PixelButton variant="primary" fullWidth size="sm" onClick={handleMasterLogin}>접속</PixelButton>
    </PixelCard>
  )

  // ════════════════════════════════════════════════════════════════
  // VIEW 1: LANDING — 대형 타이틀
  // ════════════════════════════════════════════════════════════════
  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-minecraft">

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
        <p className="font-pixel text-white text-center mb-10 text-[8px]">{APP_VERSION_SHORT}</p>

        {/* FAMILY LOGIN 버튼 */}
        <div className="w-full max-w-xs">
          <button type="button" onClick={() => {
            if (familyId) {
              // 이미 인증된 기기 → 초대코드 건너뛰고 캐릭터 선택
              const cache = readMemberCache(familyId)
              cachedRef.current = cache
              setMembers(cache)
              setSelected(cache.find(m => m.id === lastMemberId) ?? null)
              setView('characters')
              if (cache.length === 0) setMembersLoading(true)
            } else {
              // 새 기기 → 초대코드 입력
              setView('family-code')
            }
          }}
            className="w-full py-3 bg-gold border-4 border-yellow-600
                       font-pixel text-pixel-dark text-[10px]
                       hover:bg-yellow-400 active:translate-y-0.5 transition-all shadow-pixel">
            FAMILY LOGIN
          </button>
        </div>

        {/* 하단 링크 */}
        <div className="flex items-center gap-2 mt-5">
          <button type="button" onClick={() => navigate('/register')}
            className="font-pixel text-cream/70 text-[8px] underline underline-offset-2 hover:text-cream whitespace-nowrap">
            VERIFY ACCOUNT
          </button>
          <span className="text-cream/30 text-[8px]">|</span>
          <button type="button" onClick={() => navigate('/observer-login')}
            className="font-pixel text-cream/70 text-[8px] underline underline-offset-2 hover:text-cream whitespace-nowrap">
            GUEST
          </button>
          <span className="text-cream/30 text-[8px]">|</span>
          <button type="button" onClick={() => setShowMasterPanel(p => !p)}
            className="font-pixel text-cream/50 text-[8px] underline underline-offset-2 hover:text-cream whitespace-nowrap">
            SETTING
          </button>
        </div>

        {showMasterPanel && <div className="w-full max-w-xs mt-3"><MasterPanel /></div>}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 2: FAMILY CODE — 초대 코드 입력
  // ════════════════════════════════════════════════════════════════
  if (view === 'family-code') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-minecraft">
        <div className="w-full max-w-xs">

          {/* 헤더 */}
          <div className="text-center mb-8">
            <p className="font-pixel text-gold text-xs tracking-widest mb-2">FAMILY QUEST</p>
            <p className="font-korean text-cream text-base font-bold">🔑 가족 초대 코드</p>
            <p className="font-korean text-cream/60 text-xs mt-1">
              가족만 알고 있는 초대 코드를 입력해줘요
            </p>
          </div>

          {/* 입력창 */}
          <PixelCard padding="sm" className="mb-4">
            <p className="font-korean text-sm font-bold text-purple mb-3">초대 코드 입력</p>
            <div className="relative mb-2">
              <input
                type={showCode ? 'text' : 'password'}
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setInviteError('') }}
                onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
                placeholder="초대 코드를 입력해주세요"
                className="w-full bg-pixel-dark text-gold font-korean text-sm
                           border-4 border-pixel-dark px-3 py-3 pr-10
                           focus:outline-none focus:border-gold"
                autoFocus
              />
              <button type="button" onClick={() => setShowCode(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
                {showCode ? '🙈' : '👁️'}
              </button>
            </div>
            {inviteError && (
              <p className="font-korean text-xs text-rejected font-bold mb-2">{inviteError}</p>
            )}
            <button type="button" onClick={handleCodeSubmit}
              className="w-full py-3 bg-gold border-4 border-yellow-600
                         font-korean text-base font-bold text-pixel-dark
                         hover:bg-yellow-400 active:translate-y-0.5 transition-all shadow-pixel">
              확인
            </button>
          </PixelCard>

          <button type="button" onClick={() => setView('landing')}
            className="w-full text-center font-korean text-cream/50 text-xs underline">
            ← 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 3: FAMILY CODE INPUT — 비밀코드 입력 (신규 기기)
  // ════════════════════════════════════════════════════════════════
  if (view === 'family-id-input') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-minecraft">
        <div className="w-full max-w-xs">

          {/* 헤더 */}
          <div className="text-center mb-8">
            <p className="font-pixel text-gold text-xs tracking-widest mb-2">FAMILY QUEST</p>
            <p className="font-korean text-cream text-base font-bold">🏠 가족 찾기</p>
            <p className="font-korean text-cream/70 text-xs mt-2 leading-relaxed">
              아빠에게 받은 비밀 코드를 입력해주세요.<br/>
              입력하면 이미 등록된 가족을 불러올 수 있어요.
            </p>
          </div>

          <PixelCard padding="sm" className="mb-4">
            <p className="font-korean text-sm font-bold text-purple mb-3">비밀코드 입력</p>

            <input
              type="text"
              value={fidInput}
              onChange={e => { setFidInput(e.target.value); setFidError('') }}
              onKeyDown={e => e.key === 'Enter' && !verifying && handleFidSubmit()}
              placeholder="비밀코드를 입력해주세요"
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-3 mb-2
                         focus:outline-none focus:border-gold"
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

            <button type="button" onClick={handleFidSubmit} disabled={verifying || !fidInput.trim()}
              className="w-full py-3 bg-gold border-4 border-yellow-600
                         font-korean text-base font-bold text-pixel-dark
                         hover:bg-yellow-400 active:translate-y-0.5 transition-all shadow-pixel
                         disabled:opacity-50 disabled:cursor-not-allowed">
              {verifying ? '확인 중...' : '🔍 가족 찾기'}
            </button>
          </PixelCard>

          {/* 신규 가입 안내 */}
          <div className="bg-cream/10 border-2 border-cream/30 px-3 py-3 mb-4">
            <p className="font-korean text-xs text-cream/70 leading-relaxed">
              💡 <strong className="text-cream">처음 시작하나요?</strong><br/>
              아빠가 먼저 가입 후 가족 ID를 공유해줘야 해요.
            </p>
            <button type="button" onClick={() => navigate('/register')}
              className="mt-2 font-korean text-xs text-gold underline">
              새 가족 만들기 →
            </button>
          </div>

          <button type="button" onClick={() => setView('family-code')}
            className="w-full text-center font-korean text-cream/50 text-xs underline">
            ← 뒤로
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 4: CHARACTERS — 캐릭터 선택 + PIN 입력
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col bg-minecraft">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <button type="button"
          onClick={() => { setView('family-code'); setSelected(null); setPin('') }}
          className="flex items-center gap-1 px-3 py-1.5 bg-cream/20 border-2 border-cream/50
                     font-korean text-cream text-sm font-bold hover:bg-cream/30 transition-all active:scale-95">
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
            <p className="font-korean text-cream/70 text-sm animate-pulse">구성원 불러오는 중...</p>
            <p className="font-korean text-cream/40 text-xs">최대 5초 소요</p>
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
                className="font-korean text-cream/50 text-xs underline">
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
                      ? 'bg-gold/30 border-gold scale-[1.03] shadow-pixel'
                      : 'bg-cream/10 border-cream/30 hover:border-gold hover:bg-gold/10',
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
                      <p className="font-korean text-cream/60 text-xs">({member.realName})</p>
                    )}
                    {member.role === 'CHILD' && (
                      <p className="font-pixel text-[7px] text-gold/70 mt-0.5">Lv.{member.level}</p>
                    )}
                    {isLast && (
                      <p className="font-korean text-[9px] text-gold mt-0.5">마지막 접속</p>
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
                  <p className="font-korean text-sm font-bold text-pixel-dark leading-tight">
                    {selected.name}
                    {selected.realName && selected.realName !== selected.name && (
                      <span className="font-normal text-stone text-xs ml-1">({selected.realName})</span>
                    )}
                  </p>
                  <p className="font-korean text-xs text-stone">PIN 번호를 입력해주세요</p>
                </div>
              </div>

              {/* PIN 도트 표시 */}
              <div className="flex gap-2 justify-center mb-3">
                {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 border-2 border-pixel-dark
                    ${i < pin.length ? 'bg-pixel-dark' : 'bg-cream'}`} />
                ))}
              </div>

              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value.slice(0, 8)); setPinError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="PIN (숫자 또는 영문, 2~8자)"
                maxLength={8}
                className="w-full bg-pixel-dark text-gold font-korean text-sm text-center
                           border-4 border-pixel-dark px-3 py-2.5 mb-2
                           focus:outline-none focus:border-gold tracking-widest"
                autoFocus
              />

              {pinError && (
                <p className="font-korean text-xs text-rejected font-bold text-center mb-2">
                  {pinError}
                </p>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => { setSelected(null); setPin('') }}
                  className="flex-1 py-2.5 bg-cream border-4 border-pixel-dark
                             font-korean text-sm font-bold text-pixel-dark
                             hover:border-gold active:translate-y-0.5 transition-all">
                  취소
                </button>
                <button type="button" onClick={handleLogin} disabled={loading || pin.length < 2}
                  className="flex-[2] py-2.5 bg-gold border-4 border-yellow-600
                             font-korean text-base font-bold text-pixel-dark
                             hover:bg-yellow-400 active:translate-y-0.5 transition-all shadow-pixel
                             disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? '확인 중...' : '입장 (Enter)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
