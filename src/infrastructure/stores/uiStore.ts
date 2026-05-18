import { create } from 'zustand'

interface UiState {
  globalError: string | null
  globalLoading: boolean
  toast: { message: string; type: 'success' | 'error' | 'info' } | null

  setGlobalError: (error: string | null) => void
  setGlobalLoading: (loading: boolean) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
}

export const useUiStore = create<UiState>((set) => ({
  globalError: null,
  globalLoading: false,
  toast: null,

  setGlobalError: (error) => set({ globalError: error }),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3000)
  },
  clearToast: () => set({ toast: null }),
}))
