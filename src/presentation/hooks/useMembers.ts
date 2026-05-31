// CLAUDE.md 규칙 11번: 멤버 이름은 subscribeMembers()로 실시간 구독 — localStorage 직접 접근 금지
// getMemberName 중복 구현(3곳) → 이 훅 단일 소스로 통합
import { useState, useEffect } from 'react'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import type { Member } from '@/domain/entities/Member'
import { useAuthStore } from '@/infrastructure/stores/authStore'

export function useMembers() {
  const { familyId } = useAuthStore()
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  function getMemberName(memberId: string): string {
    const m = members.find(x => x.id === memberId)
    if (!m) return ''
    return m.realName && m.realName !== m.name
      ? `${m.name} (${m.realName})`
      : m.name
  }

  return { members, getMemberName }
}
