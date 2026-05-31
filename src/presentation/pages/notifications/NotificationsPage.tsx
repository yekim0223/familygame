// Design Ref: §5.3 SCR-22 NotificationsPage — 알림 목록 (중복제거 + 스태킹)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { markNotificationRead, markAllNotificationsRead } from '@/infrastructure/firebase/collections/notifications'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import type { NotificationType, Notification } from '@/domain/entities/Message'
import type { Member } from '@/domain/entities/Member'

const NOTIF_ICONS: Record<NotificationType, string> = {
  MISSION_PENDING:    '⏳',
  MISSION_APPROVED:   '🎉',
  MISSION_REJECTED:   '💪',
  MISSION_HOLD:       '🤔',
  MISSION_CONFIRMED:  '✅',
  LEVEL_UP:           '🆙',
  BEG_RESULT:         '🙏',
  BEGGING_REQUEST:    '🙏',
  CHEER:              '💚',
  NEW_MISSION:        '⚔️',
  NEW_MESSAGE:        '💌',
}

const NOTIF_LABEL: Record<NotificationType, string> = {
  MISSION_PENDING:    '완료 신청',
  MISSION_APPROVED:   '미션 승인',
  MISSION_REJECTED:   '미션 반려',
  MISSION_HOLD:       '미션 보류',
  MISSION_CONFIRMED:  '퀘스트 확인',
  LEVEL_UP:           '레벨 업',
  BEG_RESULT:         '조르기 결과',
  BEGGING_REQUEST:    '조르기 요청',
  CHEER:              '응원',
  NEW_MISSION:        '새 퀘스트',
  NEW_MESSAGE:        '메시지',
}

interface StackedGroup {
  key: string
  latest: Notification
  count: number
  allIds: string[]
  allRead: boolean
}

// relatedId + type 기준으로 중복 제거 + 스태킹
function stackNotifications(notifications: Notification[]): StackedGroup[] {
  const map = new Map<string, StackedGroup>()

  for (const n of notifications) {
    const key = `${n.type}-${n.relatedId}`
    const existing = map.get(key)
    if (existing) {
      existing.count++
      existing.allIds.push(n.id)
      if (!n.isRead) existing.allRead = false
      // 최신 것 유지
      if (n.createdAt > existing.latest.createdAt) existing.latest = n
    } else {
      map.set(key, {
        key,
        latest: n,
        count: 1,
        allIds: [n.id],
        allRead: n.isRead,
      })
    }
  }

  // 최신순 정렬
  return Array.from(map.values()).sort((a, b) =>
    b.latest.createdAt.getTime() - a.latest.createdAt.getTime()
  )
}

export default function NotificationsPage() {
  const navigate    = useNavigate()
  const { notifications }     = useNotificationStore()
  const { familyId }          = useAuthStore()
  const { getMissionById }    = useMissionStore()
  const [members, setMembers] = useState<Member[]>([])
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  const getMemberName = (id?: string) => {
    if (!id) return null
    const m = members.find(m => m.id === id)
    return m ? (m.name !== m.realName ? `${m.name} (${m.realName})` : m.name) : null
  }

  const handleClick = async (group: StackedGroup) => {
    if (!group.allRead && familyId) {
      await markAllNotificationsRead(familyId, group.allIds.filter(id => {
        const n = notifications.find(n => n.id === id)
        return n && !n.isRead
      }))
    }
    const { type, relatedId } = group.latest
    if (type === 'BEGGING_REQUEST' || type === 'BEG_RESULT') navigate('/begging')
    else if (type === 'LEVEL_UP')    navigate('/profile')
    else if (type === 'NEW_MESSAGE' || type === 'CHEER') navigate('/messages')
    else if (relatedId) navigate(`/missions/${relatedId}`)
    else navigate('/missions')
  }

  const handleMarkAll = async () => {
    if (!familyId) return
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id)
    if (!unreadIds.length) return
    setMarkingAll(true)
    await markAllNotificationsRead(familyId, unreadIds)
    setMarkingAll(false)
  }

  const stacked = stackNotifications(notifications)
  const unreadCount = stacked.filter(g => !g.allRead).length

  return (
    <div className="p-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="t-heading text-gold t-pixel-shadow">🔔 알림</h1>
        {unreadCount > 0 && (
          <PixelButton
            variant="ghost"
            size="sm"
            disabled={markingAll}
            onClick={handleMarkAll}
          >
            {markingAll ? '처리 중...' : `전체 읽기 (${unreadCount})`}
          </PixelButton>
        )}
      </div>

      {stacked.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">🔔</p>
          <p className="font-korean text-sm text-panel-sub">새로운 알림이 없어요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stacked.map(group => {
            const { latest, count, allRead } = group
            const mission = getMissionById(latest.relatedId)

            return (
              <button key={group.key} type="button"
                className="w-full text-left"
                onClick={() => handleClick(group)}
              >
                <PixelCard padding="sm" className={!allRead ? '!border-gold' : ''}>
                  <div className="flex items-start gap-2">
                    {/* 아이콘 */}
                    <span className="text-2xl flex-shrink-0 leading-none mt-0.5">
                      {NOTIF_ICONS[latest.type] ?? '🔔'}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* 타입 배지 + 미션명 */}
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-korean text-xs font-bold text-panel-sub
                                         bg-panel-surface px-1.5 py-0.5 border border-panel-border flex-shrink-0">
                          {NOTIF_LABEL[latest.type]}
                        </span>
                        {mission && (
                          <span className="font-korean text-xs font-bold text-gold truncate">
                            {mission.emoji} {mission.title}
                          </span>
                        )}
                      </div>

                      {/* 내용 — 스태킹 시 요약 표시 */}
                      <p className={`font-korean text-sm leading-snug
                        ${!allRead ? 'font-bold text-cream' : 'text-panel-sub'}`}>
                        {count > 1
                          ? `${latest.content.slice(0, 20)}... 외 ${count - 1}건`
                          : latest.content}
                      </p>

                      {/* 시간 + 스택 수 */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-korean text-xs text-panel-sub">
                          {latest.createdAt.toLocaleString('ko-KR', {
                            month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', hour12: false,
                          })}
                        </span>
                        {count > 1 && (
                          <span className="font-korean text-xs font-bold text-hold
                                           bg-hold/10 px-1.5 py-0.5 border border-hold/30">
                            {count}건 묶음
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 미읽음 점 */}
                    {!allRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rejected flex-shrink-0 mt-1" />
                    )}
                  </div>
                </PixelCard>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
