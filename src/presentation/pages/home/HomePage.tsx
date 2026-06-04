// Design Ref: §5-2 HomePage — 마일스톤 3-1 전면 개편 (v3.1)
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { useMembers } from '@/presentation/hooks/useMembers'
import { LoginAnimation } from '@/presentation/components/animations/LoginAnimation'
import { CharacterSprite, BANNER_SVG_SET } from '@/presentation/components/character/CharacterSprite'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import { BANNER_UNLOCKS, BANNER_BG, CHARACTER_LABELS } from '@/application/use-cases/characters/selectCharacter'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { toDateKey } from '@/utils/dateUtils'
import { QuestionBalloonButton } from '@/presentation/pages/home/QuestionBalloon'
import { subscribeNotices, type Notice } from '@/infrastructure/firebase/collections/notices'
import { PraiseWhiteboard } from '@/presentation/components/home/PraiseWhiteboard'
import { EffectOverlay } from '@/presentation/components/effects/EffectOverlay'


// ── 공지사항 아이템 (용사의 여정과 동일 규격) ────────────────────
function NoticeItem({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false)
  const timeStr = notice.createdAt.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return (
    <div
      className="flex items-start gap-2 py-2 border-b border-panel-border last:border-0
                 cursor-pointer hover:bg-panel-surface/30 active:bg-panel-surface/50 transition-colors"
      onClick={() => setOpen(p => !p)}
    >
      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gold mt-2" />
      <div className="flex-1 min-w-0">
        <p className="font-korean text-xs font-bold text-gold truncate">{notice.title}</p>
        {open && (
          <p className="font-korean text-xs text-cream/80 mt-1 leading-relaxed line-clamp-4">
            {notice.content}
          </p>
        )}
        <p className="font-korean text-xs text-panel-sub mt-0.5">{timeStr} · {notice.authorName}</p>
      </div>
      <span className="font-korean text-xs text-panel-sub flex-shrink-0 mt-1">
        {open ? '▲' : '▼'}
      </span>
    </div>
  )
}


// ════════════════════════════════════════════════════════════════

