// Design Ref: §5.3 SCR-07 MissionFormPage — 미션 생성/수정 (부모 전용) v3.0 dark
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { createMission, notifyNewMission } from '@/application/use-cases/missions/createMission'
import { updateMission } from '@/infrastructure/firebase/collections/missions'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { DIFFICULTY_INFO, CATEGORY_LABELS } from '@/domain/entities/Mission'
import type { MissionType, MissionCategory, Difficulty, RewardType } from '@/domain/entities/Mission'
import type { Member } from '@/domain/entities/Member'

interface RewardField { type: RewardType; amount: number; customLabel?: string }
interface FormData {
  title: string
  description: string
  category: MissionCategory
  type: MissionType
  difficulty: string
  targetMemberIds: string[]
  rewards: RewardField[]
  emoji: string
  startDate: string
  endDate: string
}

const REWARD_TYPES: { type: RewardType; label: string }[] = [
  { type: 'MONEY',      label: '💰 용돈' },
  { type: 'GAME_TIME',  label: '🎮 게임시간' },
  { type: 'PHONE_TIME', label: '📱 핸드폰' },
  { type: 'GIFT',       label: '🎁 선물' },
  { type: 'DINING',     label: '🍕 외식' },
]
const TIME_PRESETS = [10, 20, 30, 60, 90, 120, 180, 240]
const EMOJI_OPTIONS = [
  '⚔️','🧹','📚','💪','🎨','🌿','🏃','🍽️',
  '✏️','🎵','⭐','🌟','🏆','🎯','💡','🔥',
  '🦋','🌈','💫','🎪','🏅','🤸','📝','🍎',
]

// 난이도별 색상 (배경·텍스트·테두리)
const DIFF_COLOR: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-sky',      text: 'text-pixel-dark', border: 'border-blue-400' },
  2: { bg: 'bg-approved', text: 'text-white',       border: 'border-green-700' },
  3: { bg: 'bg-gold',     text: 'text-pixel-dark',  border: 'border-yellow-600' },
  4: { bg: 'bg-hold',     text: 'text-white',       border: 'border-orange-700' },
  5: { bg: 'bg-rejected', text: 'text-white',       border: 'border-red-800' },
}
const DIFF_EMOJI: Record<number, string> = { 1: '🌱', 2: '🍃', 3: '⚡', 4: '🔥', 5: '💥' }
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

// 다크 패널 입력창 공통 클래스 (단일행 — py-3 기준 ~48px)
const INPUT_CLS =
  'w-full bg-panel-darkest border-2 border-panel-border text-cream ' +
  'font-korean text-sm px-3 py-3 focus:outline-none focus:border-gold placeholder:text-stone'

// 다크 패널 textarea 클래스 (다행)
const TEXTAREA_CLS =
  'w-full bg-panel-darkest border-2 border-panel-border text-cream ' +
  'font-korean text-sm px-3 py-2.5 resize-none focus:outline-none focus:border-gold placeholder:text-stone'

// 다크 패널 select 클래스
const SELECT_CLS =
  'bg-panel-darkest border-2 border-panel-border text-cream ' +
  'font-korean text-sm px-2 py-2.5 focus:outline-none focus:border-gold min-h-[44px]'

function toLocalDateStr(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayOfWeekKr(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  return DAY_KR[new Date(y, m - 1, day).getDay()]
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return toLocalDateStr(dt)
}

function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1 + n, d)
  return toLocalDateStr(dt)
}

