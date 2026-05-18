// Design Ref: §5.2 Layout — 헤더 48px + 콘텐츠(스크롤) + 하단탭 56px 래퍼
// 30분 비활성 자동 로그아웃 포함
import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'

const IDLE_MS = 30 * 60 * 1000  // 30분

export function AppLayout() {
  const { clearSession, currentMember } = useAuthStore()
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await signOut()
      clearSession()
      clearAllLocalData()
      navigate('/login', { replace: true })
    }, IDLE_MS)
  }

  useEffect(() => {
    if (!currentMember) return  // 로그인 상태일 때만 감시

    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()  // 마운트 시 즉시 시작

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentMember?.id])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-minecraft">
        <Header />
        <main className="pt-[52px] pb-[60px] min-h-screen overflow-y-auto">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </ProtectedRoute>
  )
}
