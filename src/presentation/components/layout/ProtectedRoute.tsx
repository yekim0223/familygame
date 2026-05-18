import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentMember, isRestoring } = useAuthStore()

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-minecraft flex items-center justify-center">
        <p className="font-korean text-cream text-sm animate-pulse">로딩 중...</p>
      </div>
    )
  }

  if (!currentMember) return <Navigate to="/login" replace />
  return <>{children}</>
}
