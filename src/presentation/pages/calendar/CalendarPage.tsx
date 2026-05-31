// Design Ref: §5.3 SCR-09,10,11 CalendarPage — 마일스톤 3-1 하단 타임라인 추가 (v3.1)
import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { buildCalendarGrid } from '@/presentation/components/calendar/CalendarEmoji'
import { subscribeSpecialDays, type SpecialDayDoc } from '@/infrastructure/firebase/collections/specialDays'

type CalView = 'month' | 'week' | 'day'

const DAYS_KO   = ['일','월','화','수','목','금','토']
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// 일정 타입별 아이콘 (확장 가능)
const SPECIAL_DAY_ICON: Record<string, string> = {
  birthday:    '🎂',
  anniversary: '🎉',
}

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

// 해당 월의 모든 특별일 (날짜순 정렬)
function getSpecialDaysForMonth(year: number, month0: number, docs: SpecialDayDoc[]): (SpecialDayDoc & { day: number })[] {
  return docs
    .filter(d => d.month === month0 + 1)
    .sort((a, b) => a.day - b.day)
}

// 해당 주간의 모든 특별일
function getSpecialDaysForWeek(weekDays: Date[], docs: SpecialDayDoc[]): { date: Date; specials: SpecialDayDoc[] }[] {
  return weekDays
    .map(d => ({ date: d, specials: getSpecialDaysForDate(d, docs) }))
    .filter(x => x.specials.length > 0)
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

// ── 타임라인 리스트 아이템 ────────────────────────────────────────
function TimelineItem({ day, month, doc }: { day: number; month: number; doc: SpecialDayDoc }) {
  const icon = SPECIAL_DAY_ICON[doc.type] ?? doc.emoji
  const today = new Date()
  const isPast = today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() > day)
  return (
    <div className={`flex items-center gap-3 py-2 border-b border-panel-border last:border-0
                     ${isPast ? 'opacity-50' : ''}`}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-korean text-sm font-bold text-cream truncate">{doc.name}</p>
        <p className="font-korean text-xs text-panel-sub">
          {doc.month}월 {doc.day}일{doc.isLunar ? ' (음력)' : ''}
          {doc.type === 'birthday' ? ' · 생일' : ' · 기념일'}
        </p>
      </div>
      <span className="font-pixel text-xs text-gold flex-shrink-0">D-{(() => {
        const thisYear = today.getFullYear()
        const target = new Date(thisYear, doc.month - 1, doc.day)
        if (target < today) target.setFullYear(thisYear + 1)
        const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000)
        return diff === 0 ? 'Day' : diff
      })()}</span>
    </div>
  )
}

