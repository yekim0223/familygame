// Design Ref: §5.3 SCR-18 BeggingManagePage — 부모 조르기 관리 화면 (v3.0 MC Dark)
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeAllBegging, reviewBegging, BEGGING_TYPE_LABELS,
  type BeggingRequest
} from '@/infrastructure/firebase/collections/begging'
import { createNotification } from '@/infrastructure/firebase/collections/notifications'
import { sendManualReward } from '@/infrastructure/firebase/collections/rewards'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'

const STATUS_CHIP: Record<string, string> = {
  PENDING:      'bg-hold text-white border-hold',
  DAD_APPROVED: 'bg-sky text-white border-sky',
  MOM_APPROVED: 'bg-sky text-white border-sky',
  APPROVED:     'bg-approved text-white border-approved',
  REJECTED:     'bg-rejected text-white border-rejected',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:      '검토 대기',
  DAD_APPROVED: '아빠 수락',
  MOM_APPROVED: '엄마 수락',
  APPROVED:     '승인됨',
  REJECTED:     '거절됨',
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
  if (!isParent) {
    return (
      <div className="p-4">
        <p className="font-korean text-sm text-panel-sub text-center">부모만 사용할 수 있어요</p>
      </div>
    )
  }

  const role = currentMember!.role as 'DAD' | 'MOM'

  const handleReview = async (req: BeggingRequest, action: 'APPROVE' | 'REJECT') => {
    if (!familyId) return
    setProcessing(req.id)

    const newDadApproved = role === 'DAD' ? true : req.dadApproved
    const newMomApproved = role === 'MOM' ? true : req.momApproved
    const isFinalApproval = action === 'APPROVE' && newDadApproved && newMomApproved

    await reviewBegging(familyId, req.id, role, action, req)

    if (isFinalApproval && currentMember) {
      await sendManualReward(
        familyId, req.submitterId, currentMember.id,
        'CUSTOM', 1,
        `[조르기] ${req.content.slice(0, 30)}`
      )
    }

    const resultMsg = action === 'APPROVE'
      ? isFinalApproval
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

  const iAlreadyDecided = (req: BeggingRequest): boolean => {
    if (role === 'DAD') return req.dadApproved || req.status === 'REJECTED'
    return req.momApproved || req.status === 'REJECTED'
  }

  const pending = requests.filter(r => r.status !== 'APPROVED' && r.status !== 'REJECTED')
  const done    = requests.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED')

  return (
    <div className="p-3 pb-4 space-y-4">
      <h1 className="t-heading text-gold t-pixel-shadow">🙏 조르기 관리</h1>

      {/* ── 검토 대기 ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="t-sub font-bold text-gold">검토 대기 ({pending.length})</p>
        {pending.length === 0 ? (
          <div className="card-pixel p-4 text-center">
            <p className="t-sub text-panel-sub">검토할 요청이 없어요 😊</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(req => (
              <div key={req.id} className="card-pixel p-3 space-y-2">
                {/* 헤더 — 타입 + 상태 배지 */}
                <div className="flex items-center justify-between">
                  <span className="t-sub font-bold text-cream">
                    {BEGGING_TYPE_LABELS[req.type]}
                  </span>
                  <span className={`font-korean text-xs font-bold px-1.5 py-0.5 border ${STATUS_CHIP[req.status] ?? 'bg-panel-mid text-cream border-panel-border'}`}>
                    {STATUS_LABEL[req.status] ?? req.status}
                  </span>
                </div>

                {/* 내용 */}
                <p className="t-body text-cream">{req.content}</p>

                {/* 수락 현황 */}
                <div className="flex gap-3">
                  <span className={`font-korean text-xs font-bold ${req.dadApproved ? 'text-approved' : 'text-panel-sub'}`}>
                    아빠 {req.dadApproved ? '✅' : '⏳'}
                  </span>
                  <span className={`font-korean text-xs font-bold ${req.momApproved ? 'text-approved' : 'text-panel-sub'}`}>
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
                  <p className="t-micro text-panel-sub">이미 결정했어요</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 처리 완료 ──────────────────────────────────────────────── */}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="t-sub font-bold text-panel-sub">처리 완료 ({done.length})</p>
          <div className="space-y-2">
            {done.slice(0, 5).map(req => (
              <div key={req.id} className="card-pixel p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <p className="t-sub text-cream truncate flex-1 mr-2">{req.content.slice(0, 30)}…</p>
                  <span className={`font-korean text-xs font-bold px-1.5 py-0.5 border flex-shrink-0 ${STATUS_CHIP[req.status] ?? 'bg-panel-mid text-cream border-panel-border'}`}>
                    {req.status === 'APPROVED' ? '승인' : '거절'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
