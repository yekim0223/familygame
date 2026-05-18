// Design Ref: §5.2 Pixel UI — 미션 상태 색상 블록 뱃지
import type { MissionStatus } from '@/domain/entities/Mission'

const STATUS_CONFIG: Record<MissionStatus, { label: string; className: string }> = {
  ACTIVE:            { label: '진행중',   className: 'status-active' },
  PENDING_APPROVAL:  { label: '완료신청', className: 'status-pending' },
  APPROVED:          { label: '승인됨',   className: 'status-approved' },
  ON_HOLD:           { label: '보류중',   className: 'status-hold' },
  REJECTED:          { label: '미승인',   className: 'status-rejected' },
  EXPIRED:           { label: '소멸됨',   className: 'status-expired' },
}

interface StatusBadgeProps {
  status: MissionStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status]
  const textSize = size === 'sm' ? 'text-[8px]' : 'text-[10px]'

  return (
    <span
      className={`inline-block px-2 py-0.5 font-pixel ${textSize} text-white border-2 border-pixel-dark rounded-none ${className}`}
    >
      {label}
    </span>
  )
}
