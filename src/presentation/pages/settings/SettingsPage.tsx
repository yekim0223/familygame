// Design Ref: §5.3 SCR-20 SettingsPage — 설정 (부모 전용)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { formatNameWithAge } from '@/domain/services/KoreanAge'
import { signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'
import type { Member } from '@/domain/entities/Member'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { currentMember, familyId, clearSession } = useAuthStore()
  const [members, setMembers] = useState<Member[]>([])
  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  const isDad    = currentMember?.role === 'DAD'

  useEffect(() => {
    if (!familyId) return
    const unsub = subscribeMembers(familyId, setMembers)
    return unsub
  }, [familyId])

  if (!isParent) {
    return (
      <div className="p-4">
        <p className="font-korean text-stone text-center">부모만 볼 수 있어요</p>
      </div>
    )
  }

  const handleLogout = async () => {
    await signOut()
    clearSession()
    clearAllLocalData()
    navigate('/login')
  }

  const btn = 'w-full py-3 bg-gold border-4 border-yellow-600 font-korean text-base font-bold text-pixel-dark hover:bg-yellow-400 active:translate-y-0.5 transition-all shadow-pixel'

  return (
    <div className="p-3 pb-4 space-y-3">
      <h1 className="font-korean text-base font-bold text-gold">⚙️ 설정</h1>

      {/* 가족 구성원 목록 */}
      <PixelCard padding="sm">
        <p className="font-korean text-sm font-bold text-purple mb-3">가족 구성원</p>
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-3">
              <CharacterSprite characterId={member.character.characterId} role={member.role} size="sm" variant="job" />
              <div className="flex-1">
                <p className="font-korean text-sm font-bold text-pixel-dark">
                  {formatNameWithAge(member.name, member.birthDate)}
                </p>
                <p className="font-korean text-xs text-stone">
                  {member.role === 'DAD' ? '아빠' : member.role === 'MOM' ? '엄마' : '자녀'}
                  {member.role === 'CHILD' && ` · Lv.${member.level}`}
                </p>
              </div>
              {isDad && member.id !== currentMember?.id && (
                <span className="font-korean text-xs text-sky cursor-pointer underline font-bold"
                  onClick={() => navigate('/settings/master')}>관리</span>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="font-korean text-xs text-stone text-center py-2">구성원을 불러오는 중...</p>
          )}
        </div>
      </PixelCard>

      {/* 아빠 전용: 마스터 관리자 패널 */}
      {isDad && (
        <button type="button" onClick={() => navigate('/settings/master')} className={btn}>
          🛠️ 마스터 관리자 패널
        </button>
      )}

      {/* 아이들 보상주기 (엄마/아빠 공통) */}
      <button type="button" onClick={() => navigate('/settings/rewards-send')} className={btn}>
        🎁 아이들 보상주기
      </button>

      {/* 조르기 관리 */}
      <button type="button" onClick={() => navigate('/begging/manage')} className={btn}>
        조르기 요청 관리
      </button>

      {/* 두근두근 질문함 */}
      <button type="button" onClick={() => navigate('/settings/question-answers')} className={btn}>
        두근두근 질문함
      </button>

      {/* 기념일·생일 관리 */}
      <button type="button" onClick={() => navigate('/settings/special-days')} className={btn}>
        기념일·생일 관리
      </button>

      {/* 공지사항 관리 (엄마/아빠 공통) */}
      <button type="button" onClick={() => navigate('/settings/notices')} className={btn}>
        📢 공지사항 관리
      </button>

      {/* 통계 */}
      <button type="button" onClick={() => navigate('/statistics')} className={btn}>
        통계 보기
      </button>

      {/* 로그아웃 */}
      <button type="button" onClick={handleLogout}
        className="w-full py-3 bg-rejected border-4 border-red-800 font-korean text-base
                   font-bold text-white hover:bg-red-600 active:translate-y-0.5 transition-all shadow-pixel">
        로그아웃
      </button>
    </div>
  )
}
