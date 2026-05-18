import { useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { subscribeNotifications } from '@/infrastructure/firebase/collections/notifications'

// 부모(DAD/MOM) 로그인 시 두 부모의 알림을 모두 구독하기 위해 캐시에서 ID 조회
function getParentIds(familyId: string, currentId: string, isParent: boolean): string[] {
  if (!isParent) return [currentId]
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return [currentId]
    const parsed = JSON.parse(raw)
    if (parsed.familyId !== familyId) return [currentId]
    const parentIds: string[] = (parsed.members as any[])
      .filter(m => m.role === 'DAD' || m.role === 'MOM')
      .map(m => m.id)
    return parentIds.length > 0 ? parentIds : [currentId]
  } catch { return [currentId] }
}

export function useNotifications() {
  const { familyId, currentMember } = useAuthStore()
  const { notifications, unreadCount, setNotifications } = useNotificationStore()

  useEffect(() => {
    if (!familyId || !currentMember) return
    const isParent = currentMember.role === 'DAD' || currentMember.role === 'MOM'
    const memberIds = getParentIds(familyId, currentMember.id, isParent)
    const unsub = subscribeNotifications(familyId, memberIds, setNotifications)
    return unsub
  }, [familyId, currentMember?.id])

  return { notifications, unreadCount }
}
