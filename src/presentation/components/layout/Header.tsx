// Design Ref: §5.2 Layout — 앱 헤더 (뒤로가기 + 로고 + 오디오 + 알림 + 설정)
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { useAuth } from '@/presentation/hooks/useAuth'
import { audioManager } from '@/infrastructure/audio/audioManager'
import type { BGMTheme } from '@/infrastructure/audio/audioManager'

// ── 오디오 플레이어 상수 ──────────────────────────────────────────────
const THEME_ICON: Record<BGMTheme, string> = {
  DEFAULT: '🎵',
  JOYFUL:  '🎶',
  CALM:    '🌙',
  MUTE:    '🔇',
}
const THEME_LABEL: Record<BGMTheme, string> = {
  DEFAULT: '메인',
  JOYFUL:  '명랑',
  CALM:    '차분',
  MUTE:    '무음',
}
const BGM_ORDER: BGMTheme[] = ['DEFAULT', 'JOYFUL', 'CALM', 'MUTE']

// ── 로고 변형 메시지 ──────────────────────────────────────────────────
// 5분 간격 로고 변형 메시지 (재미있는 픽셀 감성)
const LOGO_VARIANTS = [
  'FAMILY QUEST',
  'F4MILY QU3ST',
  '⚔ FAMILY ⚔',
  'QUEST TIME!',
  '★ FAMILY ★',
  'FAMI LY❤',
  'FAMILY MODE',
  '[ QUEST ]',
]

