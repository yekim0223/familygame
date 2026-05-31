// Design Ref: §3-4 StatusBadge — 미션 상태 배지 단일 소스 (v3.0)
// MissionCard, MissionDetailPage 등에서 공통 사용
import type { MissionStatus } from '@/domain/entities/Mission'

const LABEL: Record<MissionStatus, string> = {
  ACTIVE:           '진행중',
  PENDING_APPROVAL: '완료신청',
  APPROVED:         '승인됨',
  ON_HOLD:          '보류중',
  REJECTED:         '미승인',
  EXPIRED:          '소멸됨',
  CHILD_REJECTED:   '거절됨',
}

const COLOR: Record<MissionStatus, string> = {
  ACTIVE:           'bg-sky     text-white border-sky',
  PENDING_APPROVAL: 'bg-hold    text-white border-hold',
  APPROVED:         'bg-approved text-white border-approved',
  ON_HOLD:          'bg-hold    text-white border-hold',
  REJECTED:         'bg-rejected text-white border-rejected',
  EXPIRED:          'bg-stone   text-white border-stone',
  CHILD_REJECTED:   'bg-rejected text-white border-rejected',
}

interface StatusBadgeProps {
  status: MissionStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <span
      className={`inline-block font-korean font-bold ${textSize} px-1.5 py-0.5 border-2 ${COLOR[status]}`}
    >
      {LABEL[status]}
    </span>
  )
}
