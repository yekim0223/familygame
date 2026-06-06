// Design Ref: §5.1 하단 탭 바 — 벽돌 텍스처 + 아이콘 선명 (테두리 없음)
import { useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { audioManager } from '@/infrastructure/audio/audioManager'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { useMessageStore } from '@/infrastructure/stores/messageStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'

const LS_MISSION_SEEN = (memberId: string) => `fq_missions_seen_${memberId}`

export function BottomNav() {
  const { currentMember }           = useAuthStore()
  const { missions }                = useMissionStore()
  const { unreadGroupCount }        = useMessageStore()
  const { unreadCount: notifCount } = useNotificationStore()

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  // 아이: 마지막 방문 이후 새로 생긴 미션 수만 배지 표시
  // 부모: 확인 대기(PENDING_APPROVAL) 미션 수
  const [, forceUpdate] = useState(0)
  const missionBadge = (() => {
    if (isParent) return missions.filter(m => m.status === 'PENDING_APPROVAL').length
    if (!currentMember) return 0
    const lastSeen = Number(localStorage.getItem(LS_MISSION_SEEN(currentMember.id)) ?? 0)
    return missions.filter(m =>
      m.targetMemberIds.includes(currentMember.id) &&
      m.status === 'ACTIVE' &&
      m.createdAt.getTime() > lastSeen
    ).length
  })()

  const handleMissionsClick = useCallback(() => {
    audioManager.keyClick()
    if (!isParent && currentMember) {
      localStorage.setItem(LS_MISSION_SEEN(currentMember.id), Date.now().toString())
      forceUpdate(n => n + 1)  // 배지 즉시 갱신
    }
  }, [isParent, currentMember])

  const TABS = [
    { to: '/home',     icon: '/assets/icons/home.svg',     alt: '홈',     badge: 0,              msgBadge: false },
    { to: '/missions', icon: '/assets/icons/sword.svg',    alt: '퀘스트', badge: missionBadge,   msgBadge: false },
    { to: '/calendar', icon: '/assets/icons/calendar.svg', alt: '달력',   badge: 0,              msgBadge: false },
    { to: '/messages', icon: '/assets/icons/message.svg',  alt: '메세지', badge: unreadGroupCount, msgBadge: true },
    { to: '/rewards',  icon: '/assets/icons/trophy.svg',   alt: '보상',   badge: notifCount,     msgBadge: false },
    { to: '/game',     icon: '/assets/icons/gamepad.svg',  alt: '게임',   badge: 0,              msgBadge: false },
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
          onClick={tab.to === '/missions' ? handleMissionsClick : () => audioManager.keyClick()}
          className="relative flex-1 flex flex-col items-center justify-center
                     select-none gap-[3px] pt-1"
        >
          {({ isActive }) => (
            <>
              {/* 활성 탭 상단 gold 인디케이터 라인 */}
              {isActive && (
                <span className="absolute top-0 left-2 right-2 h-[2px] bg-gold" />
              )}

              {/* 아이콘 — SVG 픽셀 아트, 크기·glow로 활성 표현 */}
              <img
                src={tab.icon}
                alt={tab.alt}
                draggable={false}
                className="transition-none active:translate-y-[2px]"
                style={{
                  width:  isActive ? 30 : 26,
                  height: isActive ? 30 : 26,
                  imageRendering: 'pixelated',
                  filter: isActive
                    ? 'drop-shadow(0 0 6px #FFD700) drop-shadow(0 0 3px #FFD700)'
                    : 'brightness(0.85)',
                  willChange: 'transform',
                }}
              />

              {/* 배지 — 메시지: 숫자 텍스트 / 나머지: 빨간 점 */}
              {tab.badge > 0 && !isActive && (
                tab.msgBadge ? (
                  <span className="absolute top-0.5 right-1.5 font-korean text-xs font-bold text-gold
                                   leading-none">
                    ({tab.badge > 99 ? '99+' : tab.badge})
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-2.5 w-2.5 h-2.5
                                   bg-rejected rounded-full border border-black/60 shadow" />
                )
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
