// 두근두근 질문함 — 부모 관리자 답변 목록 화면
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeAllAnswers,
  type QuestionAnswer,
  type QuestionEmotion,
} from '@/infrastructure/firebase/collections/questionAnswers'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'

const EMOTION_LABEL: Record<NonNullable<QuestionEmotion>, { label: string; cls: string }> = {
  LIKE:    { label: '👍 좋아요',  cls: 'text-approved' },
  DISLIKE: { label: '👎 나빠요', cls: 'text-rejected' },
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function QuestionAnswersPage() {
  const { familyId, currentMember } = useAuthStore()
  const [answers, setAnswers] = useState<QuestionAnswer[]>([])
  const [filter, setFilter]   = useState<'ALL' | string>('ALL')

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  useEffect(() => {
    if (!familyId || !isParent) return
    const unsub = subscribeAllAnswers(familyId, setAnswers)
    return unsub
  }, [familyId, isParent])

  if (!isParent) {
    return (
      <div className="p-4">
        <p className="font-korean text-sm text-panel-sub text-center">부모만 볼 수 있어요</p>
      </div>
    )
  }

  const childNames = Array.from(new Set(answers.map(a => a.memberName)))
  const filtered = filter === 'ALL' ? answers : answers.filter(a => a.memberName === filter)

  return (
    <div className="p-3 pb-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">💌</span>
        <h1 className="t-sub font-bold text-gold t-pixel-shadow">두근두근 질문함</h1>
      </div>

      {/* 자녀 필터 탭 */}
      {childNames.length > 1 && (
        <div className="flex gap-2">
          {(['ALL', ...childNames] as string[]).map(name => (
            <PixelButton
              key={name}
              variant={filter === name ? 'purple' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setFilter(name)}
            >
              {name === 'ALL' ? '전체' : name}
            </PixelButton>
          ))}
        </div>
      )}

      {/* 최신 답변 목록 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">📋</span>
        <p className="t-sub font-bold text-gold t-pixel-shadow">최근 답변 ({filtered.length})</p>
      </div>

      {filtered.length === 0 ? (
        <div className="card-pixel p-4 text-center">
          <p className="font-korean text-sm text-panel-sub py-2">아직 작성된 답변이 없어요 💌</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ans => (
            <div key={ans.id} className="card-pixel p-3">
              {/* 상단: 작성자 + 시간 */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-korean text-xs font-bold text-gold">{ans.memberName}</span>
                <span className="font-korean text-xs text-panel-sub">{formatDateTime(ans.createdAt)}</span>
              </div>

              {/* 질문 */}
              <div className="bg-panel-surface border border-panel-border px-3 py-2 mb-2">
                <p className="font-korean text-xs text-panel-sub mb-0.5">Q. 오늘의 질문</p>
                <p className="font-korean text-xs font-bold text-cream leading-snug">{ans.question}</p>
              </div>

              {/* 답변 */}
              <p className="font-korean text-sm text-cream leading-snug mb-2">{ans.answer}</p>

              {/* 하단: 감정 + 보상 */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {ans.emotion ? (
                  <span className={`font-korean text-xs font-bold ${EMOTION_LABEL[ans.emotion].cls}`}>
                    {EMOTION_LABEL[ans.emotion].label}
                  </span>
                ) : (
                  <span className="font-korean text-xs text-panel-sub">감정 미선택</span>
                )}
                <span className="font-korean text-xs text-approved font-bold">보상: {ans.reward}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
