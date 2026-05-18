// Design Ref: §5.3 SCR-09,10,11 CalendarPage — 월간/주간/일간 뷰
import { useState, useMemo, useEffect } from 'react'
import { useMissions } from '@/presentation/hooks/useMissions'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import {
  getDayEmoji, buildCalendarGrid, getSpecialDay,
  type SpecialDay,
} from '@/presentation/components/calendar/CalendarEmoji'
import { subscribeSpecialDays, type SpecialDayDoc } from '@/infrastructure/firebase/collections/specialDays'
import type { Mission, MissionStatus } from '@/domain/entities/Mission'

type CalView = 'month' | 'week' | 'day'

const DAYS_KO   = ['일','월','화','수','목','금','토']
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// 미션 상태 → 텍스트 + 색상
const STATUS_TEXT: Record<MissionStatus, { label: string; cls: string }> = {
  ACTIVE:           { label: '진행중',   cls: 'text-sky font-bold' },
  PENDING_APPROVAL: { label: '완료신청', cls: 'text-hold font-bold' },
  APPROVED:         { label: '완료',     cls: 'text-approved font-bold' },
  ON_HOLD:          { label: '보류',     cls: 'text-hold' },
  REJECTED:         { label: '반려',     cls: 'text-rejected' },
  EXPIRED:          { label: '종료',     cls: 'text-rejected font-bold' },
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
}

function getMissionsForDay(missions: Mission[], date: Date, memberId: string, isParent: boolean) {
  return missions.filter(m => {
    const d0 = new Date(m.startDate); d0.setHours(0,0,0,0)
    const d1 = new Date(m.endDate);   d1.setHours(23,59,59,999)
    const target = isParent || m.targetMemberIds.includes(memberId)
    return target && date >= d0 && date <= d1
  })
}

function getWeekDays(base: Date): Date[] {
  const start = new Date(base)
  start.setDate(base.getDate() - base.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d
  })
}

// 특별일 조회 (월/일만 비교)
function getSpecialDaysForDate(date: Date, docs: SpecialDayDoc[]): SpecialDayDoc[] {
  return docs.filter(d => !d.deleted && d.month === date.getMonth() + 1 && d.day === date.getDate())
}

