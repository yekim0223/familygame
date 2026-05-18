// Design Ref: §3-9 달력 감정 이모지 — 미션 달성률 기준
import type { Mission } from '@/domain/entities/Mission'

interface DayStats {
  emoji: string
  label: string
  isSpecial?: boolean
  specialLabel?: string
}

export function getDayEmoji(missions: Mission[]): DayStats {
  if (missions.length === 0) return { emoji: '', label: '' }

  const approved = missions.filter(m => m.status === 'APPROVED').length
  const total = missions.length
  const percent = (approved / total) * 100

  if (percent >= 80) return { emoji: '😄', label: '완전 완료!' }   // 80~100%
  if (percent >= 50) return { emoji: '😊', label: '대부분 완료' }  // 50~79%
  if (percent >= 1)  return { emoji: '😐', label: '조금 완료' }    // 1~49%
  return                    { emoji: '😢', label: '미수행' }        // 0%
}

export interface SpecialDay {
  date: Date
  type: 'birthday' | 'anniversary'
  name: string
}

export function getSpecialDay(date: Date, specialDays: SpecialDay[]): SpecialDay | undefined {
  return specialDays.find(s =>
    s.date.getMonth() === date.getMonth() &&
    s.date.getDate() === date.getDate()
  )
}

export function buildCalendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []

  // 첫 날 앞 공백 (일요일=0 기준)
  for (let i = 0; i < first.getDay(); i++) {
    days.push(new Date(year, month, -first.getDay() + i + 1))
  }

  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // 마지막 줄 채우기
  const remain = 7 - (days.length % 7)
  if (remain < 7) {
    for (let i = 1; i <= remain; i++) {
      days.push(new Date(year, month + 1, i))
    }
  }

  return days
}
