// Design Ref: §5.3 MissionListPage — 미션 카드 컴포넌트
import { Link } from 'react-router-dom'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { DIFFICULTY_INFO, CATEGORY_LABELS } from '@/domain/entities/Mission'
import type { Mission, MissionStatus } from '@/domain/entities/Mission'

interface MissionCardProps {
  mission: Mission
  onFavoriteToggle?: (id: string, current: boolean) => void
}

function getDaysLeft(endDate: Date): string {
  const diff = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return '기간 종료'
  if (diff === 0) return '오늘 마감!'
  return `D-${diff}`
}

function formatRewards(mission: Mission): string {
  return mission.rewards.map(r => {
    if (r.type === 'MONEY')      return `💰${(r.amount || 0).toLocaleString('ko-KR')}원`
    if (r.type === 'GAME_TIME')  return `🎮${r.amount}분`
    if (r.type === 'PHONE_TIME') return `📱${r.amount}분`
    if (r.type === 'GIFT')       return `🎁${r.customLabel || '선물'}`
    if (r.type === 'DINING')     return `🍕${r.customLabel || '외식'}`
    return `⭐${r.customLabel ?? '특별 보상'}`
  }).join(' ')
}

// 상태별 텍스트 + 색상
const STATUS_INFO: Record<MissionStatus, { label: string; color: string }> = {
  ACTIVE:           { label: '진행중',   color: 'text-approved' },
  PENDING_APPROVAL: { label: '완료신청', color: 'text-sky' },
  ON_HOLD:          { label: '보류중',   color: 'text-hold' },
  APPROVED:         { label: '승인됨',   color: 'text-purple' },
  REJECTED:         { label: '미승인',   color: 'text-rejected' },
  EXPIRED:          { label: '종료됨',   color: 'text-rejected' },
  CHILD_REJECTED:   { label: '거절됨',   color: 'text-rejected' },
}

export function MissionCard({ mission, onFavoriteToggle }: MissionCardProps) {
  const diffInfo = DIFFICULTY_INFO[mission.difficulty]
  const daysLeft  = getDaysLeft(mission.endDate)
  const statusInfo = STATUS_INFO[mission.status]

  return (
    <Link to={`/missions/${mission.id}`}>
      <PixelCard padding="sm" className="active:opacity-80">
        <div className="flex items-start gap-2">
          {/* 난이도 블록 — 이모지+숫자 */}
          <div
            className={`w-9 h-9 flex-shrink-0 flex flex-col items-center justify-center
                        border-2 border-pixel-dark ${diffInfo.color}`}
            title={diffInfo.label}
          >
            <span className="text-sm leading-none">
              {mission.difficulty === 1 ? '🌱' :
               mission.difficulty === 2 ? '🍃' :
               mission.difficulty === 3 ? '⚡' :
               mission.difficulty === 4 ? '🔥' : '💥'}
            </span>
            <span className="font-pixel text-[7px] leading-none text-white mt-0.5">
              {mission.difficulty}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            {/* 제목 + 즐겨찾기 */}
            <div className="flex items-center justify-between gap-1">
              <p className="font-korean text-sm font-bold text-pixel-dark truncate">
                {mission.emoji && <span className="mr-1">{mission.emoji}</span>}
                {mission.title}
              </p>
              <button
                onClick={e => { e.preventDefault(); onFavoriteToggle?.(mission.id, mission.isFavorite) }}
                className="flex-shrink-0 text-lg leading-none"
              >
                {mission.isFavorite ? '⭐' : '☆'}
              </button>
            </div>

            {/* 카테고리 (StatusBadge 제거) */}
            <p className="font-korean text-[10px] text-stone mt-0.5">
              {CATEGORY_LABELS[mission.category]}
            </p>

            {/* 보상 + [상태 / D-day] */}
            <div className="flex items-end justify-between mt-1">
              <span className="font-korean text-[10px] text-pixel-dark">
                {formatRewards(mission)}
              </span>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {/* 상태 텍스트 */}
                <span className={`font-korean text-[9px] font-bold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {/* D-day */}
                <span className={`font-korean text-[9px] ${daysLeft.includes('오늘') ? 'text-rejected font-bold' : 'text-stone'}`}>
                  {daysLeft}
                </span>
              </div>
            </div>
          </div>
        </div>
      </PixelCard>
    </Link>
  )
}
