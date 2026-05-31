// Design Ref: §5.1 하단 탭 바 — 벽돌 텍스처 + 아이콘 선명 (테두리 없음)
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { useMessageStore } from '@/infrastructure/stores/messageStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'

export function BottomNav() {
  const { currentMember }           = useAuthStore()
  const { missions }                = useMissionStore()
  const { unreadGroupCount }        = useMessageStore()
  const { unreadCount: notifCount } = useNotificationStore()

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  const missionBadge = isParent
    ? missions.filter(m => m.status === 'PENDING_APPROVAL').length
    : missions.filter(m =>
        m.targetMemberIds.includes(currentMember?.id ?? '') && m.status === 'ACTIVE'
      ).length

  const TABS = [
    { to: '/home',     icon: '⛏️', badge: 0 },
    { to: '/missions', icon: '⚔️', badge: missionBadge },
    { to: '/calendar', icon: '📅', badge: 0 },
    { to: '/messages', icon: '💌', badge: unreadGroupCount },
    { to: '/rewards',  icon: '🏆', badge: notifCount },
    { to: '/game',     icon: '🎮', badge: 0 },
  ]

  return (
    <nav
      className="bg-panel-darkest fixed bottom-0 left-1/2 -translate-x-1/2
                 w-full max-w-[428px] h-[60px] flex z-40
                 border-t-[3px] border-gold/30"
    >
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="relative flex-1 flex flex-col items-center justify-center
                     select-none gap-[3px] pt-1"
        >
          {({ isActive }) => (
            <>
              {/* 활성 탭 상단 gold 인디케이터 라인 */}
              {isActive && (
                <span className="absolute top-0 left-2 right-2 h-[2px] bg-gold" />
              )}

              {/* 아이콘 — 크기·glow로 활성 표현 */}
              <span
                className="leading-none transition-none active:translate-y-[2px]"
                style={{
                  fontSize:   isActive ? '26px' : '20px',
                  filter: isActive
                    ? 'drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 4px #FFD700)'
                    : 'none',
                  opacity: isActive ? 1 : 0.7,
                  willChange: 'transform',
                }}
              >
                {tab.icon}
              </span>

              {/* 빨간 콩 배지 — 활성 탭에선 즉시 사라짐 */}
              {tab.badge > 0 && !isActive && (
                <span
                  className="absolute top-1.5 right-2.5 w-2.5 h-2.5
                             bg-rejected rounded-full border border-black/60 shadow"
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
