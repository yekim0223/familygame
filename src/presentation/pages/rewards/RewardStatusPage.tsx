// Design Ref: §5.3 SCR-12 RewardStatusPage — 보상 현황 (v3.0 MC Dark)
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRewards, filterRewardsByYearMonth } from '@/presentation/hooks/useRewards'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { calcKoreanAge } from '@/domain/services/KoreanAge'
import type { MissionStatus } from '@/domain/entities/Mission'

const REWARD_ICONS: Record<string, string> = {
  MONEY: '💰', GAME_TIME: '🎮', PHONE_TIME: '📱',
  GIFT: '🎁', DINING: '🍕', CUSTOM: '⭐',
}

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const MISSION_STATUS_LABEL: Record<MissionStatus, { label: string; color: string }> = {
  ACTIVE:           { label: '진행중',   color: 'text-sky' },
  PENDING_APPROVAL: { label: '완료신청', color: 'text-hold' },
  APPROVED:         { label: '승인됨',   color: 'text-approved' },
  ON_HOLD:          { label: '보류중',   color: 'text-hold' },
  REJECTED:         { label: '미승인',   color: 'text-rejected' },
  EXPIRED:          { label: '종료됨',   color: 'text-rejected' },
}

function getMembersFromCache(): Array<{ id: string; name: string; realName: string; role: string }> {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return []
    return JSON.parse(raw).members ?? []
  } catch { return [] }
}

function getMemberDisplayName(memberId: string, cacheMembers: ReturnType<typeof getMembersFromCache>): string {
  const m = cacheMembers.find(m => m.id === memberId)
  if (!m) return ''
  return m.name !== m.realName ? `${m.name} (${m.realName})` : m.name
}

