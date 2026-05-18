import { useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMessageStore } from '@/infrastructure/stores/messageStore'
import { subscribeGroupChat, subscribeMyCheers } from '@/infrastructure/firebase/collections/messages'

export function useMessages() {
  const { familyId, currentMember } = useAuthStore()
  const { groupMessages, cheers, setGroupMessages, setCheers } = useMessageStore()

  useEffect(() => {
    if (!familyId || !currentMember) return
    const memberId = currentMember.id
    // currentMemberId를 함께 전달 → store에서 unreadGroupCount 자동 계산
    const unsubGroup = subscribeGroupChat(familyId, (msgs) =>
      setGroupMessages(msgs, memberId)
    )
    const unsubCheer = subscribeMyCheers(familyId, memberId, setCheers)
    return () => { unsubGroup(); unsubCheer() }
  }, [familyId, currentMember?.id])

  return { groupMessages, cheers }
}
