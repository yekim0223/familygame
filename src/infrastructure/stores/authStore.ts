// Design Ref: §2.3 데이터 흐름 — Zustand authStore
import { create } from 'zustand'
import type { Member } from '@/domain/entities/Member'

interface AuthState {
  currentMember: Member | null
  familyId: string | null
  isLoading: boolean
  isRestoring: boolean           // 앱 시작 시 세션 복원 중 여부
  pinFailCount: number
  pinLockedUntil: number | null   // timestamp (ms)

  setCurrentMember: (member: Member | null) => void
  setFamilyId: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setRestoring: (v: boolean) => void
  incrementPinFail: () => void
  resetPinFail: () => void
  isPinLocked: () => boolean
  clearSession: () => void
}

// localStorage에 저장된 세션이 있으면 복원 시도 필요
const _hasStoredSession = !!(
  localStorage.getItem('familyId') && localStorage.getItem('fq_last_login')
)

export const useAuthStore = create<AuthState>((set, get) => ({
  currentMember: null,
  familyId: null,
  isLoading: false,
  isRestoring: _hasStoredSession,
  pinFailCount: 0,
  pinLockedUntil: null,

  setCurrentMember: (member) => set({ currentMember: member }),
  setFamilyId: (id) => set({ familyId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setRestoring: (v) => set({ isRestoring: v }),

  // PIN 오입력 3회 → 30초 잠금
  incrementPinFail: () => {
    const count = get().pinFailCount + 1
    if (count >= 3) {
      set({ pinFailCount: 0, pinLockedUntil: Date.now() + 30_000 })
    } else {
      set({ pinFailCount: count })
    }
  },

  resetPinFail: () => set({ pinFailCount: 0, pinLockedUntil: null }),

  isPinLocked: () => {
    const locked = get().pinLockedUntil
    if (!locked) return false
    return Date.now() < locked
  },

  clearSession: () => set({
    currentMember: null,
    familyId: null,
    pinFailCount: 0,
    pinLockedUntil: null,
  }),
}))
