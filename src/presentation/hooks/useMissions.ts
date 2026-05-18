// Design Ref: §2.3 데이터 흐름 — Firestore onSnapshot → Zustand → UI
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { subscribeMissions, subscribePendingMissions, updateMission } from '@/infrastructure/firebase/collections/missions'
import type { Mission } from '@/domain/entities/Mission'

// 기간이 지난 ACTIVE 미션을 자동으로 EXPIRED 처리 (세션당 1회)
const expiredSet = new Set<string>()
async function autoExpire(familyId: string, missions: Mission[]) {
  const now = new Date()
  for (const m of missions) {
    if (m.status === 'ACTIVE' && m.endDate < now && !expiredSet.has(m.id)) {
      expiredSet.add(m.id)
      await updateMission(familyId, m.id, { status: 'EXPIRED' } as any)
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
