import { create } from 'zustand'
import type { RewardRecord } from '@/domain/entities/Reward'

interface RewardStore {
  rewards: RewardRecord[]
  setRewards: (rewards: RewardRecord[]) => void
}

export const useRewardStore = create<RewardStore>((set) => ({
  rewards: [],
  setRewards: (rewards) => set({ rewards }),
}))
