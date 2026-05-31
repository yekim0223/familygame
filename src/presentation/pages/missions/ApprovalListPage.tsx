// Design Ref: §5.3 SCR-08 ApprovalListPage — 미션 승인 관리 (부모 전용)
// Plan UI Checklist: 구성원 이름, 미션명, 신청 시간, 승인/보류/미승인 버튼
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePendingMissions } from '@/presentation/hooks/useMissions'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { approveMission } from '@/application/use-cases/missions/approveMission'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import type { Mission } from '@/domain/entities/Mission'

export default function ApprovalListPage() {
  const navigate = useNavigate()
  const { currentMember, familyId } = useAuthStore()
  const pendingMissions = usePendingMissions()
  const [processing, setProcessing] = useState<string | null>(null)

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  if (!isParent) {
    navigate('/missions')
    return null
  }

  const handleApprove = async (mission: Mission, action: 'APPROVED' | 'ON_HOLD' | 'REJECTED') => {
    if (!familyId || !currentMember) return
    setProcessing(mission.id)
    await approveMission(familyId, mission, action, currentMember.id)
    setProcessing(null)
  }

  return (
    <div className="p-3">
      <h1 className="font-pixel text-xs text-gold mb-3">
        ✅ 승인 대기 ({pendingMissions.length})
      </h1>

      {pendingMissions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">😊</p>
          <p className="font-korean text-sm text-stone">승인 대기 중인 퀘스트가 없어요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingMissions.map(mission => (
            <PixelCard key={mission.id} padding="sm">
              <div className="mb-2">
                <p className="font-korean text-sm font-bold text-pixel-dark">
                  {mission.emoji} {mission.title}
                </p>
                <p className="font-korean text-xs text-stone mt-0.5">
                  완료 신청: {mission.statusHistory[mission.statusHistory.length - 1]?.changedAt?.toLocaleString() ?? '방금'}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mission.rewards.map((r, i) => (
                    <span key={i} className="font-korean text-xs bg-gold/20 border border-gold px-1">
                      {r.type === 'MONEY' ? `💰${r.amount.toLocaleString()}원` :
                       r.type === 'GAME_TIME' ? `🎮${r.amount}분` : '보상'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5">
                <PixelButton
                  variant="success" size="sm" fullWidth
                  disabled={processing === mission.id}
                  onClick={() => handleApprove(mission, 'APPROVED')}
                >
                  ✅ 승인
                </PixelButton>
                <PixelButton
                  variant="ghost" size="sm" fullWidth
                  disabled={processing === mission.id}
                  onClick={() => handleApprove(mission, 'ON_HOLD')}
                >
                  🤔 보류
                </PixelButton>
                <PixelButton
                  variant="danger" size="sm" fullWidth
                  disabled={processing === mission.id}
                  onClick={() => handleApprove(mission, 'REJECTED')}
                >
                  ❌ 미승인
                </PixelButton>
              </div>
            </PixelCard>
          ))}
        </div>
      )}
    </div>
  )
}
