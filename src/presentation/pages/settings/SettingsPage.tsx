// Design Ref: §5.3 SCR-20 SettingsPage — 설정 (부모 전용) (v3.0 MC Dark)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
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
        <p className="font-korean text-sm text-panel-sub text-center">부모만 볼 수 있어요</p>
      </div>
    )
  }

  const handleLogout = async () => {
    await signOut()
    clearSession()
    clearAllLocalData()
    navigate('/login')
  }

  return (
    <div className="p-3 pb-4 space-y-3">
      <h1 className="t-heading text-gold t-pixel-shadow">⚙️ 설정</h1>

      {/* ── 가족 구성원 목록 ────────────────────────────────────────── */}
      <div className="card-pixel p-3">
        <p className="t-sub font-bold text-gold mb-3">가족 구성원</p>
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-3">
              <CharacterSprite
                characterId={member.character.characterId}
                role={member.role}
                size="sm"
                variant="job"
              />
              <div className="flex-1">
                <p className="t-sub font-bold text-cream">
                  {formatNameWithAge(member.name, member.birthDate)}
                </p>
                <p className="t-micro text-panel-sub">
                  {member.role === 'DAD' ? '아빠' : member.role === 'MOM' ? '엄마' : '자녀'}
                  {member.role === 'CHILD' && ` · Lv.${member.level}`}
                </p>
              </div>
              {isDad && member.id !== currentMember?.id && (
                <PixelButton
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/settings/master')}
                >
                  관리
                </PixelButton>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="t-micro text-panel-sub text-center py-2">구성원을 불러오는 중...</p>
          )}
        </div>
      </div>

      {/* ── 아빠 전용: 마스터 관리자 패널 ──────────────────────────── */}
      {isDad && (
        <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/master')}>
          🛠️ 마스터 관리자 패널
        </PixelButton>
      )}

      {/* ── 공통 메뉴 ───────────────────────────────────────────────── */}
      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/rewards-send')}>
        🎁 아이들 보상주기
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/begging/manage')}>
        🙏 조르기 요청 관리
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/question-answers')}>
        💌 두근두근 질문함
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/special-days')}>
        📅 기념일·생일 관리
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/notices')}>
        📢 공지사항 관리
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/statistics')}>
        📊 통계 보기
      </PixelButton>

      {/* ── 로그아웃 ────────────────────────────────────────────────── */}
      <div className="pt-2">
        <PixelButton variant="danger" size="lg" fullWidth onClick={handleLogout}>
          로그아웃
        </PixelButton>
      </div>
    </div>
  )
}
