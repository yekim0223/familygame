import { useAuthStore } from '@/infrastructure/stores/authStore'
import { signOut } from '@/infrastructure/firebase/auth'
import { useNavigate } from 'react-router-dom'

export function useAuth() {
  const { currentMember, familyId, isLoading, clearSession } = useAuthStore()
  const navigate = useNavigate()

  const logout = async () => {
    await signOut()
    clearSession()
    // familyId와 멤버 캐시는 유지 → 로그아웃 후에도 캐릭터 선택 화면 즉시 표시
    localStorage.removeItem('fq_last_login')
    navigate('/login')
  }

  return {
    currentMember,
    familyId,
    isLoading,
    isLoggedIn: !!currentMember,
    logout,
  }
}
