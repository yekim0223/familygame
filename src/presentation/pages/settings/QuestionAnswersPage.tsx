// 두근두근 질문함 — 부모 관리자 답변 목록 화면 (BeggingManagePage 스타일)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeAllAnswers,
  type QuestionAnswer,
  type QuestionEmotion,
} from '@/infrastructure/firebase/collections/questionAnswers'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'

const EMOTION_LABEL: Record<NonNullable<QuestionEmotion>, { label: string; cls: string }> = {
  LIKE:    { label: '👍 좋아요',  cls: 'text-approved' },
  DISLIKE: { label: '👎 나빠요', cls: 'text-rejected' },
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day:   '2-digit',
    hour:  '2-digit',
    minute:'2-digit',
    hour12: false,
  })
}

export default function QuestionAnswersPage() {
  const navigate = useNavigate()
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
        <p className="font-korean text-stone text-center">부모만 볼 수 있어요</p>
      </div>
    )
  }

  // 자녀 이름 목록 (필터용)
  const childNames = Array.from(new Set(answers.map(a => a.memberName)))

  const filtered = filter === 'ALL'
    ? answers
    : answers.filter(a => a.memberName === filter)

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <button type="button" onClick={() => navigate(-1)}
          className="font-korean text-sm font-bold text-pixel-dark">◀ 뒤로</button>
        <h1 className="font-pixel text-xs text-purple">💌 두근두근 질문함</h1>
      </div>

      {/* 자녀 필터 탭 */}
      {childNames.length > 1 && (
        <div className="flex gap-2">
          {(['ALL', ...childNames] as string[]).map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(name)}
              className={[
                'flex-1 py-2 border-4 font-korean text-sm font-bold transition-all active:translate-y-0.5',
                filter === name
                  ? 'bg-purple text-white border-purple/80'
                  : 'bg-cream text-pixel-dark border-pixel-dark hover:border-purple/60',
              ].join(' ')}
            >
              {name === 'ALL' ? '전체' : name}
            </button>
          ))}
        </div>
      )}

      {/* 최신 답변 목록 */}
      <div>
        <p className="font-pixel text-xs text-gold mb-2">
          최근 답변 ({filtered.length})
        </p>

        {filtered.length === 0 ? (
          <PixelCard padding="sm">
            <p className="font-korean text-xs text-stone text-center py-4">
              아직 작성된 답변이 없어요 💌
            </p>
          </PixelCard>
        ) : (
          <div className="space-y-2">
            {filtered.map(ans => (
              <PixelCard key={ans.id} padding="sm">
                {/* 상단: 작성자 + 시간 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-korean text-xs font-bold text-purple">
                    {ans.memberName}
                  </span>
                  <span className="font-korean text-xs text-stone">
                    {formatDateTime(ans.createdAt)}
                  </span>
                </div>

                {/* 질문 */}
                <div className="bg-purple/10 border-2 border-purple/40 px-3 py-2 mb-2">
                  <p className="font-korean text-xs text-stone mb-0.5">Q. 오늘의 질문</p>
                  <p className="font-korean text-xs font-bold text-pixel-dark leading-snug">
                    {ans.question}
                  </p>
                </div>

                {/* 답변 */}
                <p className="font-korean text-sm text-pixel-dark leading-snug mb-2">
                  {ans.answer}
                </p>

                {/* 하단: 감정 + 보상 */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {ans.emotion ? (
                    <span className={`font-korean text-xs font-bold ${EMOTION_LABEL[ans.emotion].cls}`}>
                      {EMOTION_LABEL[ans.emotion].label}
                    </span>
                  ) : (
                    <span className="font-korean text-xs text-stone">감정 미선택</span>
                  )}
                  <span className="font-korean text-xs text-approved font-bold">
                    보상: {ans.reward}
                  </span>
                </div>
              </PixelCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
