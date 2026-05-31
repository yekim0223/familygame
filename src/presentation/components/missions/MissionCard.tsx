// Design Ref: §5-3 MissionListPage — 미션 카드 컴포넌트 (v3.0)
// variant: dark(일반) / special(특별 퀘스트 황금탄)
import { Link } from 'react-router-dom'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { StatusBadge } from '@/presentation/components/missions/StatusBadge'
import { DIFFICULTY_INFO, CATEGORY_LABELS } from '@/domain/entities/Mission'
import type { Mission } from '@/domain/entities/Mission'

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

export function MissionCard({ mission, onFavoriteToggle }: MissionCardProps) {
  const diffInfo = DIFFICULTY_INFO[mission.difficulty]
  const daysLeft = getDaysLeft(mission.endDate)

  // 특별 퀘스트(#D4A843 황금탄 배경): 어두운 계열로 대비 확보
  // 일반(dark 패널): 기존 cream/panel-sub 유지
  const isSpecial = !!mission.isSpecial
  const textMain  = isSpecial ? 'text-[#1C1917]'   : 'text-cream'
  // text-stone(#9E9E9E)는 황금 배경 대비율 ~1.3:1로 WCAG 미달 → amber-900(#78350f)으로 교체
  const textSub   = isSpecial ? 'text-amber-900'   : 'text-panel-sub'

  return (
    <Link to={`/missions/${mission.id}`}>
      <PixelCard
        variant={isSpecial ? 'special' : 'dark'}
        padding="sm"
        className="active:opacity-80"
      >
        {isSpecial && (
          <div className="flex items-center gap-1 mb-1.5 -mt-0.5">
            {/* 황금 배경 위: text-gold(#FFD700) 불가 → text-pixel-dark 대체 */}
            <span className="font-korean text-xs font-bold text-[#1C1917] bg-black/15 px-1.5 py-0.5 border border-[#1C1917]/40">
              ✨ 특별 퀘스트
            </span>
          </div>
        )}
        <div className="flex items-start gap-2">
          {/* 난이도 블록 — 이모지 text-2xl (기획서 §5-3) */}
          <div
            className={`w-10 h-10 flex-shrink-0 flex flex-col items-center justify-center
                        border-2 border-pixel-dark ${diffInfo.color}`}
            title={diffInfo.label}
          >
            <span className="text-2xl leading-none">
              {mission.difficulty === 1 ? '🌱' :
               mission.difficulty === 2 ? '🍃' :
               mission.difficulty === 3 ? '⚡' :
               mission.difficulty === 4 ? '🔥' : '💥'}
            </span>
            <span className="font-pixel text-[8px] leading-none text-white">
              {mission.difficulty}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            {/* 제목 + 즐겨찾기 */}
            <div className="flex items-center justify-between gap-1">
              <p className={`font-korean text-sm font-bold ${textMain} truncate`}>
                {mission.emoji && <span className="mr-1">{mission.emoji}</span>}
                {mission.title}
              </p>
              <button
                type="button"
                onClick={e => { e.preventDefault(); onFavoriteToggle?.(mission.id, mission.isFavorite) }}
                className="flex-shrink-0 text-lg leading-none"
              >
                {mission.isFavorite ? '⭐' : '☆'}
              </button>
            </div>

            {/* 카테고리 */}
            <p className={`font-korean text-xs ${textSub} mt-0.5`}>
              {CATEGORY_LABELS[mission.category]}
            </p>
            {/* 퀘스트 내용 */}
            {mission.description && (
              // isSpecial: opacity-80 제거 (황금 배경 + opacity 이중 희석 방지)
              <p className={`font-korean text-xs ${textSub} mt-0.5 line-clamp-2 leading-snug ${isSpecial ? '' : 'opacity-80'}`}>
                {mission.description}
              </p>
            )}

            {/* 보상 + [상태 배지 / D-day] */}
            <div className="flex items-end justify-between mt-1.5 gap-1">
              <span className={`font-korean text-xs ${textMain} flex-1 min-w-0`}>
                {formatRewards(mission)}
              </span>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {/* 상태 배지 — StatusBadge 단일 소스 */}
                <StatusBadge status={mission.status} />
                {/* D-day */}
                <span className={`font-korean text-xs ${daysLeft.includes('오늘') ? 'text-rejected font-bold' : textSub}`}>
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
