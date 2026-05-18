import { create } from 'zustand'
import type { Notification } from '@/domain/entities/Message'

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifs: Notification[]) => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.isRead).length,
  }),
}))