export default function CalendarPage() {
  const { missions }                           = useMissions()
  const { currentMember, familyId }            = useAuthStore()
  const [view, setView]                        = useState<CalView>('month')
  const [baseDate, setBaseDate]                = useState(new Date())
  const [selectedDate, setSelectedDate]        = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen]              = useState(false)
  const [specialDayDocs, setSpecialDayDocs]    = useState<SpecialDayDoc[]>([])

  useEffect(() => {
    if (!familyId) return
    const unsub = subscribeSpecialDays(familyId, docs =>
      setSpecialDayDocs(docs.filter((d: any) => !d.deleted))
    )
    return unsub
  }, [familyId])

  if (!currentMember) return null

  const isParent = currentMember.role === 'DAD' || currentMember.role === 'MOM'
  const today    = new Date()
  const year     = baseDate.getFullYear()
  const month    = baseDate.getMonth()

  // CalendarEmoji 형식으로 변환 (월간 셀용)
  const specialDays: SpecialDay[] = specialDayDocs.map(d => ({
    date: new Date(2000, d.month - 1, d.day),
    type: d.type === 'birthday' ? 'birthday' : 'anniversary',
    name: `${d.emoji} ${d.name}`,
  }))

  const calendarDays = useMemo(() => buildCalendarGrid(year, month), [year, month])
  const weekDays     = useMemo(() => getWeekDays(baseDate), [baseDate])

  const handlePrev = () => {
    if (view === 'month') setBaseDate(new Date(year, month - 1, 1))
    else if (view === 'week') { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }
    else { const d = new Date(baseDate); d.setDate(d.getDate() - 1); setBaseDate(d) }
  }
  const handleNext = () => {
    if (view === 'month') setBaseDate(new Date(year, month + 1, 1))
    else if (view === 'week') { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }
    else { const d = new Date(baseDate); d.setDate(d.getDate() + 1); setBaseDate(d) }
  }

  const handleDayClick = (date: Date) => { setSelectedDate(date); setSheetOpen(true) }

  // 선택 날짜의 미션 + 특별일
  const selectedMissions    = selectedDate ? getMissionsForDay(missions, selectedDate, currentMember.id, isParent) : []
  const selectedSpecialDays = selectedDate ? getSpecialDaysForDate(selectedDate, specialDayDocs) : []

  // ── 월간 뷰 — 달성률 이모지만 표시 ──────────────────────────────
  const MonthView = () => (
    <div>
      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS_KO.map((d, i) => (
          <div key={d} className={`font-korean text-xs font-bold py-1.5
            ${i === 0 ? 'text-rejected' : i === 6 ? 'text-sky' : 'text-stone'}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-dirt">
        {calendarDays.map((date, idx) => {
          const isCurrentMonth = date.getMonth() === month
          const isToday        = isSameDay(date, today)
          const dayMissions    = getMissionsForDay(missions, date, currentMember.id, isParent)
          const { emoji }      = getDayEmoji(dayMissions)
          const isSat          = date.getDay() === 6
          const isSun          = date.getDay() === 0
          // 특별일이 있으면 날짜 숫자에 작은 점으로 표시
          const hasSpecial     = getSpecialDaysForDate(date, specialDayDocs).length > 0

          return (
            <button
              key={idx}
              onClick={() => handleDayClick(date)}
              className={[
                'relative flex flex-col items-center py-2 min-h-[64px] bg-cream',
                !isCurrentMonth ? 'opacity-30' : '',
                isSat || isSun  ? 'bg-pink/10' : '',
                isToday         ? 'border-2 border-gold' : '',
              ].join(' ')}
            >
              <span className={`font-korean text-xs font-bold leading-tight
                ${isToday ? 'text-gold' : isSun ? 'text-rejected' : isSat ? 'text-sky' : 'text-pixel-dark'}`}>
                {date.getDate()}
              </span>
              {/* 달성률 이모지만 표시 */}
              {emoji && <span className="text-lg leading-none mt-0.5">{emoji}</span>}
              {dayMissions.length > 0 && !emoji && (
                <span className="w-2 h-2 rounded-full bg-purple mt-1" />
              )}
              {/* 특별일: 빨간 콩(●) */}
              {hasSpecial && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rejected" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── 주간 뷰 — 미션 + 특별일 함께 표시 ────────────────────────────
  const WeekView = () => (
    <div>
      <div className="grid grid-cols-7 gap-px bg-dirt">
        {weekDays.map((date, idx) => {
          const isToday      = isSameDay(date, today)
          const dayMissions  = getMissionsForDay(missions, date, currentMember.id, isParent)
          const { emoji }    = getDayEmoji(dayMissions)
          const daySpecials  = getSpecialDaysForDate(date, specialDayDocs)

          return (
            <button
              key={idx}
              onClick={() => handleDayClick(date)}
              className={`flex flex-col items-center p-1.5 bg-cream min-h-[90px]
                ${isToday ? 'border-2 border-gold' : ''}`}
            >
              <span className={`font-korean text-xs font-bold mb-0.5
                ${idx === 0 ? 'text-rejected' : idx === 6 ? 'text-sky' : 'text-stone'}`}>
                {DAYS_KO[idx]}
              </span>
              <span className={`font-korean text-sm font-bold ${isToday ? 'text-gold' : 'text-pixel-dark'}`}>
                {date.getDate()}
              </span>
              {/* 달성률 이모지 */}
              {emoji && <span className="text-base mt-0.5">{emoji}</span>}
              {/* 특별일 이모지 */}
              {daySpecials.map(s => (
                <span key={s.id} className="text-base leading-tight" title={s.name}>{s.emoji}</span>
              ))}
              {/* 미션 진행 바 */}
              <div className="mt-1 space-y-0.5 w-full">
                {dayMissions.slice(0, 2).map(m => (
                  <div key={m.id} className={`w-full h-1
                    ${m.status === 'APPROVED'         ? 'bg-approved' :
                      m.status === 'PENDING_APPROVAL' ? 'bg-hold' :
                      m.status === 'ON_HOLD'          ? 'bg-hold' : 'bg-sky'}`} />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── 일간 뷰 — 특별일 카드 + 미션 목록 ────────────────────────────
  const DayView = () => {
    const dayMissions = getMissionsForDay(missions, baseDate, currentMember.id, isParent)
    const daySpecials = getSpecialDaysForDate(baseDate, specialDayDocs)
    return (
      <div className="space-y-2">
        {/* 특별일 카드 */}
        {daySpecials.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-3 py-2.5
                                     bg-gold/10 border-2 border-gold">
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <p className="font-korean text-sm font-bold text-pixel-dark">{s.name}</p>
              <p className="font-korean text-xs text-stone">
                {s.month}월 {s.day}일{s.isLunar ? ' (음력)' : ''}
              </p>
            </div>
          </div>
        ))}
        {/* 미션 목록 */}
        {dayMissions.length === 0 && daySpecials.length === 0 ? (
          <PixelCard padding="sm">
            <p className="font-korean text-xs text-stone text-center py-2">이 날 일정이 없어요</p>
          </PixelCard>
        ) : dayMissions.map(m => (
          <PixelCard key={m.id} padding="sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-korean text-sm font-bold text-pixel-dark flex-1 min-w-0 truncate">
                {m.emoji} {m.title}
              </p>
              <span className={`font-korean text-xs flex-shrink-0 ${STATUS_TEXT[m.status]?.cls ?? 'text-stone'}`}>
                {STATUS_TEXT[m.status]?.label ?? m.status}
              </span>
            </div>
            <p className="font-korean text-xs text-stone mt-1">
              {m.rewards.map(r =>
                r.type === 'MONEY'     ? `💰${r.amount.toLocaleString()}원` :
                r.type === 'GAME_TIME' ? `🎮${r.amount}분` : '보상'
              ).join(' ')}
            </p>
          </PixelCard>
        ))}
      </div>
    )
  }

  // ── Bottom Sheet ─────────────────────────────────────────────────
  const BottomSheet = () => {
    if (!sheetOpen || !selectedDate) return null
    return (
      <div className="fixed inset-0 z-40" onClick={() => setSheetOpen(false)}>
        <div
          className="absolute bottom-14 left-0 right-0 max-w-[428px] mx-auto
                     bg-cream border-t-4 border-pixel-dark p-4 animate-fade-slide-up"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-korean text-sm font-bold text-purple">
              {selectedDate.getMonth()+1}월 {selectedDate.getDate()}일
            </h3>
            <button type="button" onClick={() => setSheetOpen(false)}
              className="font-korean text-xs text-stone">✕ 닫기</button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* 특별일 항목 */}
            {selectedSpecialDays.map(s => (
              <div key={s.id} className="flex items-center gap-2 py-1.5
                                         bg-gold/10 border border-gold px-2">
                <span className="text-xl">{s.emoji}</span>
                <p className="font-korean text-sm font-bold text-pixel-dark flex-1">{s.name}</p>
                <span className="font-korean text-xs text-gold font-bold flex-shrink-0">
                  {s.month}월 {s.day}일
                </span>
              </div>
            ))}

            {/* 미션 항목 — 우측 네모 박스 제거, 상태텍스트로 */}
            {selectedMissions.map(m => (
              <div key={m.id} className="flex items-center gap-2 py-1.5
                                         border-b border-stone/20 last:border-0">
                <span className="text-base flex-shrink-0">{m.emoji || '⚔️'}</span>
                <p className="font-korean text-sm text-pixel-dark flex-1 min-w-0 truncate">
                  {m.title}
                </p>
                <span className={`font-korean text-xs flex-shrink-0
                  ${STATUS_TEXT[m.status]?.cls ?? 'text-stone'}`}>
                  {STATUS_TEXT[m.status]?.label ?? m.status}
                </span>
              </div>
            ))}

            {selectedMissions.length === 0 && selectedSpecialDays.length === 0 && (
              <p className="font-korean text-xs text-stone text-center py-3">
                이 날 등록된 일정이 없어요
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 pb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={handlePrev}
          className="font-korean font-bold text-gold text-lg px-3 py-1 border-2 border-gold
                     hover:bg-gold/10 active:scale-95 transition-all">
          ‹
        </button>
        <h2 className="font-korean text-base font-bold text-gold">
          {view === 'month'
            ? `${year}년 ${MONTHS_KO[month]}`
            : view === 'week'
            ? `${weekDays[0].getMonth()+1}/${weekDays[0].getDate()} ~ ${weekDays[6].getMonth()+1}/${weekDays[6].getDate()}`
            : `${baseDate.getMonth()+1}월 ${baseDate.getDate()}일`}
        </h2>
        <button type="button" onClick={handleNext}
          className="font-korean font-bold text-gold text-lg px-3 py-1 border-2 border-gold
                     hover:bg-gold/10 active:scale-95 transition-all">
          ›
        </button>
      </div>

      {/* 뷰 전환 탭 */}
      <div className="flex gap-1 mb-3">
        {(['month','week','day'] as CalView[]).map(v => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`flex-1 py-2 font-korean text-sm font-bold border-2 border-pixel-dark
              ${view === v ? 'bg-purple text-white' : 'bg-cream text-pixel-dark'}`}>
            {v === 'month' ? '월간' : v === 'week' ? '주간' : '일간'}
          </button>
        ))}
      </div>

      {/* 달력 뷰 */}
      <PixelCard padding="sm">
        {view === 'month' && <MonthView />}
        {view === 'week'  && <WeekView />}
        {view === 'day'   && <DayView />}
      </PixelCard>

      {/* 하단 시트 */}
      <BottomSheet />

      {/* 범례 */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {[['😄','100%'], ['😊','50~99%'], ['😐','1~49%'], ['😢','미수행']].map(([e, l]) => (
          <span key={e} className="flex items-center gap-1">
            <span className="text-lg">{e}</span>
            <span className="font-korean text-xs font-bold text-white">{l}</span>
          </span>
        ))}
        {/* 특별일 빨간 콩 범례 */}
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-rejected inline-block flex-shrink-0" />
          <span className="font-korean text-xs font-bold text-white">기념일</span>
        </span>
      </div>
    </div>
  )
}