// ── 다음 달 미리보기 섹션 ────────────────────────────────────────
function NextMonthPreview({ year, month0, docs }: { year: number; month0: number; docs: SpecialDayDoc[] }) {
  const nextMonth0 = (month0 + 1) % 12
  const nextYear   = month0 === 11 ? year + 1 : year
  const items = getSpecialDaysForMonth(nextYear, nextMonth0, docs)
  if (items.length === 0) return null
  return (
    <div className="card-pixel p-3 mt-3">
      <p className="t-sub text-gold t-pixel-shadow mb-2">
        📅 {nextYear}년 {MONTHS_KO[nextMonth0]} 예고
      </p>
      <div className="space-y-0">
        {items.slice(0, 3).map(s => (
          <TimelineItem key={s.id} day={s.day} month={s.month} doc={s} />
        ))}
        {items.length > 3 && (
          <p className="font-korean text-xs text-panel-sub text-center pt-1">
            ...외 {items.length - 3}건
          </p>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════

export default function CalendarPage() {
  const { currentMember, familyId }             = useAuthStore()
  const [view,          setView]                = useState<CalView>('month')
  const [baseDate,      setBaseDate]            = useState(new Date())
  const [selectedDate,  setSelectedDate]        = useState<Date | null>(null)
  const [sheetOpen,     setSheetOpen]           = useState(false)
  const [specialDayDocs, setSpecialDayDocs]     = useState<SpecialDayDoc[]>([])
  const [showMoreList,  setShowMoreList]        = useState(false)

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

  // 타임라인용 이번 달/주차 일정
  const monthTimeline = useMemo(
    () => getSpecialDaysForMonth(year, month, specialDayDocs),
    [year, month, specialDayDocs]
  )
  const weekTimeline = useMemo(
    () => getSpecialDaysForWeek(weekDays, specialDayDocs),
    [weekDays, specialDayDocs]
  )

  const TIMELINE_LIMIT = 4

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
      <div className="grid grid-cols-7 text-center mb-1">
        {DAYS_KO.map((d, i) => (
          <div key={d} className={`font-korean text-xs font-bold py-1.5
            ${i === 0 ? 'text-rejected' : i === 6 ? 'text-sky' : 'text-panel-sub'}`}>
            {d}
          </div>
        ))}
      </div>
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

  // ── 타임라인 렌더 (월간/주간 공통) ──────────────────────────────
  const renderTimeline = () => {
    if (view === 'day') return null

    if (view === 'month') {
      if (monthTimeline.length === 0) return null
      const visible = monthTimeline.slice(0, TIMELINE_LIMIT)
      const extra   = monthTimeline.length - TIMELINE_LIMIT
      return (
        <div className="card-pixel p-3">
          <p className="t-sub text-gold t-pixel-shadow mb-2">
            📅 {year}년 {MONTHS_KO[month]} 일정 ({monthTimeline.length}건)
          </p>
          <div>
            {visible.map(s => (
              <TimelineItem key={s.id} day={s.day} month={s.month} doc={s} />
            ))}
          </div>
          {extra > 0 && (
            <div className="mt-2">
              <PixelButton variant="ghost" size="sm" fullWidth onClick={() => setShowMoreList(true)}>
                ➕ 더보기 ({extra}건)
              </PixelButton>
            </div>
          )}
        </div>
      )
    }

    // 주간 뷰
    if (view === 'week') {
      if (weekTimeline.length === 0) return null
      const flatItems = weekTimeline.flatMap(w =>
        w.specials.map(s => ({ date: w.date, doc: s }))
      )
      const visible = flatItems.slice(0, TIMELINE_LIMIT)
      const extra   = flatItems.length - TIMELINE_LIMIT
      return (
        <div className="card-pixel p-3">
          <p className="t-sub text-gold t-pixel-shadow mb-2">
            🗓️ 이번 주 일정 ({flatItems.length}건)
          </p>
          <div>
            {visible.map(({ date, doc }, i) => (
              <div key={`${doc.id}-${i}`} className="flex items-center gap-3 py-2 border-b border-panel-border last:border-0">
                <span className="text-xl flex-shrink-0">{doc.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-korean text-sm font-bold text-cream truncate">{doc.name}</p>
                  <p className="font-korean text-xs text-panel-sub">
                    {date.getMonth() + 1}월 {date.getDate()}일 ({DAYS_KO[date.getDay()]})
                  </p>
                </div>
              </div>
            ))}
          </div>
          {extra > 0 && (
            <div className="mt-2">
              <PixelButton variant="ghost" size="sm" fullWidth onClick={() => setShowMoreList(true)}>
                ➕ 더보기 ({extra}건)
              </PixelButton>
            </div>
          )}
        </div>
      )
    }

    return null
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

      {/* ── 하단 타임라인 리스트 ──────────────────────────────── */}
      {renderTimeline()}

      {/* ── 다음 달 미리보기 (월간 뷰만) ──────────────────────── */}
      {view === 'month' && (
        <NextMonthPreview year={year} month0={month} docs={specialDayDocs} />
      )}

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

      {/* ── 더보기 팝업 ─────────────────────────────────────── */}
      <PixelModal
        open={showMoreList}
        title={view === 'month' ? `${MONTHS_KO[month]} 전체 일정` : '이번 주 전체 일정'}
        onClose={() => setShowMoreList(false)}
        size="sm"
      >
        <div className="max-h-72 overflow-y-auto space-y-0">
          {view === 'month'
            ? monthTimeline.map(s => (
                <TimelineItem key={s.id} day={s.day} month={s.month} doc={s} />
              ))
            : weekTimeline.flatMap(w =>
                w.specials.map(s => (
                  <div key={`${s.id}-modal`} className="flex items-center gap-3 py-2 border-b border-panel-border last:border-0">
                    <span className="text-xl">{s.emoji}</span>
                    <div>
                      <p className="font-korean text-sm font-bold text-cream">{s.name}</p>
                      <p className="font-korean text-xs text-panel-sub">
                        {w.date.getMonth()+1}월 {w.date.getDate()}일 ({DAYS_KO[w.date.getDay()]})
                      </p>
                    </div>
                  </div>
                ))
              )
          }
        </div>
      </PixelModal>

    </div>
  )
}
