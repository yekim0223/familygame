// 두근두근 질문함 — 아이 전용 일일 질문 풍선 + 입력 모달
import { useState, useEffect } from 'react'
import { ALL_QUESTIONS } from '@/presentation/pages/settings/QuestionBoxPage'
import { submitAnswer, type QuestionEmotion } from '@/infrastructure/firebase/collections/questionAnswers'
import type { Member } from '@/domain/entities/Member'

// 오늘 dateKey (yyyy-mm-dd)
function getTodayKey(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

// 날짜 기반 시드로 오늘 질문 인덱스 결정 (같은 날 항상 동일)
function getTodayQuestionIdx(): number {
  const dateKey = getTodayKey()
  let h = 0
  for (let i = 0; i < dateKey.length; i++) h = ((h << 5) - h + dateKey.charCodeAt(i)) | 0
  return Math.abs(h) % ALL_QUESTIONS.length
}

function lsKey(memberId: string) {
  return `fq_q_done_${memberId}_${getTodayKey()}`
}

// 오늘 이미 완료(answered) 또는 건너뜀(skipped) 여부
export function isTodayQuestionDone(memberId: string): boolean {
  return !!localStorage.getItem(lsKey(memberId))
}

// ── 보상 토스트 ─────────────────────────────────────────────────────
function RewardToast({ reward, onDone }: { reward: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 p-6">
      <div className="w-full max-w-xs px-5 py-5 border-4 border-pixel-dark shadow-pixel text-center
                      bg-approved animate-fade-slide-up">
        <p className="font-korean text-base font-bold text-white mb-1">🎉 오늘의 보상!</p>
        <p className="font-korean text-xl font-bold text-gold">{reward}</p>
        <p className="font-korean text-xs text-white/80 mt-1">
          질문에 답해줘서 고마워요 ❤️
        </p>
      </div>
    </div>
  )
}

// ── 질문 입력 모달 ──────────────────────────────────────────────────
function QuestionModal({
  member,
  familyId,
  onClose,
}: {
  member: Member
  familyId: string
  onClose: () => void
}) {
  const idx = getTodayQuestionIdx()
  const { q: question, reward } = ALL_QUESTIONS[idx]

  const [answer, setAnswer]   = useState('')
  const [emotion, setEmotion] = useState<QuestionEmotion>(null)
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')
  const [doneReward, setDoneReward] = useState<string | null>(null)

  const markDone = (type: 'answered' | 'skipped') => {
    localStorage.setItem(lsKey(member.id), type)
  }

  const handleSkip = () => {
    markDone('skipped')
    onClose()
  }

  const handleSubmit = async () => {
    if (!answer.trim()) { setError('답변을 입력해줘요!'); return }
    setSending(true)
    const { success, error: err } = await submitAnswer(familyId, {
      memberId:    member.id,
      memberName:  member.name || member.realName || '',
      questionIdx: idx,
      question,
      answer:      answer.trim(),
      emotion,
      reward,
      dateKey:     getTodayKey(),
    })
    setSending(false)
    if (!success) { setError(err ?? '저장에 실패했어요. 다시 시도해줘요'); return }
    markDone('answered')
    setDoneReward(reward)
  }

  if (doneReward) {
    return <RewardToast reward={doneReward} onDone={onClose} />
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-0">
      <div className="w-full max-w-[428px] bg-cream border-t-4 border-x-4 border-pixel-dark
                      shadow-pixel rounded-t-none animate-slide-up">

        {/* 헤더 */}
        <div className="bg-purple px-4 py-3 flex items-center justify-between border-b-4 border-pixel-dark">
          <div className="flex items-center gap-2">
            <span className="text-xl">💌</span>
            <span className="font-korean text-sm font-bold text-white">두근두근 질문함</span>
          </div>
          <span className="font-korean text-xs text-white/70">오늘의 질문</span>
        </div>

        <div className="p-4 space-y-4">
          {/* 질문 */}
          <div className="bg-purple/10 border-4 border-purple px-4 py-3">
            <p className="font-korean text-base font-bold text-pixel-dark leading-snug">
              ❓ {question}
            </p>
            <p className="font-korean text-[10px] text-approved mt-2 font-bold">
              정답 보상: {reward}
            </p>
          </div>

          {/* 답변 입력 */}
          <div className="relative">
            <textarea
              value={answer}
              onChange={e => { setAnswer(e.target.value.slice(0, 300)); setError('') }}
              placeholder="솔직하게 써봐요! (최대 300자)"
              rows={4}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 resize-none
                         focus:outline-none focus:border-gold"
            />
            <span className="absolute bottom-2 right-2 font-pixel text-[7px] text-stone">
              {answer.length}/300
            </span>
          </div>

          {/* 감정 선택 (선택) */}
          <div>
            <p className="font-korean text-xs text-stone mb-2">이 질문 어때? (선택)</p>
            <div className="flex gap-3">
              {([
                { val: 'LIKE',    label: '👍 좋아요!',  cls: 'bg-approved text-white border-green-700' },
                { val: 'DISLIKE', label: '👎 나빠요',   cls: 'bg-rejected text-white border-red-700' },
              ] as const).map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setEmotion(prev => prev === item.val ? null : item.val)}
                  className={[
                    'flex-1 py-2 border-4 font-korean text-sm font-bold transition-all active:translate-y-0.5',
                    emotion === item.val
                      ? item.cls
                      : 'bg-cream border-pixel-dark text-pixel-dark',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="font-korean text-xs text-rejected font-bold">{error}</p>}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 py-3 bg-stone/20 border-4 border-stone font-korean text-sm
                         font-bold text-pixel-dark hover:bg-stone/30 active:translate-y-0.5 transition-all"
            >
              오늘은 안쓸게
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending || !answer.trim()}
              className="flex-[2] py-3 bg-gold border-4 border-yellow-600 font-korean text-base
                         font-bold text-pixel-dark hover:bg-yellow-400 active:translate-y-0.5 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '저장 중...' : '✏️ 작성완료!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 메인 export: 풍선 버튼 (프로필 카드 내 삽입) ────────────────────
export function QuestionBalloonButton({
  member,
  familyId,
}: {
  member: Member
  familyId: string
}) {
  const [done, setDone]         = useState(() => isTodayQuestionDone(member.id))
  const [showModal, setShowModal] = useState(false)

  if (done) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        title="오늘의 두근두근 질문!"
        className="relative w-9 h-9 flex items-center justify-center
                   text-xl animate-balloon-bob flex-shrink-0"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
      >
        📝
        {/* 빨간 점 */}
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rejected
                         border-2 border-white rounded-full" />
      </button>

      {showModal && (
        <QuestionModal
          member={member}
          familyId={familyId}
          onClose={() => { setShowModal(false); setDone(isTodayQuestionDone(member.id)) }}
        />
      )}
    </>
  )
}
