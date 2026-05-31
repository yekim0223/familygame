// Design Ref: §5.2 Layout — 앱 헤더 (뒤로가기 + 로고 + 알림 + 설정)
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { useAuth } from '@/presentation/hooks/useAuth'

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

  const [showMenu, setShowMenu] = useState(false)
  const [logoIdx, setLogoIdx] = useState(0)
  const [logoFlash, setLogoFlash] = useState(false)

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

  const isHome = location.pathname === '/home' || location.pathname === '/'

  // 알림·설정 공통 버튼 스타일
  const iconBtn = 'relative w-10 h-10 flex items-center justify-center text-xl ' +
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
            className="w-10 h-10 flex items-center justify-center
                       bg-black/30 border-2 border-black/50
                       hover:border-gold hover:bg-black/40 transition-all active:scale-95
                       active:translate-y-[1px]"
            aria-label="뒤로가기"
          >
            {/* 픽셀 블록 뒤로가기 화살표 */}
            <span style={{
              fontSize: '22px', lineHeight: 1,
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

      {/* 우측: 알림 + 설정 — 동일한 블록 디자인 */}
      <div className="flex items-center gap-2">

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
                <div className="absolute right-0 top-12 z-50 min-w-[145px]
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
