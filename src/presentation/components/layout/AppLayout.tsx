// Design Ref: §5.2 Layout — 헤더 48px + 콘텐츠(스크롤) + 하단탭 56px 래퍼
// 30분 비활성 자동 로그아웃 포함
import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'
import { useMissions } from '@/presentation/hooks/useMissions'
import { useNotifications } from '@/presentation/hooks/useNotifications'
import { audioManager } from '@/infrastructure/audio/audioManager'

const IDLE_MS = 30 * 60 * 1000  // 30분

export function AppLayout() {
  const { clearSession, currentMember } = useAuthStore()
  const navigate = useNavigate()
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevLevelRef = useRef<number | null>(null)
  const [levelUpFlash, setLevelUpFlash] = useState(false)

  // 전역 구독 — 어느 페이지에 있어도 Firestore 변경사항이 즉시 반영됨
  useMissions()
  useNotifications()

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await signOut()
      clearSession()
      clearAllLocalData()
      navigate('/login', { replace: true })
    }, IDLE_MS)
  }

  // BGM 자동 시작 — 로그인 직후 (startAfterLogin이 이미 호출됐으면 중복 방지됨)
  useEffect(() => {
    if (!currentMember) return
    if (!audioManager.isPlaying()) {
      audioManager.startAfterLogin()
    }
  }, [currentMember?.id])

  // 레벨업 감지 — level이 증가하면 flash 오버레이 2.2초
  useEffect(() => {
    const lv = currentMember?.level ?? null
    if (lv !== null && prevLevelRef.current !== null && lv > prevLevelRef.current) {
      setLevelUpFlash(true)
      setTimeout(() => setLevelUpFlash(false), 2400)
    }
    prevLevelRef.current = lv
  }, [currentMember?.level])

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
      <div className="min-h-screen bg-panel-dark">
        <Header />
        <main className="pt-[52px] pb-[60px] min-h-screen overflow-y-auto">
          <Outlet />
        </main>
        <BottomNav />

        {/* 레벨업 플래시 오버레이 */}
        {levelUpFlash && (
          <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
            <div className="absolute inset-0 bg-gold/30 animate-level-up-flash" />
            <div className="relative flex flex-col items-center gap-3 animate-level-up-text">
              <p className="font-pixel text-4xl text-gold" style={{ textShadow: '3px 3px 0 #000' }}>
                LEVEL UP!
              </p>
              <p className="font-pixel text-base text-cream" style={{ textShadow: '2px 2px 0 #000' }}>
                Lv.{currentMember?.level}
              </p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
