import { create } from 'zustand'
import type { Message } from '@/domain/entities/Message'

interface MessageStore {
  groupMessages: Message[]
  cheers: Message[]
  unreadGroupCount: number
  setGroupMessages: (messages: Message[], currentMemberId?: string) => void
  setCheers: (cheers: Message[]) => void
  setUnreadGroupCount: (count: number) => void
  markGroupRead: (currentMemberId: string) => void
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  groupMessages: [],
  cheers: [],
  unreadGroupCount: 0,

  setGroupMessages: (groupMessages, currentMemberId) => {
    const unread = currentMemberId
      ? groupMessages.filter(m => !m.readBy.includes(currentMemberId)).length
      : 0
    set({ groupMessages, unreadGroupCount: unread })
  },

  setCheers: (cheers) => set({ cheers }),

  setUnreadGroupCount: (count) => set({ unreadGroupCount: count }),

  // 읽음 처리 — 메시지 탭 진입 시 호출
  markGroupRead: (currentMemberId) => {
    const { groupMessages } = get()
    const allRead = groupMessages.map(m =>
      m.readBy.includes(currentMemberId)
        ? m
        : { ...m, readBy: [...m.readBy, currentMemberId] }
    )
    set({ groupMessages: allRead, unreadGroupCount: 0 })
  },
}))
