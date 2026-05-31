// Design Ref: §2.3 데이터 흐름 — Firestore onSnapshot → Zustand → UI
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { subscribeMissions, subscribePendingMissions, updateMission } from '@/infrastructure/firebase/collections/missions'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import type { Mission } from '@/domain/entities/Mission'

// 기간이 지난 ACTIVE 미션을 자동으로 EXPIRED 처리 + 부모에게 MISSION_EXPIRED 알림 (세션당 1회)
const expiredSet = new Set<string>()
async function autoExpire(familyId: string, missions: Mission[]) {
  const now = new Date()
  for (const m of missions) {
    if (m.status === 'ACTIVE' && m.endDate < now && !expiredSet.has(m.id)) {
      expiredSet.add(m.id)
      await updateMission(familyId, m.id, { status: 'EXPIRED' } as any)
      // 부모 전원에게 만료 알림 발송 (패밀리 늬우스 표시용)
      try {
        const members = await new Promise<any[]>(resolve => {
          const unsub = subscribeMembers(familyId, data => { unsub(); resolve(data) })
        })
        const parents = members.filter(mb => mb.role === 'DAD' || mb.role === 'MOM')
        await Promise.all(parents.map(p =>
          createNotification(familyId, {
            type: 'MISSION_EXPIRED',
            targetMemberId: p.id,
            content: `⚔️ '${m.title}' 퀘스트가 기간 만료로 소멸됐어요 😢`,
            relatedId: m.id,
          })
        ))
      } catch { /* ignore — 만료 처리 자체는 이미 성공 */ }
    }
  }
}

// 전체 미션 구독 (미션 목록 화면)
export function useMissions(): { missions: Mission[]; loading: boolean } {
  const { familyId } = useAuthStore()
  const { missions, loading, setMissions, setLoading } = useMissionStore()
  const familyRef = useRef(familyId)

  useEffect(() => {
    if (!familyId) return
    familyRef.current = familyId
    setLoading(true)
    const unsub = subscribeMissions(familyId, (data) => {
      setMissions(data)
      setLoading(false)
      autoExpire(familyId, data)
    })
    return unsub
  }, [familyId])

  return { missions, loading }
}

// 승인 대기 미션 구독 — 엄마/아빠 공유: 전체 PENDING 구독
export function usePendingMissions(): Mission[] {
  const { familyId, currentMember } = useAuthStore()
  const { missions, setMissions } = useMissionStore()

  useEffect(() => {
    if (!familyId || !currentMember) return
    const unsub = subscribePendingMissions(familyId, (pending) => {
      setMissions([...missions.filter(m => m.status !== 'PENDING_APPROVAL'), ...pending])
    })
    return unsub
  }, [familyId, currentMember?.id])

  return missions.filter(m => m.status === 'PENDING_APPROVAL')
}
