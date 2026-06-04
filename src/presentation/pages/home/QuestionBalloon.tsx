// 두근두근 질문함 — 아이 전용 일일 질문 풍선 + 입력 모달
import { useState, useEffect } from 'react'
import { ALL_QUESTIONS } from '@/presentation/pages/settings/QuestionBoxPage'
import { submitAnswer } from '@/infrastructure/firebase/collections/questionAnswers'
import { updateMember } from '@/infrastructure/firebase/collections/members'
import { getLevelFromExp } from '@/domain/services/ExpCalc'
import { recordXPReward } from '@/infrastructure/firebase/collections/rewards'
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
  const { q: question } = ALL_QUESTIONS[idx]

  const [answer, setAnswer]   = useState('')
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
    // 경험치 10 또는 20 랜덤 지급
    const xpAmount = Math.random() < 0.5 ? 10 : 20
    const xpReward = `⭐ 경험치 +${xpAmount}`
    const { success, error: err } = await submitAnswer(familyId, {
      memberId:    member.id,
      memberName:  member.name || member.realName || '',
      questionIdx: idx,
      question,
      answer:      answer.trim(),
      emotion:     null,
      reward:      xpReward,
      dateKey:     getTodayKey(),
    })
    if (success) {
      // XP 실제 적립 (레벨 동시 갱신)
      const newExp   = (member.exp ?? 0) + xpAmount
      const newLevel = getLevelFromExp(newExp)
      await updateMember(familyId, member.id, { exp: newExp, level: newLevel } as any)
      // 보상 페이지에 기록
      await recordXPReward(familyId, member.id, xpAmount, 'xp_question', '두근두근 질문 답변', familyId)
    }
    setSending(false)
    if (!success) { setError(err ?? '저장에 실패했어요. 다시 시도해줘요'); return }
    markDone('answered')
    setDoneReward(xpReward)
  }

  if (doneReward) {
    return <RewardToast reward={doneReward} onDone={onClose} />
  }

  return (
    /* pb-[60px] = BottomNav 높이만큼 위로 띄움 */
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center pb-[60px]">
      <div className="w-full max-w-[428px] bg-panel-dark border-t-4 border-x-4 border-pink
                      animate-slide-up flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* 헤더 */}
        <div className="flex-shrink-0 bg-gradient-to-r from-pink/80 to-purple/80 px-4 py-3
                        flex items-center justify-between border-b-2 border-pink/40">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">💌</span>
            <div>
              <p className="font-korean text-sm font-bold text-white t-pixel-shadow">두근두근 질문함</p>
              <p className="font-korean text-xs text-white/70">오늘 하루 어떤가요?</p>
            </div>
          </div>
          <span className="font-pixel text-[10px] text-pink/80 animate-pulse">❤️ NEW</span>
        </div>

        {/* 스크롤 내용 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {/* 질문 카드 */}
          <div className="bg-pink/10 border-2 border-pink/50 px-4 py-3 relative">
            <div className="absolute -top-2 left-4 text-pink text-lg leading-none">♥</div>
            <p className="font-korean text-base font-bold text-cream leading-snug mt-1">
              {question}
            </p>
            <p className="font-korean text-xs text-gold mt-2">🎁 보상: ⭐ 경험치 +10 또는 +20 (랜덤!)</p>
          </div>

          {/* 답변 입력 */}
          <div className="relative">
            <textarea
              value={answer}
              onChange={e => { setAnswer(e.target.value.slice(0, 300)); setError('') }}
              placeholder="솔직하게 써봐요! (최대 300자)"
              rows={4}
              className="w-full input-pixel font-korean text-sm text-cream
                         px-3 py-2.5 resize-none focus:outline-none focus:border-pink"
            />
            <span className="absolute bottom-2 right-2 font-pixel text-[10px] text-panel-sub">
              {answer.length}/300
            </span>
          </div>

          {error && <p className="font-korean text-xs text-rejected font-bold">{error}</p>}
        </div>

        {/* 버튼 — 항상 보임 */}
        <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-t-2 border-panel-border bg-panel-dark">
          <button type="button" onClick={handleSkip}
            className="flex-1 py-3 bg-panel-darkest border-2 border-panel-border font-korean
                       text-sm text-panel-sub active:scale-95 transition-all">
            오늘은 패스
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={sending || !answer.trim()}
            className="flex-[2] py-3 bg-pink/90 border-2 border-pink font-korean text-base
                       font-bold text-white active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed">
            {sending ? '저장 중...' : '💌 답장 보내기'}
          </button>
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

  // 오늘 이미 완료 → 완료 도장 (버튼 아님, 터치 안 됨)
  if (done) return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5
                    bg-approved/15 border-2 border-approved/50 relative">
      <span className="text-xl leading-none">💌</span>
      <div className="flex flex-col leading-tight">
        <span className="font-pixel text-xs text-approved">DONE</span>
        <span className="font-korean text-[10px] text-approved/60">두근두근</span>
      </div>
      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-approved border-2 border-white
                       flex items-center justify-center font-pixel text-[8px] text-white">
        ✓
      </span>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        title="오늘의 두근두근 질문!"
        className="relative flex items-center gap-1.5 px-2.5 py-1.5
                   bg-pink/20 border-2 border-pink/60 animate-balloon-bob
                   hover:bg-pink/30 active:scale-95 transition-all"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(232,160,191,0.5))' }}
      >
        <span className="text-xl leading-none">💌</span>
        <span className="font-korean text-xs font-bold text-pink">두근두근</span>
        {/* 빨간 점 */}
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rejected
                         border-2 border-white rounded-full animate-pulse" />
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
