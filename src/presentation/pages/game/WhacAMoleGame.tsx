// WhacAMoleGame — 두더지 잡기 (DOM 기반, 30초 타이머)
import { useState, useEffect, useRef, useReducer } from 'react'
import { audioManager } from '@/infrastructure/audio/audioManager'
import { EffectOverlay } from '@/presentation/components/effects/EffectOverlay'
import type { EffectType } from '@/presentation/components/effects/EffectOverlay'

type HoleContent = 'empty' | 'mole' | 'bomb' | 'mom'
type GamePhase   = 'playing' | 'over'

interface FloatText {
  idx: number
  text: string
  key: number
  positive: boolean
}

const GAME_DURATION = 30
const MAX_DURATION  = 60  // 엄마 보너스 포함 최대 60초
const HOLE_COUNT    = 9

// 배경 5종 (구멍 그리드와 대비되는 테마)
const BG_THEMES = ['nether', 'ocean', 'aurora', 'mushroom', 'cave'] as const

// ── 아빠 잡기 메인 컴포넌트 ──────────────────────────────────────────
export function WhacAMoleGame({ onGameOver, dadSvgUrl = '/assets/characters/base-dad.svg', momSvgUrl = '/assets/characters/base-mom.svg', onBack }: {
  onGameOver: (score: number) => void
  dadSvgUrl?: string
  momSvgUrl?: string
  onBack?: () => void
}) {
  // cbRef 패턴 — 항상 최신 onGameOver 참조 (규칙 26)
  const cbRef = useRef(onGameOver)
  cbRef.current = onGameOver

  // ── 게임 로직 Refs (stale closure 방지) ─────────────────────────
  const holesRef    = useRef<HoleContent[]>(Array(HOLE_COUNT).fill('empty' as HoleContent))
  const hitAnimRef  = useRef<Set<number>>(new Set())
  const activeRef   = useRef<Set<number>>(new Set())
  const genRef      = useRef<number[]>(Array(HOLE_COUNT).fill(0))
  const holeTimers  = useRef<(ReturnType<typeof setTimeout> | null)[]>(Array(HOLE_COUNT).fill(null))
  const gameActive  = useRef(false)
  const scoreRef    = useRef(0)
  const comboRef    = useRef(0)
  const timeRef     = useRef(GAME_DURATION)
  const floatKeyRef = useRef(0)

  // ── React 상태 (UI 렌더용) ────────────────────────────────────────
  const [, forceRender]     = useReducer((n: number) => n + 1, 0)
  const [score,    setScore]     = useState(0)
  const [timeLeft, setTimeLeft]  = useState(GAME_DURATION)
  const [combo,    setCombo]     = useState(0)
  const [bombFlash, setBombFlash] = useState(false)
  const [phase,    setPhase]     = useState<GamePhase>('playing')
  const [effect,   setEffect]    = useState<{ type: EffectType; cnt: number; key: number } | null>(null)
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([])
  const [uiPaused,      setUiPaused]      = useState(false)
  const [momBonusFlash, setMomBonusFlash] = useState(0)  // 0=없음, 5 or 10 = 보너스 초
  const [bgTheme]                         = useState(() => BG_THEMES[Math.floor(Math.random() * BG_THEMES.length)])
  const pausedRef  = useRef(false)

  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    gameActive.current = !pausedRef.current
    setUiPaused(p => !p)
  }

  // ── 헬퍼: 점수 플로팅 텍스트 ─────────────────────────────────────
  const showFloat = (idx: number, text: string, positive: boolean) => {
    const key = floatKeyRef.current++
    setFloatTexts(prev => [...prev, { idx, text, key, positive }])
    setTimeout(() => setFloatTexts(prev => prev.filter(f => f.key !== key)), 900)
  }

  const clearHole = (idx: number) => {
    holesRef.current[idx] = 'empty'
    hitAnimRef.current.delete(idx)
    activeRef.current.delete(idx)
    forceRender()
  }

  // ── 탭 핸들러 ────────────────────────────────────────────────────
  const handleTap = (idx: number) => {
    if (!gameActive.current || pausedRef.current) return
    const content = holesRef.current[idx]
    if (content === 'empty') return

    // 자동 숨김 타이머 취소 + generation 증가
    genRef.current[idx]++
    if (holeTimers.current[idx]) {
      clearTimeout(holeTimers.current[idx]!)
      holeTimers.current[idx] = null
    }
    activeRef.current.delete(idx)

    // 타격 애니메이션 시작
    hitAnimRef.current.add(idx)
    forceRender()
    setTimeout(() => clearHole(idx), 250)

    if (content === 'mom') {
      // 엄마 포착 → 시간 보너스! (5초 60% / 10초 40%)
      const bonus = Math.random() < 0.4 ? 10 : 5
      const capped = Math.min(MAX_DURATION, timeRef.current + bonus)
      timeRef.current = capped
      setTimeLeft(capped)
      setMomBonusFlash(bonus)
      setTimeout(() => setMomBonusFlash(0), 1800)
      showFloat(idx, `+${bonus}s ⏱️`, true)
      audioManager.coinCollect()
      setEffect({ type: 'hearts', cnt: 18, key: Date.now() })

    } else if (content === 'mole') {
      const newCombo = ++comboRef.current
      setCombo(newCombo)

      const mult = newCombo >= 5 ? 3 : newCombo >= 3 ? 2 : newCombo >= 2 ? 1.5 : 1
      const gain  = Math.round(100 * mult)
      scoreRef.current += gain
      setScore(scoreRef.current)
      showFloat(idx, `+${gain}${mult > 1 ? ` ×${mult}` : ''}`, true)

      if (newCombo === 5 || (newCombo > 5 && newCombo % 5 === 0)) {
        audioManager.whacCombo(5)
        setEffect({ type: 'fire', cnt: 20, key: Date.now() })
      } else if (newCombo === 3) {
        audioManager.whacCombo(3)
        setEffect({ type: 'confetti', cnt: 15, key: Date.now() })
      } else {
        audioManager.whacHit()
      }

    } else {
      // 폭탄 — 감점 + 붉은 플래시
      comboRef.current = 0
      setCombo(0)
      scoreRef.current = Math.max(0, scoreRef.current - 200)
      setScore(scoreRef.current)
      showFloat(idx, 'BOMB -200', false)
      audioManager.whacBomb()
      setBombFlash(true)
      setTimeout(() => setBombFlash(false), 350)
    }
  }

  // ── 게임 루프 ─────────────────────────────────────────────────────
  useEffect(() => {
    gameActive.current = true
    timeRef.current    = GAME_DURATION
    scoreRef.current   = 0
    comboRef.current   = 0
    holesRef.current   = Array(HOLE_COUNT).fill('empty' as HoleContent)
    hitAnimRef.current = new Set()
    activeRef.current  = new Set()
    genRef.current     = Array(HOLE_COUNT).fill(0)

    // 두더지/폭탄 생성
    const spawnMole = () => {
      if (!gameActive.current) return
      const t         = timeRef.current
      const maxActive = t > 20 ? 1 : t > 10 ? 2 : 3
      if (activeRef.current.size >= maxActive) return

      const emptyIdxs: number[] = []
      for (let i = 0; i < HOLE_COUNT; i++) {
        if (!activeRef.current.has(i)) emptyIdxs.push(i)
      }
      if (emptyIdxs.length === 0) return

      const idx     = emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)]
      // 엄마: 시간 줄수록 확률 상승 (잡기 힘든 캐릭터)
      const momPct  = t > 20 ? 0.03 : t > 10 ? 0.05 : 0.08
      // 해골: 처음부터 낮은 확률로 등장, 시간 줄수록 증가
      const bombPct = t > 20 ? 0.06 : t > 10 ? 0.12 : 0.22
      const roll    = Math.random()
      const content: HoleContent = roll < momPct ? 'mom' : roll < momPct + bombPct ? 'bomb' : 'mole'
      const gen     = ++genRef.current[idx]
      // 엄마: 0.9초 표시 (아빠 1.2초보다 짧아 잡기 어려움)
      const showDur = content === 'mom' ? 900 : t > 20 ? 1200 : t > 10 ? 900 : 600

      holesRef.current[idx] = content
      activeRef.current.add(idx)
      forceRender()

      holeTimers.current[idx] = setTimeout(() => {
        if (genRef.current[idx] !== gen) return
        genRef.current[idx]++

        // 두더지 놓침 — 감점
        if (content === 'mole' && gameActive.current) {
          scoreRef.current = Math.max(0, scoreRef.current - 50)
          setScore(scoreRef.current)
          comboRef.current = 0
          setCombo(0)
          audioManager.whacMiss()
          showFloat(idx, '-50', false)
        }
        holesRef.current[idx] = 'empty'
        activeRef.current.delete(idx)
        forceRender()
      }, showDur)
    }

    const spawnLoop = setInterval(spawnMole, 500)

    // 타이머 카운트다운 (최대 MAX_DURATION=60초)
    const timerTick = setInterval(() => {
      if (pausedRef.current) return
      timeRef.current = Math.max(0, timeRef.current - 1)
      setTimeLeft(timeRef.current)

      if (timeRef.current <= 0) {
        gameActive.current = false
        clearInterval(timerTick)
        clearInterval(spawnLoop)
        holeTimers.current.forEach(t => t && clearTimeout(t))

        holesRef.current = Array(HOLE_COUNT).fill('empty' as HoleContent)
        activeRef.current.clear()
        hitAnimRef.current.clear()
        forceRender()

        setPhase('over')
        audioManager.gameOver()

        // 5초 후 결과 화면 (기존 게임들과 통일)
        setTimeout(() => cbRef.current(scoreRef.current), 5000)
      }
    }, 1000)

    return () => {
      gameActive.current = false
      clearInterval(timerTick)
      clearInterval(spawnLoop)
      holeTimers.current.forEach(t => t && clearTimeout(t))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 계산값 ──────────────────────────────────────────────────────
  const timePercent = (timeLeft / MAX_DURATION) * 100   // 60초 기준 바
  const comboMult   = combo >= 5 ? 3 : combo >= 3 ? 2 : combo >= 2 ? 1.5 : 1

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <div
      className="relative h-full flex flex-col select-none overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      {/* 랜덤 SVG 배경 */}
      <img src={`/assets/backgrounds/${bgTheme}.svg`} alt=""
        aria-hidden="true" draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: 'cover', opacity: 0.55, imageRendering: 'pixelated' }} />
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      {/* 폭탄 플래시 */}
      {bombFlash && (
        <div className="absolute inset-0 bg-rejected/25 z-10 pointer-events-none" />
      )}
      {/* 엄마 보너스 — HUD 바로 아래, 그리드 밖 상단에 표시 */}
      {momBonusFlash > 0 && (
        <div className="absolute left-0 right-0 z-25 pointer-events-none flex justify-center animate-fade-slide-up"
          style={{ top: '58px' }}>
          <div className="bg-panel-darkest/95 border-4 border-pink px-6 py-2">
            <p className="font-pixel text-xl text-pink t-pixel-shadow text-center">+{momBonusFlash}s ❤️ 엄마 보너스!</p>
          </div>
        </div>
      )}

      {/* 게임오버 오버레이 */}
      {phase === 'over' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center
          bg-black/70 border-4 border-rejected/60 gap-3">
          <p className="font-pixel text-2xl text-rejected t-pixel-shadow">TIME'S UP!</p>
          <p className="font-pixel text-lg text-gold t-pixel-shadow">{scoreRef.current.toLocaleString()}</p>
          <p className="font-korean text-sm text-panel-sub">결과 화면으로 이동 중...</p>
        </div>
      )}

      {/* 파티클 이펙트 */}
      {effect && (
        <EffectOverlay
          key={effect.key}
          type={effect.type}
          count={effect.cnt}
          onEnd={() => setEffect(null)}
        />
      )}

      {/* HUD */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b-2 border-gold/30 shrink-0" style={{ background: '#2A5020' }}>
        {/* 점수 */}
        <div className="text-center min-w-[60px]">
          <p className="font-pixel text-sm text-gold t-pixel-shadow">{score.toLocaleString()}</p>
          <p className="font-korean text-xs text-panel-sub">점수</p>
        </div>

        {/* 타이머 바 */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="h-3 bg-panel-surface border border-panel-border overflow-hidden">
            <div
              className={`h-full transition-[width] linear ${
                timeLeft > 15 ? 'bg-approved' : timeLeft > 8 ? 'bg-hold' : 'bg-rejected animate-pulse'
              }`}
              style={{ width: `${timePercent}%`, transitionDuration: '1s' }}
            />
          </div>
          <p className="font-pixel text-xs text-center text-panel-sub">{timeLeft}s</p>
        </div>

        {/* 콤보 + 일시정지 버튼 */}
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
          {combo >= 2 ? (
            <>
              <p className={`font-pixel text-xs t-pixel-shadow ${combo >= 5 ? 'text-rejected animate-pulse' : 'text-gold'}`}>
                {combo >= 5 ? 'FEVER' : combo >= 3 ? 'GREAT' : 'COMBO'} x{comboMult}
              </p>
              <p className="font-korean text-xs text-panel-sub">{combo}콤보</p>
            </>
          ) : (
            <p className="font-pixel text-xs text-panel-sub/30">- -</p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <button type="button" onClick={togglePause}
              className="min-w-[54px] h-9 px-2 bg-purple border-2 border-purple/60
                         flex items-center justify-center font-pixel text-xs text-white
                         active:scale-95 transition-transform">
              {uiPaused ? '▶' : 'PAUSE'}
            </button>
            {onBack && (
              <button type="button" onClick={onBack}
                className="min-w-[54px] h-9 px-2 bg-rejected border-2 border-rejected/60
                           flex items-center justify-center font-pixel text-xs text-white
                           active:scale-95 transition-transform">
                EXIT
              </button>
            )}
          </div>
        </div>
      </div>
      {/* 일시정지 오버레이 */}
      {uiPaused && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/65">
          <p className="font-pixel text-2xl text-gold t-pixel-shadow">PAUSED</p>
          <p className="font-korean text-sm text-cream/70 mt-2">▶ 버튼으로 계속하기</p>
        </div>
      )}

      {/* 홀 그리드 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {holesRef.current.map((content, idx) => {
            const isHit = hitAnimRef.current.has(idx)
            return (
              <div key={idx} className="relative">
                <button
                  onPointerDown={() => handleTap(idx)}
                  style={{
                    width: '100%', aspectRatio: '1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                    background: content !== 'empty' ? '#7A4820' : '#5C3210',
                    border: '3px solid',
                    borderColor: content !== 'empty' ? '#C87040 #4A2008 #4A2008 #C87040' : '#8A5030 #2A1008 #2A1008 #8A5030',
                    cursor: content !== 'empty' ? 'pointer' : 'default',
                    transition: 'all 0.1s',
                    transform: content !== 'empty' && !isHit ? undefined : undefined,
                  }}
                  className={isHit ? 'active:scale-90' : ''}
                >
                  {(content === 'mole' || content === 'bomb' || content === 'mom') && (
                    <div className={`relative flex items-center justify-center w-full h-full
                      ${isHit ? 'animate-whac-hit' : 'animate-mole-popup'}`}
                    >
                      {content === 'mole' ? (
                        <img src={dadSvgUrl} alt="아빠" draggable={false}
                          className={isHit ? 'animate-dad-hit' : ''}
                          style={{ width: '80%', height: '80%', imageRendering: 'pixelated', objectFit: 'contain' }} />
                      ) : content === 'mom' ? (
                        /* 엄마: 분홍 테두리 + 빠르게 사라짐 */
                        <div className="relative flex items-center justify-center w-full h-full">
                          {!isHit && <div className="absolute inset-0 border-4 border-pink/60 animate-pulse pointer-events-none" />}
                          <img src={momSvgUrl} alt="엄마" draggable={false}
                            className={isHit ? 'animate-dad-hit' : ''}
                            style={{ width: '80%', height: '80%', imageRendering: 'pixelated', objectFit: 'contain' }} />
                        </div>
                      ) : (
                        <img src="/assets/icons/skull.svg" alt="bomb" draggable={false}
                          style={{ width: '72%', height: '72%', imageRendering: 'pixelated', objectFit: 'contain',
                            filter: 'drop-shadow(0 0 4px #E5393590)' }} />
                      )}
                    </div>
                  )}
                  {content === 'empty' && (
                    <span className="text-2xl opacity-20 leading-none">⭕</span>
                  )}
                </button>

                {/* 점수 플로팅 텍스트 */}
                {floatTexts
                  .filter(f => f.idx === idx)
                  .map(f => (
                    <div
                      key={f.key}
                      className={`absolute -top-7 left-0 right-0 text-center pointer-events-none
                        font-pixel text-xs animate-float-up
                        ${f.positive ? 'text-gold' : 'text-rejected'}`}
                    >
                      {f.text}
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* 콤보 스트릭 배너 */}
      {combo >= 3 && phase === 'playing' && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <div className={`px-5 py-1.5 border-2 bg-panel-darkest ${
            combo >= 5 ? 'border-rejected' : 'border-gold'
          }`}>
            <p className={`font-pixel text-xs t-pixel-shadow ${combo >= 5 ? 'text-rejected' : 'text-gold'}`}>
              {combo >= 5 ? 'FEVER TIME!' : 'COMBO!'} {combo}연속
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
