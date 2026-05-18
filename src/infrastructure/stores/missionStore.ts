// Design Ref: §2.3 데이터 흐름 — Zustand missionStore
import { create } from 'zustand'
import type { Mission } from '@/domain/entities/Mission'

interface MissionStore {
  missions: Mission[]
  loading: boolean
  setMissions: (missions: Mission[]) => void
  setLoading: (loading: boolean) => void
  // 단일 미션 조회 (로컬 캐시)
  getMissionById: (id: string) => Mission | undefined
}

export const useMissionStore = create<MissionStore>((set, get) => ({
  missions: [],
  loading: false,
  setMissions: (missions) => set({ missions }),
  setLoading: (loading) => set({ loading }),
  getMissionById: (id) => get().missions.find(m => m.id === id),
}))