export default function HomePage() {
  const { currentMember } = useAuth()
  const { familyId } = useAuthStore()
  const { getMissionById, missions } = useMissionStore()
  const { notifications } = useNotificationStore()
  const { getMemberName } = useMembers()
  const navigate = useNavigate()

  // fq_anim_shown 플래그: 첫 로그인 1회만 표시, 로그아웃 시 clearAllLocalData로 초기화
  // animDone: 이미 본 경우 true로 초기화 (안 하면 캐릭터 영구 정지)
  const [showAnim, setShowAnim] = useState(() => !localStorage.getItem('fq_anim_shown'))
  const [animDone, setAnimDone] = useState(() => !!localStorage.getItem('fq_anim_shown'))
  const [notices, setNotices] = useState<Notice[]>([])
  const [showRewardEffect, setShowRewardEffect] = useState(false)
  // ── 생동감 애니메이션 상태 ──────────────────────────────────────
  const [rolling,    setRolling]    = useState<'place'|'left'|'right'|null>(null)
  const [mainSpeech, setMainSpeech] = useState<{word:string;fading:boolean}|null>(null)
  const [petVisible, setPetVisible] = useState(true)
  const [petXOffset, setPetXOffset] = useState(0)
  const [cameo,      setCameo]      = useState<{charId:string;x:number;speech:string|null;show:boolean}|null>(null)
  // ── 지그재그 이동 상태 ────────────────────────────────────────
  const [charPos,    setCharPos]    = useState({ x: 0, y: 0 })
  const [facingLeft, setFacingLeft] = useState(false)
  const [isWalking,  setIsWalking]  = useState(false)
  const waypointIdx    = useRef(0)
  const walkTimer      = useRef<ReturnType<typeof setTimeout>|null>(null)
  const petVisibleRef  = useRef(true)   // 스케줄러 클로저에서 petVisible 안전 접근용
  const rewardNavTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const charAnimTimer  = useRef<ReturnType<typeof setTimeout>|null>(null)
  const petReadyRef    = useRef(false)
  // ── 터치 감정 반응 ──────────────────────────────────────────
  type EmotionBubble = { id: number; icon: string; xOff: number }
  const [emotionBubbles,    setEmotionBubbles]    = useState<EmotionBubble[]>([])
  const [petEmotionBubbles, setPetEmotionBubbles] = useState<EmotionBubble[]>([])
  const [cameoBubble,       setCameoBubble]        = useState<EmotionBubble|null>(null)
  const [annoyedLevel,      setAnnoyedLevel]       = useState(0)
  const tapCountRef        = useRef(0)
  const lastTapRef         = useRef(0)
  const annoyedLevelRef    = useRef(0)
  const annoyResetTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  // 역할별 캐미오 캐릭터 ID
  const CAMEO_BY_ROLE: Record<string, string[]> = {
    DAD: ['base-mom','base-child-1','base-child-2'],
    MOM: ['base-dad','base-child-1','base-child-2'],
    CHILD: ['base-dad','base-mom'],
    OBSERVER: ['base-dad','base-mom'],
  }
  const CONV_PAIRS = [
    { main:'Hi!',   cameo:'Hello!' },
    { main:'Good!', cameo:'Nice!'  },
    { main:'Go!',   cameo:'Yeah!'  },
    { main:'Wow!',  cameo:'Cool!'  },
    { main:'Nice!', cameo:'Right!' },
  ]
  const SOLO_WORDS = ['Hi!','Good!','Yeah!','Go!','Nice!']

  useEffect(() => () => {
    if (rewardNavTimer.current)    clearTimeout(rewardNavTimer.current)
    if (charAnimTimer.current)     clearTimeout(charAnimTimer.current)
    if (walkTimer.current)         clearTimeout(walkTimer.current)
    if (annoyResetTimerRef.current) clearTimeout(annoyResetTimerRef.current)
  }, [])

  // ── 애니메이션 스케줄러 ────────────────────────────────────────
  useEffect(() => {
    if (!animDone) return
    let active = true

    // 이동 웨이포인트 (캐릭터 박스 내 격리 좌표)
    const WALK_POINTS = [
      { x: 0,   y: 0   },  // 중앙
      { x: 65,  y: 0   },  // 우측
      { x: -52, y: -12 },  // 좌상단
      { x: -65, y: 0   },  // 좌측
      { x: 52,  y: 8   },  // 우하단
    ]

    const showMainSpeech = (word: string) => {
      setMainSpeech({ word, fading: false })
      setTimeout(() => { if (active) setMainSpeech(s => s ? { ...s, fading: true } : null) }, 2000)
      setTimeout(() => { if (active) setMainSpeech(null) }, 2500)
    }

    const doRoll = (type: 'place'|'left'|'right') => {
      setRolling(type)
      setTimeout(() => { if (active) setRolling(null) }, 750)
    }

    // 이동: 랜덤 웨이포인트로 걸어가기
    const doWalk = () => {
      let nextIdx = Math.floor(Math.random() * WALK_POINTS.length)
      if (nextIdx === waypointIdx.current) nextIdx = (nextIdx + 1) % WALK_POINTS.length
      const cur  = WALK_POINTS[waypointIdx.current]
      const next = WALK_POINTS[nextIdx]
      waypointIdx.current = nextIdx
      if (next.x !== cur.x) setFacingLeft(next.x < cur.x)
      setIsWalking(true)
      setCharPos({ x: next.x, y: next.y })
      if (walkTimer.current) clearTimeout(walkTimer.current)
      walkTimer.current = setTimeout(() => {
        if (!active) return
        setIsWalking(false)
      }, 1800)
    }

    const doPetDisappear = () => {
      setPetVisible(false)
      petVisibleRef.current = false
      setTimeout(() => {
        if (!active) return
        const nx = (Math.random() - 0.5) * 80
        setPetXOffset(nx)
        setPetVisible(true)
        petVisibleRef.current = true
        setTimeout(() => { if (active) setPetXOffset(0) }, 2200)
      }, 3000)
    }

    const doCameo = (currentRole: string) => {
      const opts = CAMEO_BY_ROLE[currentRole] ?? ['base-dad']
      const charId = opts[Math.floor(Math.random() * opts.length)]
      // 펫이 보이면 반드시 왼쪽 등장 (겹침 방지 — 펫은 항상 우측)
      const side = petVisibleRef.current ? -1 : (Math.random() < 0.5 ? -1 : 1)
      const cx = side * (70 + Math.random() * 40)
      const pair = CONV_PAIRS[Math.floor(Math.random() * CONV_PAIRS.length)]

      setCameo({ charId, x: cx, speech: null, show: true })
      setTimeout(() => {
        if (!active) return
        showMainSpeech(pair.main)
        setCameo(c => c ? { ...c, speech: pair.cameo } : null)
      }, 1000)
      setTimeout(() => {
        if (!active) return
        setCameo(c => c ? { ...c, show: false } : null)
        setTimeout(() => { if (active) setCameo(null) }, 500)
      }, 3500)
    }

    const petTimer = setTimeout(() => { petReadyRef.current = true }, 10000)

    const schedule = (role: string) => {
      // 가만히 서있는 시간 3.5~7초
      const delay = 3500 + Math.random() * 3500
      charAnimTimer.current = setTimeout(() => {
        if (!active) return
        // 귀찮음 상태면 이동/롤 등 모든 액션 스킵 (자리에서 멈춤)
        if (annoyedLevelRef.current > 0) { schedule(role); return }
        const r = Math.random()
        if      (r < 0.18)                        doWalk()
        else if (r < 0.30)                        doRoll('place')
        else if (r < 0.40)                        doRoll(Math.random() < 0.5 ? 'left' : 'right')
        else if (r < 0.56)                        showMainSpeech(SOLO_WORDS[Math.floor(Math.random()*SOLO_WORDS.length)])
        else if (r < 0.65 && petReadyRef.current) doPetDisappear()
        else if (r < 0.83 && !cameo)              doCameo(role)
        // 나머지(17%): 아무것도 안 하고 계속 서있기
        schedule(role)
      }, delay)
    }

    schedule(currentMember?.role ?? 'CHILD')
    return () => {
      active = false
      petReadyRef.current = false
      clearTimeout(petTimer)
      if (charAnimTimer.current) clearTimeout(charAnimTimer.current)
      if (walkTimer.current) clearTimeout(walkTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animDone])


  // ── 공통: 연타 카운터 처리 → icon + level 반환 ───────────────
  const processTap = useCallback((): { icon: string; level: number } => {
    const now = Date.now()
    if (now - lastTapRef.current > 2500) tapCountRef.current = 0
    tapCountRef.current++
    lastTapRef.current = now
    const count = tapCountRef.current
    const NORMAL_ICONS = ['music', 'star', 'begging'] as const
    const icon  = count >= 5 ? 'skull' : NORMAL_ICONS[Math.floor(Math.random() * 3)]
    const level = count >= 5 ? 2 : count >= 3 ? 1 : 0
    setAnnoyedLevel(level)
    annoyedLevelRef.current = level
    if (annoyResetTimerRef.current) clearTimeout(annoyResetTimerRef.current)
    annoyResetTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0; setAnnoyedLevel(0); annoyedLevelRef.current = 0
    }, 3000)
    return { icon, level }
  }, [])

  // ── 캐릭터 터치 ───────────────────────────────────────────────
  const handleCharOrPetTap = useCallback(() => {
    const { icon } = processTap()
    const id = Date.now() + Math.floor(Math.random() * 999)
    setEmotionBubbles(prev => [...prev.slice(-5), { id, icon, xOff: 6 + Math.floor(Math.random() * 26) }])
    setTimeout(() => setEmotionBubbles(prev => prev.filter(b => b.id !== id)), 1600)
  }, [processTap])

  // ── 펫 터치 (독립 버블 위치) ──────────────────────────────────
  const handlePetTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const { icon } = processTap()
    const id = Date.now() + Math.floor(Math.random() * 999)
    setPetEmotionBubbles(prev => [...prev.slice(-3), { id, icon, xOff: 4 + Math.floor(Math.random() * 14) }])
    setTimeout(() => setPetEmotionBubbles(prev => prev.filter(b => b.id !== id)), 1600)
  }, [processTap])

  // ── 캐미오(게스트) 터치 → skull 즉시, 700ms 후 소멸 ──────────
  const handleCameoTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const id = Date.now()
    setCameoBubble({ id, icon: 'skull', xOff: 6 })
    setTimeout(() => setCameoBubble(null), 700)
  }, [])

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  if (!currentMember) return null

  const isParent = currentMember.role === 'DAD' || currentMember.role === 'MOM'
  const isChild = currentMember.role === 'CHILD'
  // Firebase 값 직접 사용 (localStorage currentSkin은 다른 사용자 값이 섞일 수 있음 — 버그 #캐릭터오류)
  const displayCharId   = currentMember.character.characterId
  const displayPetId    = currentMember.character.petId
  // displayBanner: ProfilePage에서 사용, 홈은 bannerId로 직접 처리

  // ── 아이 전용 RPG 스탯 계산 (ATK = 이번주 GOOD, QST = 진행 중 퀘스트 수) ──
  const todayKey = toDateKey(new Date())
  const myActiveMissions = useMemo(
    () => missions.filter(m => m.status === 'ACTIVE' && m.targetMemberIds.includes(currentMember.id)),
    [missions, currentMember.id]
  )
  // 오늘 + 어제 슬롯에서 GOOD 수 집계 (이번 주 전체보다 직관적)
  const weekKeys = useMemo(() => {
    const keys: string[] = []
    const d = new Date(); d.setHours(0, 0, 0, 0)
    for (let i = 0; i < 7; i++) { keys.push(toDateKey(d)); d.setDate(d.getDate() - 1) }
    return keys
  }, [todayKey])
  const atkCount = useMemo(() => myActiveMissions.reduce((acc, m) => {
    const slots = m.slot_evaluations?.[currentMember.id] ?? {}
    return acc + weekKeys.filter(k => slots[k] === 'GOOD').length
  }, 0), [myActiveMissions, weekKeys, currentMember.id])

  // 용사의 여정 피드 (MISSION_EXPIRED 포함, 최대 5개)
  const feedItems = useMemo(() => {
    const missionEventTypes = new Set([
      'NEW_MISSION', 'MISSION_CONFIRMED', 'MISSION_PENDING',
      'MISSION_APPROVED', 'MISSION_REJECTED', 'MISSION_HOLD',
    ])
    const seen = new Set<string>()
    return notifications
      .filter(n => {
        if (n.type === 'NEW_MESSAGE') return false
        if (!isParent && n.type === 'BEGGING_REQUEST') return false
        // 삭제된 퀘스트 연관 알림 제외 (오해 방지 가드)
        if (n.relatedId && missionEventTypes.has(n.type) && !getMissionById(n.relatedId)) return false
        const key = `${n.relatedId}-${n.type}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 5)
  }, [notifications, isParent, getMissionById])

  return (
    <>
      {showRewardEffect && (
        <EffectOverlay type="coins" count={20} onEnd={() => setShowRewardEffect(false)} />
      )}
      {/* 로그인 애니메이션 */}
      {showAnim && !animDone && (
        <div onClick={() => {
          setShowAnim(false); setAnimDone(true)
          localStorage.setItem('fq_anim_shown', '1')
        }}>
          <LoginAnimation
            role={currentMember.role}
            characterId={currentMember.character.characterId}
            onComplete={() => {
              setShowAnim(false); setAnimDone(true)
              localStorage.setItem('fq_anim_shown', '1')
            }}
          />
        </div>
      )}

      <div className="p-3 pb-4 space-y-3">

        {/* ① RPG 파노라마 캐릭터 카드 — 안 2: 상단 HUD·중앙 캐릭터·하단 EXP */}
        {(() => {
          const bannerId   = currentMember.character.worldBanner ?? 'overworld'
          const bannerInfo = BANNER_UNLOCKS.find(b => b.id === bannerId)
          const gradient   = BANNER_BG[bannerId] ?? 'from-grass to-green-700'
          const hasBannerSvg = !!(bannerId && BANNER_SVG_SET.has(bannerId))
          return (
            <div className="border-4 border-black relative overflow-hidden">

              {/* ── 배경 (전체) ── */}
              {hasBannerSvg ? (
                <img src={`/assets/backgrounds/${bannerId}.svg`} aria-hidden="true"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
              )}
              {/* 내부 테두리 */}
              <div className="absolute inset-[3px] border border-white/10 pointer-events-none" />

              {/* ── 상단 HUD 바 ── */}
              <div className="relative flex items-center px-3 py-1 bg-black/50 border-b border-white/10">
                {/* 좌: 아이=ATK / 부모=역할 */}
                <div className="flex-1">
                  {isChild ? (
                    <span className="font-pixel text-xs text-yellow-300">⭐ {atkCount}</span>
                  ) : (
                    <span className="font-pixel text-[11px] text-cream/90">
                      {currentMember.role === 'DAD' ? 'Master' : 'Parent'}
                    </span>
                  )}
                </div>
                {/* 중앙: 이름 + 직업명 */}
                <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
                  <p className="font-korean text-sm font-bold text-white t-pixel-shadow truncate">
                    {currentMember.name}
                  </p>
                  {CHARACTER_LABELS[displayCharId] && (
                    <span className="font-korean text-[10px] text-gold/90 bg-black/50 px-1 border border-gold/30 flex-shrink-0 truncate max-w-[60px]">
                      {CHARACTER_LABELS[displayCharId]}
                    </span>
                  )}
                </div>
                {/* 우: 아이=QST / 부모=레벨(내 땅은 하단에만) */}
                <div className="flex-1 text-right">
                  {isChild ? (
                    <span className="font-pixel text-xs text-blue-300">⚔️ {myActiveMissions.length}</span>
                  ) : (
                    <span className="font-pixel text-xs text-cream/50">Lv.{currentMember.level}</span>
                  )}
                </div>
              </div>

              {/* ── 중앙: 캐릭터 + 펫 + 캐미오 ── */}
              <div className="relative flex items-end justify-center min-h-[158px]">

                {/* 두근두근 풍선 (아이, 좌 고정) */}
                {isChild && familyId && (
                  <div className="absolute left-2 bottom-2 z-10">
                    <QuestionBalloonButton member={currentMember} familyId={familyId} />
                  </div>
                )}

                {/* ── 캐미오 캐릭터 ── */}
                {cameo && (
                  <div
                    className="absolute bottom-0 z-10 flex flex-col items-center"
                    onClick={handleCameoTap}
                    style={{
                      left: '50%',
                      transform: `translateX(calc(-50% + ${cameo.x}px))`,
                      opacity: cameo.show ? 1 : 0,
                      transition: 'opacity 0.5s ease',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {/* 캐미오 skull 버블 */}
                    {cameoBubble && (
                      <div className="absolute animate-emotion-float pointer-events-none"
                        style={{ right: '-10px', top: '-20px', zIndex: 120 }}>
                        <img src="/assets/icons/skull.svg" width={32} height={32}
                          style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 5px #E53935)' }} />
                      </div>
                    )}
                    {/* 캐미오 말풍선 */}
                    {cameo.speech && (
                      <div className="animate-speech-pop mb-0.5 px-2 py-0.5 bg-white border-2 border-black whitespace-nowrap relative"
                        style={{ transform: 'translateX(-50%)', position: 'absolute', bottom: '100%', left: '50%' }}>
                        <span className="font-pixel text-[10px] text-black">{cameo.speech}</span>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-black" />
                      </div>
                    )}
                    {/* 캐미오 스프라이트 (작게 0.75배) */}
                    <div className={rolling ? 'animate-char-roll' : ''}>
                      <div style={{ transform: 'scale(0.75)', transformOrigin: 'bottom center' }}>
                        <CharacterSprite
                          characterId={cameo.charId}
                          role={cameo.charId.includes('dad') ? 'DAD' : cameo.charId.includes('mom') ? 'MOM' : 'CHILD'}
                          size="lg"
                          animate={animDone ? 'bob' : 'none'}
                          petId={null}
                          weapon={null}
                          transparent
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 메인 캐릭터 (지그재그 이동 — transform만 사용, 레이아웃 무영향) ── */}
                <div
                  onClick={handleCharOrPetTap}
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    cursor: 'pointer',
                    transform: `translateX(${charPos.x}px) translateY(${charPos.y}px)`,
                    transition: isWalking ? 'transform 1.8s ease-in-out' : 'transform 0.3s ease-out',
                    zIndex: 20,
                  }}
                >
                  {/* ── 감정 버블 (캐릭터 우상단에서 위로 플로팅) ── */}
                  {emotionBubbles.map(b => (
                    <div
                      key={b.id}
                      className="absolute animate-emotion-float"
                      style={{ right: `${-b.xOff}px`, top: '-18px', zIndex: 110 }}
                    >
                      <img
                        src={`/assets/icons/${b.icon}.svg`}
                        width={36} height={36}
                        style={{
                          imageRendering: 'pixelated',
                          filter: b.icon === 'skull'
                            ? 'drop-shadow(0 0 5px #E53935) drop-shadow(0 0 2px #000)'
                            : 'drop-shadow(0 0 4px rgba(255,215,0,0.9)) drop-shadow(0 0 1px #000)',
                        }}
                      />
                    </div>
                  ))}

                  {/* 말풍선 (이동 따라가지만 flip 영향 안받게 flip 바깥) */}
                  {mainSpeech && (
                    <div
                      className={`absolute z-[100] px-2 py-1 bg-white border-2 border-black whitespace-nowrap pointer-events-none
                        ${mainSpeech.fading ? 'animate-speech-fade' : 'animate-speech-pop'}`}
                      style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4 }}
                    >
                      <span className="font-pixel text-xs text-black">{mainSpeech.word}</span>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-black" />
                      <div className="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-white" />
                    </div>
                  )}

                  {/* 방향 반전 wrapper (X flip) */}
                  <div style={{
                    transform: `scaleX(${facingLeft ? -1 : 1})`,
                    transition: 'transform 0.25s ease',
                    transformOrigin: 'center bottom',
                  }}>
                    {/* 구르기 / 귀찮음 / 걷기 / 정지 애니메이션 */}
                    <div className={
                      rolling            ? 'animate-char-roll' :
                      annoyedLevel >= 2  ? 'animate-char-very-annoyed' :
                      annoyedLevel >= 1  ? 'animate-char-annoyed' :
                      isWalking          ? 'animate-char-walk' : ''
                    }>
                      {/* scale + bob (정지 시에만 bob) */}
                      <div
                        className={!isWalking && !rolling && animDone ? 'animate-character-bob' : ''}
                        style={{ transform: 'scale(1.2)', transformOrigin: 'bottom center' }}
                      >
                        <CharacterSprite
                          characterId={displayCharId}
                          role={currentMember.role}
                          size="xl"
                          animate="none"
                          petId={null} weapon={null} transparent
                          gearWeapon={currentMember.character.equipment?.[0] || null}
                          gearHelmet={currentMember.character.equipment?.[1] || null}
                          gearShield={currentMember.character.equipment?.[2] || null}
                          gearArmor={currentMember.character.equipment?.[3] || null}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 펫 ── */}
                {displayPetId && (
                  <div
                    className="absolute bottom-1 animate-bounce flex-shrink-0"
                    onClick={handlePetTap}
                    style={{
                      right: `calc(8% + ${petXOffset < 0 ? Math.abs(petXOffset) : 0}px)`,
                      left: petXOffset > 0 ? `calc(10% + ${petXOffset}px)` : undefined,
                      animationDuration: '1.1s',
                      opacity: petVisible ? 1 : 0,
                      transition: 'opacity 0.4s ease, right 1.5s ease, left 1.5s ease',
                      cursor: 'pointer',
                    }}
                  >
                    {/* 펫 전용 감정 버블 */}
                    <div style={{ position: 'relative' }}>
                      {petEmotionBubbles.map(b => (
                        <div key={b.id} className="absolute animate-emotion-float pointer-events-none"
                          style={{ right: `${-b.xOff}px`, top: '-16px', zIndex: 110 }}>
                          <img src={`/assets/icons/${b.icon}.svg`} width={30} height={30}
                            style={{
                              imageRendering: 'pixelated',
                              filter: b.icon === 'skull'
                                ? 'drop-shadow(0 0 5px #E53935) drop-shadow(0 0 2px #000)'
                                : 'drop-shadow(0 0 3px rgba(255,215,0,0.9))',
                            }} />
                        </div>
                      ))}
                      <img
                        src={`/assets/pets/${displayPetId}.svg`}
                        width={48} height={48}
                        style={{ imageRendering: 'pixelated', objectFit: 'contain', display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── 하단 EXP 바 (아이) / 정보+편집 (부모) ── */}
              <div className="relative bg-black/50 px-3 py-2 border-t border-white/10">
                {isChild ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-pixel text-[10px] text-gold/90">❤️ EXP</span>
                      <span className="font-pixel text-[10px] text-cream/60">
                        Lv.{currentMember.level} → Lv.{currentMember.level + 1}
                      </span>
                    </div>
                    <ExpBar exp={currentMember.exp} level={currentMember.level} />
                    <div className="flex justify-end mt-1">
                      <button type="button" onClick={() => navigate('/profile')}
                        className="font-korean text-xs text-white/60 hover:text-white active:scale-95 transition-all">
                        ✏️ 편집
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-korean text-xs text-gold/80">
                      {bannerInfo ? `${bannerInfo.emoji} ${bannerInfo.label}` : '🌍 초원'}
                    </span>
                    <button type="button" onClick={() => navigate('/profile')}
                      className="font-korean text-xs text-white/70 hover:text-white active:scale-95 transition-all">
                      ✏️ 캐릭터 편집
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ② 부모 관리자 퀵 메뉴 */}
        {isParent && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { to: '/missions/new',   svg: '/assets/icons/sword.svg',    label: '퀘스트 생성' },
              { to: '/begging/manage', svg: '/assets/icons/begging.svg',  label: '조르기 관리' },
              { to: '/rewards',        svg: '/assets/icons/trophy.svg',   label: '보상 현황' },
            ].map(item => (
              <Link key={item.to} to={item.to}
                className="card-pixel flex flex-col items-center gap-1.5 py-3
                           hover:border-gold/60 active:translate-y-0.5 transition-all">
                <img src={item.svg} alt={item.label} draggable={false}
                  style={{ width: 28, height: 28, imageRendering: 'pixelated' }} />
                <span className="font-korean text-xs font-bold text-cream text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ⑤ 패밀리 늬우스 피드 */}
        {feedItems.length > 0 && (
          <PixelCard variant="dark" padding="sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img src="/assets/icons/star.svg" width={18} height={18} style={{ imageRendering: 'pixelated' }} />
                <p className="t-sub font-bold text-gold t-pixel-shadow">용사의 여정</p>
              </div>
              <Link to="/notifications" className="font-korean text-xs text-panel-sub underline">
                전체 보기
              </Link>
            </div>
            <div className="space-y-0">
              {feedItems.map(notif => {
                const relatedMission = notif.relatedId ? getMissionById(notif.relatedId) : null
                const targetNames = relatedMission?.targetMemberIds
                  .map(getMemberName).filter(Boolean).join(', ')
                const timeStr = notif.createdAt
                  ? notif.createdAt.toLocaleString('ko-KR', {
                    month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  })
                  : ''
                const getNavPath = () => {
                  switch (notif.type) {
                    case 'NEW_MESSAGE': case 'CHEER': case 'MOM_CHEER': return '/messages'
                    case 'BEG_RESULT': case 'BEGGING_REQUEST':
                      return isParent ? '/begging/manage' : '/begging'
                    case 'LEVEL_UP': return '/profile'
                    case 'MISSION_EXPIRED': return '/missions'
                    default:
                      if (!notif.relatedId) return '/missions'
                      return getMissionById(notif.relatedId) ? `/missions/${notif.relatedId}` : '/missions'
                  }
                }

                return (
                  <div
                    key={notif.id}
                    className="flex items-start gap-2 py-2 border-b border-panel-border last:border-0
                               cursor-pointer hover:bg-panel-surface/30 active:bg-panel-surface/50
                               transition-colors"
                    onClick={() => {
                      const path = getNavPath()
                      if (notif.type === 'MISSION_APPROVED' || notif.type === 'BEG_RESULT') {
                        setShowRewardEffect(true)
                        rewardNavTimer.current = setTimeout(() => navigate(path), 1000)
                      } else {
                        navigate(path)
                      }
                    }}
                  >
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                      notif.isRead ? 'bg-panel-border' : 'bg-rejected'
                    }`} />
                    <div className="flex-1 min-w-0">
                      {relatedMission && notif.type !== 'MISSION_EXPIRED' && (
                        <p className="font-korean text-xs font-bold text-gold truncate">
                          {relatedMission.title}
                        </p>
                      )}
                      <p className={`font-korean text-xs leading-snug mt-0.5 ${notif.type === 'MISSION_EXPIRED' ? 'text-panel-sub line-through' : 'text-cream'
                        }`}>
                        {notif.content}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {targetNames && (
                          <span className="font-korean text-xs text-panel-sub">👤 {targetNames}</span>
                        )}
                        {timeStr && (
                          <span className="font-korean text-xs text-panel-sub">{timeStr}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </PixelCard>
        )}

        {/* ⑥ 공지사항 (용사의 여정과 동일 PixelCard 구조) */}
        {notices.length > 0 && (
          <PixelCard variant="dark" padding="sm">
            <div className="flex items-center gap-2 mb-2">
              <img src="/assets/icons/megaphone.svg" width={18} height={18} style={{ imageRendering: 'pixelated' }} />
              <p className="t-sub font-bold text-gold t-pixel-shadow">공지사항</p>
            </div>
            <div className="space-y-0">
              {notices.slice(0, 3).map(n => <NoticeItem key={n.id} notice={n} />)}
            </div>
          </PixelCard>
        )}

        {/* ⑦ 칭찬 화이트보드 (자녀 전용 — 하단) */}
        {isChild && familyId && (
          <PraiseWhiteboard familyId={familyId} memberId={currentMember.id} />
        )}

        {/* ⑧ 조르기 플로팅 버튼 (자녀) */}
        {isChild && (
          <Link
            to="/begging"
            className="fixed bottom-20 right-4 w-14 h-14 bg-pink border-4 border-pixel-dark
                       shadow-pixel flex flex-col items-center justify-center gap-0.5
                       active:translate-y-0.5 active:shadow-none z-30 animate-beg-bounce"
          >
            <img src="/assets/icons/begging.svg" alt="조르기" draggable={false}
              style={{ width: 28, height: 28, imageRendering: 'pixelated' }} />
            <span className="font-korean text-xs font-bold text-pixel-dark leading-none">
              조르기
            </span>
          </Link>
        )}

      </div>
    </>
  )
}
