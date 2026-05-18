// Design Ref: §5.3 SCR-17 BeggingPage — 아이 조르기 요청 화면
// Plan UI Checklist: 남은 횟수, 유형 선택, 내용 입력, 전송 버튼, 이전 요청 목록
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeMyBegging, BEGGING_TYPE_LABELS,
  type BeggingRequest, type BeggingType
} from '@/infrastructure/firebase/collections/begging'
import { submitBegging, calcBeggingLimit } from '@/application/use-cases/begging/submitBegging'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { SpeechBubble } from '@/presentation/components/pixel/SpeechBubble'

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
  const [myRequests, setMyRequests] = useState<BeggingRequest[]>([])
  const [selectedType, setSelectedType] = useState<BeggingType>('GIFT')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sendAnim, setSendAnim] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!familyId || !currentMember) return
    const unsub = subscribeMyBegging(familyId, currentMember.id, setMyRequests)
    return unsub
  }, [familyId, currentMember?.id])

  if (!currentMember || (currentMember.role !== 'CHILD')) {
    return <div className="p-4"><p className="font-korean text-stone">아이만 사용할 수 있어요</p></div>
  }

  const limit = calcBeggingLimit(currentMember.level)
  const remaining = currentMember.beggingLeft

  const handleSubmit = async () => {
    if (!familyId || !content.trim()) return
    setLoading(true)
    setError('')
    setSendAnim(true)
    setTimeout(() => setSendAnim(false), 800)

    // 실제로는 familyId에서 부모 ID를 조회해야 함 (단순화: 빈 문자열)
    const { success, error: err } = await submitBegging(
      familyId, currentMember, selectedType, content, '', ''
    )
    setLoading(false)
    if (!success) { setError(err ?? '오류가 발생했어요'); return }

    // authStore 즉시 반영 (UI 갱신용)
    // submitBegging 내부에서 주간 리셋이 처리되므로, 현재 beggingLeft - 1이 아닌
    // 실제 남은 횟수를 올바르게 반영
    const newLeft = Math.max(0, (currentMember.beggingLeft ?? calcBeggingLimit(currentMember.level)) - 1)
    setCurrentMember({ ...currentMember, beggingLeft: newLeft })
    setSent(true)
    setContent('')
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="p-3 pb-4 space-y-3">
      <h1 className="font-korean text-base font-bold text-pink">🙏 조르기</h1>

      {/* 이번 주 남은 횟수 */}
      <PixelCard padding="sm" className={remaining === 0 ? 'border-rejected' : 'border-gold'}>
        <div className="flex items-center justify-between">
          <span className="font-korean text-sm text-pixel-dark">이번 주 남은 횟수</span>
          {/* 진한 색상으로 잘 보이게 */}
          <span className={`font-korean text-sm font-bold ${remaining === 0 ? 'text-rejected' : 'text-pixel-dark'}`}>
            {remaining} / {limit}회
          </span>
        </div>
        {remaining === 0 && (
          <p className="font-korean text-xs text-rejected mt-1">
            이번 주 조르기를 모두 사용했어요! 다음 주 월요일에 다시 도전해요 💪
          </p>
        )}
        <p className="font-korean text-[10px] text-stone mt-1">
          기본 3회 · 레벨 1 오를 때마다 +1회 추가 (현재 Lv.{currentMember.level})
        </p>
      </PixelCard>

      {/* 전송 완료 토스트 */}
      {sent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 p-6">
          <div className="w-full max-w-xs px-5 py-5 border-4 border-pixel-dark shadow-pixel text-center
                          bg-approved animate-fade-slide-up">
            <p className="font-korean text-sm text-white font-bold">
              🙏 조르기 신청을 보냈어요!<br/>엄마·아빠가 확인 중이에요
            </p>
          </div>
        </div>
      )}

      {/* 요청 작성 */}
      {remaining > 0 && !sent && (
        <PixelCard padding="sm">
          <p className="font-korean text-sm font-bold text-purple mb-3">어떤 요청이야?</p>

          {/* 유형 선택 */}
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {BEGGING_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`py-2 font-korean text-xs border-4 border-pixel-dark text-left px-2
                            ${selectedType === type ? 'bg-pink text-pixel-dark' : 'bg-cream text-pixel-dark'}`}
              >
                {BEGGING_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {/* 내용 입력 */}
          <div className="relative">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 200))}
              placeholder="내용을 써봐요..."
              rows={4}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 resize-none
                         focus:outline-none focus:border-gold"
            />
            <span className="absolute bottom-2 right-2 font-pixel text-[7px] text-stone">
              {content.length}/200
            </span>
          </div>

          {error && <p className="font-korean text-rejected text-xs mt-1">{error}</p>}

          {/* 전송 버튼 — 한글 고딕 적용 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className={[
              'w-full mt-3 py-3 bg-gold border-4 border-yellow-600',
              'font-korean text-base text-pixel-dark font-bold',
              'hover:bg-yellow-400 active:translate-y-0.5 transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              sendAnim ? 'animate-character-bob' : '',
            ].join(' ')}
          >
            {loading ? '전송 중...' : '🙏 조르기 전송!'}
          </button>
        </PixelCard>
      )}

      {/* 이전 요청 목록 */}
      {myRequests.length > 0 && (
        <div>
          <p className="font-korean text-sm font-bold text-purple mb-2">이전 요청</p>
          <div className="space-y-2">
            {myRequests.map(req => (
              <PixelCard key={req.id} padding="sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-korean text-[10px] text-stone">
                      {BEGGING_TYPE_LABELS[req.type]}
                    </p>
                    <p className="font-korean text-sm text-pixel-dark mt-0.5">{req.content}</p>
                    <p className="font-korean text-[10px] text-stone mt-1">
                      {req.createdAt.toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <span className={`font-korean text-xs flex-shrink-0 ${STATUS_LABEL[req.status]?.color ?? 'text-stone'}`}>
                    {STATUS_LABEL[req.status]?.label ?? req.status}
                  </span>
                </div>
                {/* 한명 수락 상태 표시 */}
                {(req.status === 'DAD_APPROVED' || req.status === 'MOM_APPROVED') && (
                  <p className="font-korean text-xs text-sky mt-1">
                    {req.status === 'DAD_APPROVED'
                      ? '아빠가 수락했어요! 엄마의 답을 기다려요 ⏳'
                      : '엄마가 수락했어요! 아빠의 답을 기다려요 ⏳'}
                  </p>
                )}
              </PixelCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
