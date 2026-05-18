// Design Ref: §5.3 SCR-18 BeggingManagePage — 부모 조르기 관리 화면
// Plan UI Checklist: 요청 목록, 아이 이름, 내용, 수락/거절 버튼
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeAllBegging, reviewBegging, BEGGING_TYPE_LABELS,
  type BeggingRequest
} from '@/infrastructure/firebase/collections/begging'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'

const STATUS_CHIP: Record<string, string> = {
  PENDING:      'bg-hold text-white',
  DAD_APPROVED: 'bg-sky text-white',
  MOM_APPROVED: 'bg-sky text-white',
  APPROVED:     'bg-approved text-white',
  REJECTED:     'bg-rejected text-white',
}

export default function BeggingManagePage() {
  const { familyId, currentMember } = useAuthStore()
  const [requests, setRequests] = useState<BeggingRequest[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (!familyId) return
    const unsub = subscribeAllBegging(familyId, setRequests)
    return unsub
  }, [familyId])

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  if (!isParent) return <div className="p-4"><p className="font-korean text-stone">부모만 사용할 수 있어요</p></div>

  const role = currentMember!.role as 'DAD' | 'MOM'

  const handleReview = async (req: BeggingRequest, action: 'APPROVE' | 'REJECT') => {
    if (!familyId) return
    setProcessing(req.id)

    await reviewBegging(familyId, req.id, role, action, req)

    // 결과 알림 → 요청한 아이에게
    const resultMsg = action === 'APPROVE'
      ? (req.dadApproved || req.momApproved)
        ? '🎉 조르기 요청이 양쪽 모두 승인됐어요!'
        : `${role === 'DAD' ? '아빠' : '엄마'}가 수락했어요! 다른 분의 답을 기다려요 ⏳`
      : '이번에는 거절되었어요 😢 다음에 다시 도전해봐요!'

    await createNotification(familyId, {
      type: 'BEG_RESULT',
      targetMemberId: req.submitterId,
      content: resultMsg,
      relatedId: req.id,
    })

    setProcessing(null)
  }

  // 내가 이미 결정한 요청은 버튼 비활성
  const iAlreadyDecided = (req: BeggingRequest): boolean => {
    if (role === 'DAD') return req.dadApproved || req.status === 'REJECTED'
    return req.momApproved || req.status === 'REJECTED'
  }

  const pending = requests.filter(r => r.status !== 'APPROVED' && r.status !== 'REJECTED')
  const done = requests.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED')

  return (
    <div className="p-3 space-y-3">
      <h1 className="font-pixel text-[9px] text-purple">🙏 조르기 관리</h1>

      {/* 검토 대기 */}
      <div>
        <p className="font-pixel text-[8px] text-gold mb-2">검토 대기 ({pending.length})</p>
        {pending.length === 0 ? (
          <PixelCard padding="sm">
            <p className="font-korean text-xs text-stone text-center py-2">검토할 요청이 없어요 😊</p>
          </PixelCard>
        ) : (
          <div className="space-y-2">
            {pending.map(req => (
              <PixelCard key={req.id} padding="sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-korean text-[10px] text-stone">
                    {BEGGING_TYPE_LABELS[req.type]}
                  </span>
                  <span className={`font-pixel text-[7px] px-1.5 py-0.5 border border-pixel-dark ${STATUS_CHIP[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <p className="font-korean text-sm text-pixel-dark mb-2">{req.content}</p>

                {/* 현재 수락 현황 */}
                <div className="flex gap-2 mb-2 text-[10px] font-korean">
                  <span className={req.dadApproved ? 'text-approved' : 'text-stone'}>
                    아빠 {req.dadApproved ? '✅' : '⏳'}
                  </span>
                  <span className={req.momApproved ? 'text-approved' : 'text-stone'}>
                    엄마 {req.momApproved ? '✅' : '⏳'}
                  </span>
                </div>

                {!iAlreadyDecided(req) ? (
                  <div className="flex gap-2">
                    <PixelButton
                      variant="success" size="sm" fullWidth
                      disabled={processing === req.id}
                      onClick={() => handleReview(req, 'APPROVE')}
                    >
                      ✅ 수락
                    </PixelButton>
                    <PixelButton
                      variant="danger" size="sm" fullWidth
                      disabled={processing === req.id}
                      onClick={() => handleReview(req, 'REJECT')}
                    >
                      ❌ 거절
                    </PixelButton>
                  </div>
                ) : (
                  <p className="font-korean text-xs text-stone">이미 결정했어요</p>
                )}
              </PixelCard>
            ))}
          </div>
        )}
      </div>

      {/* 처리 완료 */}
      {done.length > 0 && (
        <div>
          <p className="font-pixel text-[8px] text-stone mb-2">처리 완료 ({done.length})</p>
          <div className="space-y-2">
            {done.slice(0, 5).map(req => (
              <PixelCard key={req.id} padding="sm" className="opacity-70">
                <div className="flex items-center justify-between">
                  <p className="font-korean text-xs text-pixel-dark">{req.content.slice(0, 30)}...</p>
                  <span className={`font-pixel text-[7px] px-1.5 py-0.5 ${STATUS_CHIP[req.status]}`}>
                    {req.status === 'APPROVED' ? '승인' : '거절'}
                  </span>
                </div>
              </PixelCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
