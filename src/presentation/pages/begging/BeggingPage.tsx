// Design Ref: §5.3 SCR-17 BeggingPage — 아이 조르기 요청 화면 (v3.0 MC Dark)
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeMyBegging, BEGGING_TYPE_LABELS,
  type BeggingRequest, type BeggingType
} from '@/infrastructure/firebase/collections/begging'
import { submitBegging, calcBeggingLimit } from '@/application/use-cases/begging/submitBegging'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:      { label: '⏳ 검토 중', color: 'text-hold' },
  DAD_APPROVED: { label: '✅ 아빠 수락 (엄마 대기)', color: 'text-sky' },
  MOM_APPROVED: { label: '✅ 엄마 수락 (아빠 대기)', color: 'text-sky' },
  APPROVED:     { label: '🎉 승인됨!', color: 'text-approved' },
  REJECTED:     { label: '😢 거절됨', color: 'text-rejected' },
}

const BEGGING_TYPES: BeggingType[] = ['MISSION_ADD', 'REWARD_UP', 'GIFT', 'SPECIAL']

export default function BeggingPage() {
  const { familyId, currentMember, setCurrentMember } = useAuthStore()
  const [myRequests,    setMyRequests]    = useState<BeggingRequest[]>([])
  const [selectedType,  setSelectedType]  = useState<BeggingType>('GIFT')
  const [content,       setContent]       = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [sentModal,     setSentModal]     = useState(false)

  useEffect(() => {
    if (!familyId || !currentMember) return
    const unsub = subscribeMyBegging(familyId, currentMember.id, setMyRequests)
    return unsub
  }, [familyId, currentMember?.id])

  if (!currentMember || currentMember.role !== 'CHILD') {
    return (
      <div className="p-4">
        <p className="font-korean text-sm text-panel-sub text-center">아이만 사용할 수 있어요</p>
      </div>
    )
  }

  const limit     = calcBeggingLimit(currentMember.level)
  const remaining = currentMember.beggingLeft

  const handleSubmit = async () => {
    if (!familyId || !content.trim()) return
    setLoading(true)
    setError('')
    const { success, error: err } = await submitBegging(
      familyId, currentMember, selectedType, content, '', ''
    )
    setLoading(false)
    if (!success) { setError(err ?? '오류가 발생했어요'); return }
    const newLeft = Math.max(0, (currentMember.beggingLeft ?? calcBeggingLimit(currentMember.level)) - 1)
    setCurrentMember({ ...currentMember, beggingLeft: newLeft })
    setSentModal(true)
    setContent('')
  }

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* 전송 완료 팝업 — 규칙 3: PixelModal 사용 */}
      <PixelModal
        open={sentModal}
        title="🙏 조르기 전송 완료"
        onClose={() => setSentModal(false)}
        size="sm"
      >
        <p className="font-korean text-sm text-cream text-center mb-1">
          조르기 신청을 보냈어요!
        </p>
        <p className="font-korean text-xs text-panel-sub text-center mb-5">
          엄마·아빠가 확인 중이에요 ⏳
        </p>
        <PixelButton variant="gold" size="md" fullWidth onClick={() => setSentModal(false)}>
          확인
        </PixelButton>
      </PixelModal>

      <h1 className="t-heading text-pink t-pixel-shadow">🙏 조르기</h1>

      {/* ── 이번 주 남은 횟수 카드 ──────────────────────────────── */}
      <div className={`card-pixel p-3 ${remaining === 0 ? 'border-rejected' : 'border-gold'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="t-sub font-bold text-cream">이번 주 남은 횟수</span>
          <span className={`t-sub font-bold ${remaining === 0 ? 'text-rejected' : 'text-gold'}`}>
            {remaining} / {limit}회
          </span>
        </div>
        {remaining === 0 && (
          <p className="t-micro text-rejected mt-1">
            이번 주 조르기를 모두 사용했어요! 다음 주 월요일에 다시 도전해요 💪
          </p>
        )}
        <p className="t-micro text-panel-sub mt-1">
          기본 3회 · 레벨 1 오를 때마다 +1회 추가 (현재 Lv.{currentMember.level})
        </p>
      </div>

      {/* ── 요청 작성 폼 ─────────────────────────────────────────── */}
      {remaining > 0 && !sentModal && (
        <div className="card-pixel p-3 space-y-3">
          <p className="t-sub font-bold text-gold">어떤 요청이야?</p>

          {/* 유형 선택 — PixelButton 격자 */}
          <div className="grid grid-cols-2 gap-1.5">
            {BEGGING_TYPES.map(type => (
              <PixelButton
                key={type}
                variant={selectedType === type ? 'purple' : 'ghost'}
                size="sm"
                onClick={() => setSelectedType(type)}
              >
                {BEGGING_TYPE_LABELS[type]}
              </PixelButton>
            ))}
          </div>

          {/* 내용 입력 */}
          <div className="relative">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 200))}
              placeholder="내용을 써봐요..."
              rows={4}
              className="input-pixel w-full resize-none pt-2.5"
            />
            <span className="absolute bottom-2 right-2 font-pixel text-xs text-panel-sub">
              {content.length}/200
            </span>
          </div>

          {error && <p className="font-korean text-xs text-rejected font-bold">{error}</p>}

          <PixelButton
            variant="gold"
            size="lg"
            fullWidth
            disabled={loading || !content.trim()}
            onClick={handleSubmit}
          >
            {loading ? '전송 중...' : '🙏 조르기 전송!'}
          </PixelButton>
        </div>
      )}

      {/* ── 이전 요청 목록 ───────────────────────────────────────── */}
      {myRequests.length > 0 && (
        <div className="space-y-2">
          <p className="t-sub font-bold text-gold">이전 요청</p>
          <div className="space-y-2">
            {myRequests.map(req => (
              <div key={req.id} className="card-pixel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="t-micro text-panel-sub">
                      {BEGGING_TYPE_LABELS[req.type]}
                    </p>
                    <p className="t-body text-cream mt-0.5">{req.content}</p>
                    <p className="t-micro text-panel-sub mt-1">
                      {req.createdAt.toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <span className={`font-korean text-xs font-bold flex-shrink-0 ${STATUS_LABEL[req.status]?.color ?? 'text-panel-sub'}`}>
                    {STATUS_LABEL[req.status]?.label ?? req.status}
                  </span>
                </div>
                {(req.status === 'DAD_APPROVED' || req.status === 'MOM_APPROVED') && (
                  <p className="font-korean text-xs text-sky mt-1">
                    {req.status === 'DAD_APPROVED'
                      ? '아빠가 수락했어요! 엄마의 답을 기다려요 ⏳'
                      : '엄마가 수락했어요! 아빠의 답을 기다려요 ⏳'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