function generatePeriods(
  startStr: string,
  endStr: string,
  type: MissionType
): Array<{ start: Date; end: Date }> {
  const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
  const startDt = toDate(startStr)
  const endDt   = toDate(endStr)
  if (startDt > endDt) return [{ start: startDt, end: endDt }]
  const periods: { start: Date; end: Date }[] = []
  if (type === 'DAILY') {
    let cur = new Date(startDt)
    while (cur <= endDt) {
      periods.push({ start: new Date(cur), end: new Date(cur) })
      cur.setDate(cur.getDate() + 1)
    }
  } else if (type === 'WEEKLY') {
    let cur = new Date(startDt)
    while (cur <= endDt) {
      const weekEnd = new Date(cur)
      weekEnd.setDate(weekEnd.getDate() + 6)
      periods.push({ start: new Date(cur), end: weekEnd <= endDt ? weekEnd : new Date(endDt) })
      cur.setDate(cur.getDate() + 7)
    }
  } else if (type === 'MONTHLY') {
    let cur = new Date(startDt)
    while (cur <= endDt) {
      const monthEnd = new Date(cur)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(monthEnd.getDate() - 1)
      periods.push({ start: new Date(cur), end: monthEnd <= endDt ? monthEnd : new Date(endDt) })
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    periods.push({ start: startDt, end: endDt })
  }
  return periods
}

function validateForm(data: FormData): string[] {
  const errs: string[] = []
  if (!data.title.trim())                       errs.push('퀘스트 제목을 입력해주세요')
  if (!data.targetMemberIds?.length)            errs.push('대상 구성원을 선택해주세요')
  if (!data.startDate)                          errs.push('시작일을 선택해주세요')
  if (!data.endDate)                            errs.push('종료일을 선택해주세요')
  if (data.startDate && data.endDate &&
      data.startDate > data.endDate)            errs.push('종료일이 시작일보다 빠를 수 없어요')
  const badReward = data.rewards.some(r => {
    if (r.type === 'MONEY'  && (!r.amount || r.amount < 100))   return true
    if ((r.type === 'GIFT' || r.type === 'DINING') && !r.customLabel?.trim()) return true
    return false
  })
  if (badReward) errs.push('보상 정보를 올바르게 입력해주세요 (용돈 100원 이상, 선물/외식은 내용 필요)')
  return errs
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-korean text-sm font-bold text-panel-sub mb-2">{children}</p>
}

export default function MissionFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const isEdit = !!editId
  const { familyId, currentMember } = useAuthStore()
  const { getMissionById } = useMissionStore()
  const existingMission = isEdit ? getMissionById(editId!) : undefined
  const [loading, setLoading]               = useState(false)
  const [validErrors, setValidErrors]       = useState<string[]>([])
  const [childMembers, setChildMembers]     = useState<{ id: string; label: string }[]>([])
  const [parentMemberIds, setParentMemberIds] = useState<string[]>([])
  const [isSpecial, setIsSpecial]           = useState(false)

  useEffect(() => {
    if (!familyId) return
    const unsub = subscribeMembers(familyId, (members: Member[]) => {
      setChildMembers(
        members.filter(m => m.role === 'CHILD').map(m => ({
          id: m.id,
          label: m.name !== m.realName ? `${m.name} (${m.realName})` : m.name,
        }))
      )
      setParentMemberIds(
        members.filter(m => m.role === 'DAD' || m.role === 'MOM').map(m => m.id)
      )
    })
    return unsub
  }, [familyId])

  const today = toLocalDateStr()

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<FormData>({
    defaultValues: {
      category:        'STUDY',
      type:            'DAILY',
      difficulty:      '3',
      targetMemberIds: [],
      rewards:         [{ type: 'MONEY', amount: 500 }],
      startDate:       today,
      endDate:         today,
    },
  })

  // 수정 모드 초기화 — 비즈니스 로직 유지
  useEffect(() => {
    if (!existingMission) return
    setIsSpecial(existingMission.isSpecial ?? false)
    reset({
      title:           existingMission.title,
      description:     existingMission.description ?? '',
      category:        existingMission.category,
      type:            existingMission.type,
      difficulty:      String(existingMission.difficulty),
      targetMemberIds: existingMission.targetMemberIds,
      rewards:         existingMission.rewards.map(r => ({
        type: r.type, amount: r.amount ?? 0, customLabel: r.customLabel ?? '',
      })),
      emoji:           existingMission.emoji ?? '',
      startDate:       toLocalDateStr(existingMission.startDate),
      endDate:         toLocalDateStr(existingMission.endDate),
    })
  }, [existingMission, reset])

  const { fields: rewardFields, append: addReward, remove: removeReward } = useFieldArray({
    control, name: 'rewards',
  })

  const watchedEmoji = watch('emoji')
  const watchedDiff  = watch('difficulty')
  const watchedCat   = watch('category')
  const watchedType  = watch('type')
  const watchedStart = watch('startDate')
  const watchedEnd   = watch('endDate')

  const applyPeriod = (type: MissionType) => {
    setValue('type', type)
    const start = watch('startDate') || today
    if (type === 'DAILY')   setValue('endDate', start)
    if (type === 'WEEKLY')  setValue('endDate', addDays(start, 6))
    if (type === 'MONTHLY') setValue('endDate', addDays(addMonths(start, 1), -1))
  }

  const onSubmit = async (data: FormData) => {
    if (!familyId || !currentMember) return
    const errs = validateForm(data)
    if (errs.length > 0) { setValidErrors(errs); return }
    setValidErrors([])
    setLoading(true)

    const baseFields = {
      description:     data.description || undefined,
      category:        data.category,
      type:            data.type,
      difficulty:      parseInt(data.difficulty) as Difficulty,
      targetMemberIds: data.targetMemberIds,
      rewards:         data.rewards.map(r => {
        const isTextReward = r.type === 'GIFT' || r.type === 'DINING'
        const reward: any = {
          type: r.type,
          amount: isTextReward ? 1 : Number(r.amount),
        }
        if (r.customLabel?.trim()) reward.customLabel = r.customLabel.trim()
        return reward
      }),
      emoji:           data.emoji || undefined,
      isSpecial,
      repeatEnabled:   false,
    }

    try {
      if (isEdit && editId && existingMission) {
        const modEntry = {
          from: existingMission.status, to: existingMission.status,
          changedBy: currentMember.id, changedAt: new Date(), note: '내용 수정',
        }
        const { error } = await updateMission(familyId, editId, {
          ...baseFields,
          title:     data.title,
          startDate: new Date(data.startDate),
          endDate:   new Date(data.endDate),
          statusHistory: [...(existingMission.statusHistory ?? []), modEntry],
        } as any)
        if (error) { setValidErrors([error]); return }
        navigate(`/missions/${editId}`)
      } else {
        const periods = generatePeriods(data.startDate, data.endDate, data.type)
        const results = await Promise.all(
          periods.map(({ start, end }) =>
            createMission({
              familyId,
              creatorId: currentMember.id,
              title:     periods.length > 1
                ? `${data.title} (${toLocalDateStr(start)})`
                : data.title,
              ...baseFields,
              startDate: start,
              endDate:   end,
            })
          )
        )
        const failed = results.find(r => r.error)
        if (failed?.error) { setValidErrors([failed.error]); return }

        const firstId = results.find(r => r.id)?.id
        if (firstId && baseFields.targetMemberIds.length > 0) {
          await notifyNewMission(
            familyId,
            baseFields.targetMemberIds,
            data.title,
            firstId,
            currentMember.name || currentMember.realName || '부모',
            periods.length,
            parentMemberIds,
          )
        }
        navigate('/missions')
      }
    } finally {
      setLoading(false)
    }
  }

  const splitCount = !isEdit
    ? generatePeriods(watchedStart || today, watchedEnd || today, watchedType).length
    : 1

  return (
    <div className="p-3 pb-6">
      <h1 className="t-heading text-gold text-center mb-3 tracking-wide">
        {isEdit ? '퀘스트 수정하기' : '새 퀘스트 만들기'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

        {/* ── 퀘스트 제목 + 내용 ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>퀘스트 제목 *</SectionLabel>
          <input
            {...register('title')}
            placeholder="예: 방 청소하기"
            className={INPUT_CLS}
          />

          <div className="mt-3">
            <SectionLabel>퀘스트 내용</SectionLabel>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="퀘스트 세부 내용을 입력해주세요 (선택)"
              className={TEXTAREA_CLS}
            />
          </div>

          {/* 특별 퀘스트 토글 — PixelButton danger(선택) / ghost(미선택) */}
          <div className="mt-3">
            <PixelButton
              type="button"
              variant={isSpecial ? 'danger' : 'ghost'}
              size="lg"
              fullWidth
              onClick={() => setIsSpecial(p => !p)}
            >
              {isSpecial ? '✨ 특별 퀘스트 (선택됨)' : '✨ 특별 퀘스트로 설정'}
            </PixelButton>
          </div>
          {isSpecial && (
            <p className="font-korean text-xs text-rejected text-center mt-1.5">
              특별 퀘스트는 강조 표시돼요
            </p>
          )}
        </PixelCard>

        {/* ── 카테고리 ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>카테고리</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(CATEGORY_LABELS) as [MissionCategory, string][]).map(([key, label]) => (
              <PixelButton
                key={key}
                type="button"
                variant={watchedCat === key ? 'purple' : 'ghost'}
                size="sm"
                onClick={() => setValue('category', key)}
              >
                {label}
              </PixelButton>
            ))}
          </div>
        </PixelCard>

        {/* ── 난이도 ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>난이도</SectionLabel>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as Difficulty[]).map(d => {
              const c = DIFF_COLOR[d]
              const isSelected = watchedDiff === String(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setValue('difficulty', String(d))}
                  title={DIFFICULTY_INFO[d].label}
                  className={[
                    'flex flex-col items-center justify-center w-11 h-12 transition-all cursor-pointer select-none',
                    c.bg, c.text,
                    isSelected
                      ? `border-4 ${c.border} scale-110 shadow-pixel`
                      : `border-2 ${c.border} opacity-70 hover:opacity-100 hover:scale-105`,
                  ].join(' ')}
                >
                  <span className="text-base leading-none">{DIFF_EMOJI[d]}</span>
                  <span className="font-pixel text-xs mt-0.5">{d}</span>
                </button>
              )
            })}
          </div>
          <p className="font-korean text-xs text-panel-sub mt-1.5 text-center">
            {DIFFICULTY_INFO[parseInt(watchedDiff) as Difficulty]?.label}
          </p>
        </PixelCard>

        {/* ── 대상 구성원 ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>대상 *</SectionLabel>
          {childMembers.length === 0 ? (
            <p className="font-korean text-xs text-panel-sub animate-pulse">구성원 불러오는 중...</p>
          ) : (
            <div className="flex gap-4">
              {childMembers.map(child => (
                <label key={child.id} className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    value={child.id}
                    {...register('targetMemberIds')}
                    className="w-5 h-5 border-2 border-panel-border accent-purple flex-shrink-0"
                  />
                  <span className="font-korean text-sm text-cream">{child.label}</span>
                </label>
              ))}
            </div>
          )}
        </PixelCard>

        {/* ── 보상 ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>보상</SectionLabel>
          {rewardFields.map((field, idx) => {
            const rType  = watch(`rewards.${idx}.type`)
            const isTime  = rType === 'GAME_TIME' || rType === 'PHONE_TIME'
            const isText  = rType === 'GIFT' || rType === 'DINING'
            const isMoney = rType === 'MONEY'
            return (
              <div key={field.id} className="flex gap-2 mb-2 items-center">
                <select
                  {...register(`rewards.${idx}.type`)}
                  className={SELECT_CLS + ' w-28 flex-shrink-0'}
                >
                  {REWARD_TYPES.map(r => (
                    <option key={r.type} value={r.type}>{r.label}</option>
                  ))}
                </select>

                {isMoney && (() => {
                  const amt = (watch(`rewards.${idx}.amount`) as number) || 0
                  return (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="number"
                        step="100"
                        min="100"
                        {...register(`rewards.${idx}.amount`, { valueAsNumber: true })}
                        placeholder="500"
                        className={SELECT_CLS + ' flex-1 min-w-0'}
                      />
                      {amt >= 100 && (
                        <span className="font-korean text-sm text-gold font-bold whitespace-nowrap flex-shrink-0">
                          {amt.toLocaleString('ko-KR')}원
                        </span>
                      )}
                    </div>
                  )
                })()}

                {isTime && (
                  <select
                    {...register(`rewards.${idx}.amount`, { valueAsNumber: true })}
                    className={SELECT_CLS + ' flex-1'}
                  >
                    {TIME_PRESETS.map(m => (
                      <option key={m} value={m}>{m}분</option>
                    ))}
                  </select>
                )}

                {isText && (
                  <input
                    type="text"
                    maxLength={12}
                    {...register(`rewards.${idx}.customLabel`)}
                    placeholder="예: 레고 세트 (12자 이내)"
                    className={SELECT_CLS + ' flex-1 min-w-0'}
                  />
                )}

                {idx > 0 && (
                  <PixelButton
                    type="button"
                    variant="danger"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => removeReward(idx)}
                  >
                    ✕
                  </PixelButton>
                )}
              </div>
            )
          })}
          <PixelButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addReward({ type: 'MONEY', amount: 1000 })}
          >
            + 보상 추가
          </PixelButton>
        </PixelCard>

        {/* ── 기간 + 주기 빠른 선택 ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>기간</SectionLabel>

          {/* 시작일 — 표시 레이어 + transparent input 오버레이 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-korean text-sm text-panel-sub flex-shrink-0 w-8">시작</span>
            <div className="flex-1 relative border-2 border-panel-border bg-panel-darkest overflow-hidden min-h-[44px]">
              <div className="absolute inset-0 flex items-center px-3 pointer-events-none z-0">
                <span className="font-korean text-sm text-cream">
                  {watchedStart ? `${watchedStart}(${dayOfWeekKr(watchedStart)})` : '날짜 선택'}
                </span>
              </div>
              <input
                type="date"
                {...register('startDate')}
                className="relative w-full h-full px-3 py-3 bg-transparent focus:outline-none cursor-pointer z-10"
                style={{ color: 'transparent', caretColor: 'transparent' }}
              />
            </div>
          </div>

          {/* 종료일 */}
          <div className="flex items-center gap-2">
            <span className="font-korean text-sm text-panel-sub flex-shrink-0 w-8">종료</span>
            <div className="flex-1 relative border-2 border-panel-border bg-panel-darkest overflow-hidden min-h-[44px]">
              <div className="absolute inset-0 flex items-center px-3 pointer-events-none z-0">
                <span className="font-korean text-sm text-cream">
                  {watchedEnd ? `${watchedEnd}(${dayOfWeekKr(watchedEnd)})` : '날짜 선택'}
                </span>
              </div>
              <input
                type="date"
                {...register('endDate')}
                className="relative w-full h-full px-3 py-3 bg-transparent focus:outline-none cursor-pointer z-10"
                style={{ color: 'transparent', caretColor: 'transparent' }}
              />
            </div>
          </div>

          {/* 주기 빠른 선택 — PixelButton purple(선택) / ghost(미선택) */}
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {([
              { type: 'DAILY'   as MissionType, label: '일일', desc: '하루씩' },
              { type: 'WEEKLY'  as MissionType, label: '주간', desc: '7일씩' },
              { type: 'MONTHLY' as MissionType, label: '월간', desc: '한 달씩' },
              { type: 'CUSTOM'  as MissionType, label: '임의', desc: '자유설정' },
            ]).map(({ type, label, desc }) => (
              <PixelButton
                key={type}
                type="button"
                variant={watchedType === type ? 'purple' : 'ghost'}
                size="sm"
                fullWidth
                onClick={() => {
                  setValue('type', type)
                  if (type !== 'CUSTOM') applyPeriod(type)
                }}
              >
                {label}
                <span className="block font-korean text-xs opacity-80 mt-0.5">{desc}</span>
              </PixelButton>
            ))}
          </div>

          {/* 분할 생성 미리보기 */}
          {!isEdit && splitCount > 1 && (
            <div className="mt-2 px-3 py-2 bg-purple/10 border border-purple/30">
              <p className="font-korean text-sm text-purple font-bold">
                ⚔️ {splitCount}개의 미션으로 분할 생성돼요
              </p>
              <p className="font-korean text-xs text-panel-sub mt-0.5">
                {watchedType === 'DAILY'   && '각 날짜별로 1개씩 미션이 만들어져요'}
                {watchedType === 'WEEKLY'  && '7일 단위로 나눠서 미션이 만들어져요'}
                {watchedType === 'MONTHLY' && '한 달 단위로 나눠서 미션이 만들어져요'}
              </p>
            </div>
          )}
        </PixelCard>

        {/* ── 이모지 (선택) ── */}
        <PixelCard variant="dark" padding="sm">
          <SectionLabel>이모지 (선택)</SectionLabel>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_OPTIONS.map(e => {
              const isSel = watchedEmoji === e
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setValue('emoji', isSel ? '' : e)}
                  className={[
                    'w-10 h-10 flex items-center justify-center text-lg border-2 transition-all cursor-pointer',
                    isSel
                      ? 'border-4 border-gold bg-gold/20 scale-110 shadow-pixel-sm'
                      : 'border-panel-border bg-panel-darkest hover:border-gold hover:scale-105',
                  ].join(' ')}
                >
                  {e}
                </button>
              )
            })}
          </div>
          {watchedEmoji && (
            <p className="font-korean text-xs text-gold mt-1.5">선택됨: {watchedEmoji}</p>
          )}
        </PixelCard>

        {/* ── 검증 에러 ── */}
        {validErrors.length > 0 && (
          <div className="bg-rejected/10 border-2 border-rejected px-4 py-3">
            <p className="font-korean text-sm font-bold text-rejected mb-1">
              ❌ 다음 항목을 확인해주세요
            </p>
            <ul className="space-y-0.5">
              {validErrors.map((msg, i) => (
                <li key={i} className="font-korean text-xs text-rejected">· {msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── 액션 버튼 영역 (등록 / 수정 / 취소) ── */}
        <div className="space-y-2 pt-1">
          <PixelButton
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
            disabled={loading}
          >
            {loading
              ? (isEdit ? '수정 중...' : `생성 중... (${splitCount}개)`)
              : (isEdit
                  ? '✏️ 퀘스트 수정하기'
                  : splitCount > 1
                    ? `⚔️ 퀘스트 ${splitCount}개 생성하기`
                    : '⚔️ 퀘스트 생성하기')}
          </PixelButton>
          <PixelButton
            type="button"
            variant="ghost"
            size="lg"
            fullWidth
            onClick={() => navigate(-1)}
          >
            취소
          </PixelButton>
        </div>

      </form>
    </div>
  )
}