export function Header() {
  const { currentMember } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [showMenu, setShowMenu]       = useState(false)
  const [logoIdx, setLogoIdx]         = useState(0)
  const [logoFlash, setLogoFlash]     = useState(false)
  const [bgmTheme, setBgmTheme]       = useState<BGMTheme>(audioManager.getTheme())
  const [showAudioMenu, setShowAudioMenu] = useState(false)
  const [isPlaying, setIsPlaying]     = useState(audioManager.isPlaying())

  // 5분마다 로고 텍스트 변경 + 0.6초 flash 효과
  useEffect(() => {
    const interval = setInterval(() => {
      setLogoFlash(true)
      setTimeout(() => {
        setLogoIdx(i => (i + 1) % LOGO_VARIANTS.length)
        setLogoFlash(false)
      }, 300)
    }, 5 * 60 * 1000) // 5분
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    setShowMenu(false)
    await logout()
  }

  // ── 오디오 핸들러 ───────────────────────────────────────────────
  const handleAudioTheme = (t: BGMTheme) => {
    audioManager.resume()
    audioManager.setTheme(t)
    setBgmTheme(t)
    setIsPlaying(t !== 'MUTE')
    setShowAudioMenu(false)
  }

  const handlePlayPause = () => {
    audioManager.resume()
    if (bgmTheme === 'MUTE') return
    if (audioManager.isPlaying()) {
      audioManager.pause()
      setIsPlaying(false)
    } else {
      audioManager.play()
      setIsPlaying(true)
    }
  }

  const handleNextTheme = () => {
    audioManager.resume()
    const musicThemes: BGMTheme[] = ['DEFAULT', 'JOYFUL', 'CALM']
    const cur = musicThemes.indexOf(bgmTheme as 'DEFAULT' | 'JOYFUL' | 'CALM')
    const next = musicThemes[(cur + 1) % musicThemes.length]
    handleAudioTheme(next)
  }

  const isHome = location.pathname === '/home' || location.pathname === '/'

  // 알림·설정 공통 버튼 스타일
  const iconBtn = 'relative w-8 h-8 flex items-center justify-center text-lg ' +
    'bg-black/30 border-2 border-black/50 hover:border-gold hover:bg-black/40 ' +
    'transition-all active:scale-95 focus:outline-none'

  return (
    <header className="bg-panel-darkest fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[428px]
                       border-b-[3px] border-gold/30 flex items-center
                       justify-between px-3 z-40" style={{ height: '52px' }}>

      {/* 좌측: 뒤로가기 OR 로고 */}
      <div className="flex items-center gap-2">
        {!isHome ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center
                       bg-black/30 border-2 border-black/50
                       hover:border-gold hover:bg-black/40 transition-all active:scale-95
                       active:translate-y-[1px]"
            aria-label="뒤로가기"
          >
            {/* 픽셀 블록 뒤로가기 화살표 */}
            <span style={{
              fontSize: '18px', lineHeight: 1,
              filter: 'drop-shadow(0 0 4px #FFD700) drop-shadow(0 1px 0 #7B5000)',
            }}>
              ⬅️
            </span>
          </button>
        ) : null}

        {/* FAMILY QUEST 로고 */}
        <Link to="/home" className="flex items-center leading-none select-none">
          <span
            className={[
              'font-pixel tracking-wide transition-all duration-300 animate-logo-shimmer',
              logoFlash ? 'opacity-0 scale-110' : 'opacity-100 scale-100',
            ].join(' ')}
            style={{
              fontSize: '14px',
              letterSpacing: '0.08em',
              color: '#FFD700',
              textShadow: '2px 2px 0 #7B3F00, 0 0 8px #FFD700',
            }}
          >
            {LOGO_VARIANTS[logoIdx]}
          </span>
        </Link>
      </div>

      {/* 우측: 오디오 플레이어 + 알림 + 설정 */}
      <div className="flex items-center gap-1">

        {/* ── 미니 오디오 플레이어 ─────────────────────────────── */}
        {currentMember && (
          <div className="flex items-center border-2 border-black/50 bg-black/30 divide-x divide-black/40">
            {/* 재생/일시정지 */}
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={bgmTheme === 'MUTE'}
              aria-label={isPlaying ? '일시정지' : '재생'}
              className="w-6 h-7 flex items-center justify-center text-[10px] text-cream/80
                         hover:text-gold hover:bg-white/10
                         active:scale-95 transition-transform duration-100
                         disabled:opacity-30 select-none"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            {/* 다음 테마 순환 (DEFAULT → JOYFUL → CALM → 반복) */}
            <button
              type="button"
              onClick={handleNextTheme}
              aria-label="다음 무드"
              className="w-6 h-7 flex items-center justify-center text-[9px] text-cream/80
                         hover:text-gold hover:bg-white/10
                         active:scale-95 transition-transform duration-100 select-none"
            >
              ▶▶
            </button>

            {/* 현재 무드 아이콘 → 클릭 시 셀렉터 팝업 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAudioMenu(p => !p)}
                aria-label="사운드 무드 선택"
                className="w-7 h-7 flex items-center justify-center text-sm
                           hover:bg-white/10
                           active:scale-95 transition-transform duration-100 select-none"
              >
                {THEME_ICON[bgmTheme]}
              </button>

              {showAudioMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAudioMenu(false)} />
                  <div className="absolute right-0 top-8 z-50 min-w-[118px]
                                  bg-panel-mid border-4 border-panel-border shadow-pixel">
                    {BGM_ORDER.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleAudioTheme(t)}
                        className={[
                          'w-full px-3 py-2 text-left font-korean text-xs flex items-center gap-2',
                          'hover:bg-panel-surface transition-colors',
                          'active:scale-95 transition-transform duration-100',
                          'border-b border-panel-border last:border-0',
                          bgmTheme === t ? 'text-gold font-bold' : 'text-cream',
                        ].join(' ')}
                      >
                        <span className="text-sm">{THEME_ICON[t]}</span>
                        <span>{THEME_LABEL[t]}</span>
                        {bgmTheme === t && (
                          <span className="ml-auto text-gold text-[10px]">▶</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 알림 */}
        <Link to="/notifications" className={iconBtn}>
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3
                             bg-rejected rounded-full border-2 border-dirt" />
          )}
        </Link>

        {/* 설정 드롭다운 */}
        {currentMember && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(p => !p)}
              className={iconBtn}
              aria-label="설정 메뉴"
            >
              ⚙️
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-50 min-w-[145px]
                                bg-panel-mid border-4 border-panel-border shadow-pixel">
                  <div className="px-3 py-2 border-b-2 border-panel-border">
                    <p className="font-korean text-xs font-bold text-gold">
                      {currentMember.name}
                    </p>
                    <p className="font-korean text-xs text-panel-sub">
                      {currentMember.realName}
                      {currentMember.role === 'CHILD' && ` · Lv.${currentMember.level}`}
                    </p>
                  </div>
                  {/* 프로필 설정 — 모든 역할 */}
                  <button type="button"
                    onClick={() => { setShowMenu(false); navigate('/profile') }}
                    className="w-full px-3 py-2 text-left font-korean text-xs text-cream
                               hover:bg-panel-surface border-b border-panel-border">
                    👤 프로필 설정
                  </button>
                  {/* 작업공간 — 부모 전용 */}
                  {currentMember.role !== 'CHILD' && (
                    <button type="button"
                      onClick={() => { setShowMenu(false); navigate('/settings') }}
                      className="w-full px-3 py-2 text-left font-korean text-xs text-cream
                                 hover:bg-panel-surface border-b border-panel-border">
                      {currentMember.role === 'DAD' ? '🛠️ 아빠 작업공간' : '🛠️ 엄마 작업공간'}
                    </button>
                  )}
                  <button type="button" onClick={handleLogout}
                    className="w-full px-3 py-2 text-left font-korean text-xs text-rejected
                               hover:bg-rejected/10">
                    🚪 로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