function formatDateTime(date: Date | undefined): string {
  if (!date) return ''
  return date.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function RewardStatusPage() {
  const { rewards, isParent } = useRewards()
  const { currentMember }    = useAuthStore()
  const { getMissionById }   = useMissionStore()
  const now = new Date()
  const [selectedYear,   setSelectedYear]   = useState(now.getFullYear())
  const [selectedMonth,  setSelectedMonth]  = useState(now.getMonth())
  const [selectedMember, setSelectedMember] = useState<string | null>(null)

  const cacheMembers = useMemo(() => getMembersFromCache(), [])

  if (!currentMember) return null

  const korAge = currentMember.birthDate ? calcKoreanAge(currentMember.birthDate) : null

  const years = useMemo(() => {
    const ys = new Set(rewards.map(r => r.approvedAt.getFullYear()))
    ys.add(now.getFullYear())
    return Array.from(ys).sort((a, b) => b - a)
  }, [rewards])

  const byYearMonth = useMemo(
    () => filterRewardsByYearMonth(rewards, selectedYear, selectedMonth),
    [rewards, selectedYear, selectedMonth]
  )

  const memberTabs = useMemo(() => {
    if (!isParent) return []
    const ids = [...new Set(byYearMonth.map(r => r.memberId))]
    return ids.map(id => ({
      id,
      label: getMemberDisplayName(id, cacheMembers) || id,
    }))
  }, [byYearMonth, isParent, cacheMembers])

  const filtered = useMemo(
    () => selectedMember ? byYearMonth.filter(r => r.memberId === selectedMember) : byYearMonth,
    [byYearMonth, selectedMember]
  )

  const totals = useMemo(
    () => filtered.reduce<Record<string, number>>((acc, r) => {
      acc[r.rewardType] = (acc[r.rewardType] ?? 0) + r.amount
      return acc
    }, {}),
    [filtered]
  )

  const monthTotal = filtered
    .filter(r => r.rewardType === 'MONEY')
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="t-heading text-gold t-pixel-shadow">🏆 보상 현황</h1>
        <Link to="/history" className="font-korean text-xs text-sky underline">히스토리 →</Link>
      </div>

      {korAge && (
        <p className="t-micro text-panel-sub">{currentMember.name} · {korAge}살 기록</p>
      )}

      {/* 당월 총합 — card-highlight 금빛 강조 */}
      {filtered.length > 0 && (
        <div className="card-highlight px-4 py-3 flex items-center justify-between">
          <p className="t-sub font-bold text-cream">{MONTH_LABELS[selectedMonth]} 총합</p>
          <div className="text-right">
            {monthTotal > 0 && (
              <p className="t-heading text-gold">💰{monthTotal.toLocaleString('ko-KR')}원</p>
            )}
            <p className="t-micro text-panel-sub">{filtered.length}건 보상</p>
          </div>
        </div>
      )}

      {/* 연도 탭 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {years.map(y => (
          <PixelButton key={y} size="sm"
            variant={selectedYear === y ? 'purple' : 'ghost'}
            className="flex-shrink-0"
            onClick={() => setSelectedYear(y)}>
            {y}년
          </PixelButton>
        ))}
      </div>

      {/* 월 탭 */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {MONTH_LABELS.map((m, i) => (
          <PixelButton key={i} size="sm"
            variant={selectedMonth === i ? 'sky' : 'ghost'}
            className="flex-shrink-0"
            onClick={() => setSelectedMonth(i)}>
            {m}
          </PixelButton>
        ))}
      </div>

      {/* 대상자 필터 탭 — 부모 전용 */}
      {isParent && memberTabs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <PixelButton size="sm"
            variant={selectedMember === null ? 'gold' : 'ghost'}
            onClick={() => setSelectedMember(null)}>
            전체
          </PixelButton>
          {memberTabs.map(tab => (
            <PixelButton key={tab.id} size="sm"
              variant={selectedMember === tab.id ? 'purple' : 'ghost'}
              onClick={() => setSelectedMember(tab.id)}>
              {tab.label}
            </PixelButton>
          ))}
        </div>
      )}

      {/* 보상 종류별 합계 — card-pixel 소형 뱃지 */}
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(totals).map(([type, amount]) => (
            <div key={type}
              className="card-pixel flex flex-col items-center justify-center px-2 py-1.5 min-w-[56px]">
              <span className="text-base leading-none">{REWARD_ICONS[type] ?? '⭐'}</span>
              <span className="t-micro text-gold font-bold mt-0.5">
                {type === 'MONEY'
                  ? `${amount.toLocaleString()}원`
                  : type === 'GAME_TIME' || type === 'PHONE_TIME'
                  ? `${amount}분`
                  : `${amount}개`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 보상 목록 */}
      {filtered.length === 0 ? (
        <div className="card-pixel p-4 text-center">
          <p className="t-sub text-panel-sub">
            {selectedYear}년 {MONTH_LABELS[selectedMonth]}에{' '}
            {selectedMember ? `${getMemberDisplayName(selectedMember, cacheMembers)}의 ` : ''}
            받은 보상이 없어요
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(r => {
            const mission      = getMissionById(r.missionId)
            const missionStatus = mission?.status as MissionStatus | undefined
            const statusInfo   = missionStatus
              ? MISSION_STATUS_LABEL[missionStatus]
              : { label: '승인됨', color: 'text-approved' }

            const performerName = getMemberDisplayName(r.memberId, cacheMembers)
            const approverName  = getMemberDisplayName(r.approvedBy, cacheMembers)

            const submittedAt = mission?.statusHistory
              ?.find(h => h.to === 'PENDING_APPROVAL')
              ?.changedAt

            return (
              <div key={r.id} className="card-pixel p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {REWARD_ICONS[r.rewardType] ?? '⭐'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* 출처 배지 */}
                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                      {mission?.title ? (
                        <p className="t-sub font-bold text-gold truncate">
                          {(mission as any).emoji} {mission.title}
                        </p>
                      ) : (r as any).source === 'begging' || ((r as any).customLabel as string)?.startsWith('[조르기]') ? (
                        <span className="font-korean text-xs text-sky border border-sky px-1">🙏 조르기 승인</span>
                      ) : (
                        <span className="font-korean text-xs text-hold border border-hold px-1">🎁 수동 발송</span>
                      )}
                    </div>
                    {/* 보상 내용 */}
                    <p className="t-body font-bold text-cream">
                      {r.rewardType === 'MONEY'      ? `${(r.amount || 0).toLocaleString('ko-KR')}원` :
                       r.rewardType === 'GAME_TIME'  ? `게임시간 ${r.amount}분` :
                       r.rewardType === 'PHONE_TIME' ? `핸드폰 ${r.amount}분` :
                       r.rewardType === 'GIFT'       ? `🎁 ${(r as any).customLabel || '선물'}` :
                       r.rewardType === 'DINING'     ? `🍕 ${(r as any).customLabel || '외식'}` :
                       (r as any).customLabel        ? `⭐ ${(r as any).customLabel}` : '⭐ 특별 보상'}
                    </p>
                    {/* 메타 정보 */}
                    <div className="mt-1 space-y-0.5">
                      {approverName  && <p className="t-micro text-panel-sub">📋 등록: {approverName}</p>}
                      {performerName && <p className="t-micro text-panel-sub">⚔️ 수행: {performerName}</p>}
                      {submittedAt   && <p className="t-micro text-panel-sub">📩 접수: {formatDateTime(submittedAt)}</p>}
                      <p className="t-micro text-panel-sub">✅ 승인: {formatDateTime(r.approvedAt)}</p>
                    </div>
                  </div>
                  <span className={`t-micro font-bold flex-shrink-0 mt-0.5 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
