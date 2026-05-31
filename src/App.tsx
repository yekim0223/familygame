// Design Ref: §5.1 라우팅 구조 (MasterSettings 통합 및 정리 완료)
import { useEffect, useState } from 'react'
import { SplashScreen } from '@/presentation/components/animations/SplashScreen'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/infrastructure/firebase/config'
import { startAnonymousSession, clearAllLocalData } from '@/infrastructure/firebase/auth'
import { AppLayout } from '@/presentation/components/layout/AppLayout'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { getMember } from '@/infrastructure/firebase/collections/members'
import LoginPage from '@/presentation/pages/auth/LoginPage'
import RegisterPage from '@/presentation/pages/auth/RegisterPage'
import ObserverLoginPage from '@/presentation/pages/auth/ObserverLoginPage'
import HomePage from '@/presentation/pages/home/HomePage'
import MissionListPage from '@/presentation/pages/missions/MissionListPage'
import MissionDetailPage from '@/presentation/pages/missions/MissionDetailPage'
import MissionFormPage from '@/presentation/pages/missions/MissionFormPage'
import ApprovalListPage from '@/presentation/pages/missions/ApprovalListPage'
import CalendarPage from '@/presentation/pages/calendar/CalendarPage'
import MessagesPage from '@/presentation/pages/messages/MessagesPage'
import NotificationsPage from '@/presentation/pages/notifications/NotificationsPage'
import BeggingPage from '@/presentation/pages/begging/BeggingPage'
import BeggingManagePage from '@/presentation/pages/begging/BeggingManagePage'
import ProfilePage from '@/presentation/pages/profile/ProfilePage'
import RewardStatusPage from '@/presentation/pages/rewards/RewardStatusPage'
import StatisticsPage from '@/presentation/pages/rewards/StatisticsPage'
import SettingsPage from '@/presentation/pages/settings/SettingsPage'
import QuestionBoxPage from '@/presentation/pages/settings/QuestionBoxPage'
import QuestionAnswersPage from '@/presentation/pages/settings/QuestionAnswersPage'
import SpecialDaysPage from '@/presentation/pages/settings/SpecialDaysPage'
import RewardTypesPage from '@/presentation/pages/settings/RewardTypesPage'
import RewardSendPage from '@/presentation/pages/settings/RewardSendPage'
import NoticesPage from '@/presentation/pages/settings/NoticesPage'
import GamePage from '@/presentation/pages/game/GamePage'

// Phase 3 예정 화면 (플레이스홀더)
const Placeholder = ({ name }: { name: string }) => (
  <div className="p-4">
    <div className="card-pixel p-4 text-center">
      <p className="font-pixel text-[8px] text-purple mb-2">{name}</p>
      <p className="font-korean text-xs text-stone">Phase 3에서 구현 예정</p>
    </div>
  </div>
)

function SessionRestorer() {
  const { setCurrentMember, setFamilyId, setRestoring } = useAuthStore()

  useEffect(() => {
    const familyId = localStorage.getItem('familyId')
    const memberId = localStorage.getItem('fq_last_login')
    if (!familyId || !memberId) { setRestoring(false); return }

    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub() 
      if (!user) {
        const { uid } = await startAnonymousSession()
        if (!uid) { setRestoring(false); return }
      }
      const { data } = await getMember(familyId, memberId)
      if (data) {
        setCurrentMember(data)
        setFamilyId(familyId)
        localStorage.setItem('fq_login_at', Date.now().toString())
      } else {
        clearAllLocalData()
        window.location.replace('/login')
        return
      }
      setRestoring(false)
    })
  }, [])

  return null
}

export default function App() {
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('fq_splash_done') === '1'
  )
  const handleSplashDone = () => {
    sessionStorage.setItem('fq_splash_done', '1')
    setSplashDone(true)
  }

  return (
    <BrowserRouter>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}
      <SessionRestorer />
      <Routes>
        {/* 인증 전 화면 */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/observer-login"  element={<ObserverLoginPage />} />

        {/* 인증 후 화면 (AppLayout 보호) */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home"           element={<HomePage />} />
          <Route path="missions"       element={<MissionListPage />} />
          <Route path="missions/new"   element={<MissionFormPage />} />
          <Route path="missions/:id"   element={<MissionDetailPage />} />
          <Route path="missions/:id/edit" element={<MissionFormPage />} />
          <Route path="approval"       element={<ApprovalListPage />} />
          <Route path="calendar"       element={<CalendarPage />} />
          <Route path="messages"       element={<MessagesPage />} />
          <Route path="notifications"  element={<NotificationsPage />} />
          <Route path="rewards"          element={<RewardStatusPage />} />
          <Route path="history"          element={<Placeholder name="📋 히스토리 (SCR-13)" />} />
          <Route path="statistics"       element={<StatisticsPage />} />
          <Route path="begging"          element={<BeggingPage />} />
          <Route path="begging/manage"   element={<BeggingManagePage />} />
          <Route path="profile"          element={<ProfilePage />} />
          <Route path="settings"                   element={<SettingsPage />} />
          <Route path="settings/questions"         element={<QuestionBoxPage />} />
          <Route path="settings/question-answers" element={<QuestionAnswersPage />} />
          <Route path="settings/special-days"    element={<SpecialDaysPage />} />
          <Route path="settings/reward-types"    element={<RewardTypesPage />} />
          <Route path="settings/rewards-send"   element={<RewardSendPage />} />
          <Route path="settings/notices"        element={<NoticesPage />} />
          <Route path="game"                    element={<GamePage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}