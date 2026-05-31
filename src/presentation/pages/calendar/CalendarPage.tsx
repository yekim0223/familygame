// Design Ref: §5.3 SCR-09,10,11 CalendarPage — 월간/주간/일간 뷰 (v3.0 MC Dark)
import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { buildCalendarGrid } from '@/presentation/components/calendar/CalendarEmoji'
import { subscribeSpecialDays, type SpecialDayDoc } from '@/infrastructure/firebase/collections/specialDays'

type CalView = 'month' | 'week' | 'day'

const DAYS_KO   = ['일','월','화','수','목','금','토']
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
}

function getWeekDays(base: Date): Date[] {
  const start = new Date(base)
  start.setDate(base.getDate() - base.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d
  })
}

function getSpecialDaysForDate(date: Date, docs: SpecialDayDoc[]): SpecialDayDoc[] {
  return docs.filter(d => d.month === date.getMonth() + 1 && d.day === date.getDate())
}

// ── 특별일 아이템 — speech-bubble 표지판 컨셉 ──────────────────────
function SpecialDayItem({ s, large = false }: { s: SpecialDayDoc; large?: boolean }) {
  return (
    <div className="speech-bubble border-gold flex items-center gap-3">
      <span className={`${large ? 'text-3xl' : 'text-2xl'} flex-shrink-0`}>{s.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="t-heading t-pixel-shadow truncate">{s.name}</p>
        <p className="t-sub mt-0.5">
          {s.month}월 {s.day}일{s.isLunar ? ' (음력)' : ''}
        </p>
        <p className="t-micro text-gold font-bold">
          {s.type === 'birthday' ? '🎂 생일' : '🎉 기념일'}
        </p>
      </div>
    </div>
  )
}

// ── 빈 날 표시 ────────────────────────────────────────────────────
function EmptyDay() {
  return (
    <div className="speech-bubble border-panel-border text-center py-2">
      <p className="t-body text-panel-sub">이 날 특별한 기념일이 없어요 📭</p>
    </div>
  )
}

export default function CalendarPage() {
  const { currentMember, familyId }             = useAuthStore()
  const [view,          setView]                = useState<CalView>('month')
  const [baseDate,      setBaseDate]            = useState(new Date())
  const [selectedDate,  setSelectedDate]        = useState<Date | null>(null)
  const [sheetOpen,     setSheetOpen]           = useState(false)
  const [specialDayDocs, setSpecialDayDocs]     = useState<SpecialDayDoc[]>([])

  useEffect(() => {
    if (!familyId) return
    return subscribeSpecialDays(familyId, setSpecialDayDocs)
  }, [familyId])

  if (!currentMember) return null

  const today = new Date()
  const year  = baseDate.getFullYear()
  const month = baseDate.getMonth()

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

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setSheetOpen(true)
  }

  const selectedSpecialDays = selectedDate
    ? getSpecialDaysForDate(selectedDate, specialDayDocs)
    : []

  const selectedDateLabel = selectedDate
    ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`
    : ''

  // ── 월간 뷰 ──────────────────────────────────────────────────────
  const MonthView = () => (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS_KO.map((d, i) => (
          <div key={d} className={`font-korean text-xs font-bold py-1.5
            ${i === 0 ? 'text-rejected' : i === 6 ? 'text-sky' : 'text-panel-sub'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 — inventory-slot / card-highlight 조건부 바인딩 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, idx) => {
          const isCurrentMonth = date.getMonth() === month
          const isToday        = isSameDay(date, today)
          const isSat          = date.getDay() === 6
          const isSun          = date.getDay() === 0
          const daySpecials    = getSpecialDaysForDate(date, specialDayDocs)
          const hasSpecial     = daySpecials.length > 0

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(date)}
              className={[
                'relative flex flex-col items-center justify-center !w-full !h-auto aspect-square transition-opacity',
                hasSpecial ? 'card-highlight' : 'inventory-slot',
                !isCurrentMonth ? 'opacity-30' : '',
                isToday ? 'ring-2 ring-gold ring-offset-1 ring-offset-panel-dark' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className={[
                't-micro font-bold leading-tight',
                isToday ? '!text-gold' : isSun ? '!text-rejected' : isSat ? '!text-sky' : '!text-cream',
              ].join(' ')}>
                {date.getDate()}
              </span>
              {daySpecials.slice(0, 2).map(s => (
                <span key={s.id} className="text-sm leading-none mt-0.5" title={s.name}>
                  {s.emoji}
                </span>
              ))}
              {daySpecials.length > 2 && (
                <span className="t-micro !text-gold">+{daySpecials.length - 2}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── 주간 뷰 ──────────────────────────────────────────────────────
  const WeekView = () => (
    <div className="grid grid-cols-7 gap-1">
      {weekDays.map((date, idx) => {
        const isToday     = isSameDay(date, today)
        const daySpecials = getSpecialDaysForDate(date, specialDayDocs)
        const hasSpecial  = daySpecials.length > 0

        return (
          <button
            key={idx}
            type="button"
            onClick={() => handleDayClick(date)}
            className={[
              'flex flex-col items-center p-1.5 min-h-[90px] !w-full',
              hasSpecial ? 'card-highlight' : 'inventory-slot',
              isToday ? 'ring-2 ring-gold ring-offset-1 ring-offset-panel-dark' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className={`font-korean text-xs font-bold mb-0.5
              ${idx === 0 ? 'text-rejected' : idx === 6 ? 'text-sky' : 'text-panel-sub'}`}>
              {DAYS_KO[idx]}
            </span>
            <span className={`font-korean text-sm font-bold ${isToday ? 'text-gold' : 'text-cream'}`}>
              {date.getDate()}
            </span>
            {daySpecials.map(s => (
              <span key={s.id} className="text-xl leading-none mt-1" title={s.name}>{s.emoji}</span>
            ))}
            {hasSpecial && (
              <p className="font-korean text-xs text-gold font-bold mt-0.5 text-center leading-tight line-clamp-2">
                {daySpecials[0].name}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )

  // ── 일간 뷰 ──────────────────────────────────────────────────────
  const DayView = () => {
    const daySpecials = getSpecialDaysForDate(baseDate, specialDayDocs)
    return (
      <div className="space-y-2">
        {daySpecials.length === 0
          ? <EmptyDay />
          : daySpecials.map(s => <SpecialDayItem key={s.id} s={s} large />)
        }
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="p-3 pb-4 space-y-3">

      {/* ── 헤더 네비 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <PixelButton variant="ghost" size="sm" onClick={handlePrev}>‹</PixelButton>

        <h2 className="t-title t-pixel-shadow">
          {view === 'month'
            ? `${year}년 ${MONTHS_KO[month]}`
            : view === 'week'
            ? `${weekDays[0].getMonth()+1}/${weekDays[0].getDate()} ~ ${weekDays[6].getMonth()+1}/${weekDays[6].getDate()}`
            : `${baseDate.getMonth()+1}월 ${baseDate.getDate()}일`}
        </h2>

        <PixelButton variant="ghost" size="sm" onClick={handleNext}>›</PixelButton>
      </div>

      {/* ── 뷰 전환 탭 ────────────────────────────────────────── */}
      <div className="flex gap-1">
        {(['month', 'week', 'day'] as CalView[]).map(v => (
          <PixelButton
            key={v}
            variant={view === v ? 'purple' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setView(v)}
          >
            {v === 'month' ? '월간' : v === 'week' ? '주간' : '일간'}
          </PixelButton>
        ))}
      </div>

      {/* ── 달력 본체 ─────────────────────────────────────────── */}
      <div className="card-pixel p-2">
        {view === 'month' && <MonthView />}
        {view === 'week'  && <WeekView />}
        {view === 'day'   && <DayView />}
      </div>

      {/* ── 날짜 상세 팝업 (규칙 3: PixelModal) ──────────────── */}
      <PixelModal
        open={sheetOpen}
        title={selectedDateLabel}
        onClose={() => setSheetOpen(false)}
        size="sm"
      >
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {selectedSpecialDays.length === 0
            ? <EmptyDay />
            : selectedSpecialDays.map(s => <SpecialDayItem key={s.id} s={s} />)
          }
        </div>
      </PixelModal>

    </div>
  )
}
