// Design Ref: §5.3 SCR-12 RewardStatusPage — 보상 현황 (연도·월·대상자 필터)
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRewards, filterRewardsByYearMonth } from '@/presentation/hooks/useRewards'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
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

// localStorage 캐시에서 멤버 정보 조회
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

// 날짜를 시:분까지 포함해 표시
function formatDateTime(date: Date | undefined): string {
  if (!date) return ''
  return date.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function RewardStatusPage() {
  const { rewards, isParent } = useRewards()
  const { currentMember } = useAuthStore()
  const { getMissionById } = useMissionStore()
  const now = new Date()
  const [selectedYear,   setSelectedYear]   = useState(now.getFullYear())
  const [selectedMonth,  setSelectedMonth]  = useState(now.getMonth())
  const [selectedMember, setSelectedMember] = useState<string | null>(null) // null = 전체

  const cacheMembers = useMemo(() => getMembersFromCache(), [])

  if (!currentMember) return null

  const korAge = currentMember.birthDate ? calcKoreanAge(currentMember.birthDate) : null

  // 연도 목록
  const years = useMemo(() => {
    const ys = new Set(rewards.map(r => r.approvedAt.getFullYear()))
    ys.add(now.getFullYear())
    return Array.from(ys).sort((a, b) => b - a)
  }, [rewards])

  // 연도·월 필터
  const byYearMonth = useMemo(
    () => filterRewardsByYearMonth(rewards, selectedYear, selectedMonth),
    [rewards, selectedYear, selectedMonth]
  )

  // 대상자(수행자) 탭 목록 — 부모만 표시 (자녀는 본인 것만 봄)
  const memberTabs = useMemo(() => {
    if (!isParent) return []
    const ids = [...new Set(byYearMonth.map(r => r.memberId))]
    return ids.map(id => ({
      id,
      label: getMemberDisplayName(id, cacheMembers) || id,
    }))
  }, [byYearMonth, isParent, cacheMembers])

  // 대상자 필터 적용
  const filtered = useMemo(
    () => selectedMember
      ? byYearMonth.filter(r => r.memberId === selectedMember)
      : byYearMonth,
    [byYearMonth, selectedMember]
  )

  // 종류별 합계 (필터 적용 후)
  const totals = useMemo(
    () => filtered.reduce<Record<string, number>>((acc, r) => {
      acc[r.rewardType] = (acc[r.rewardType] ?? 0) + r.amount
      return acc
    }, {}),
    [filtered]
  )

  // 당월 용돈 총합 (MONEY만)
  const monthTotal = filtered
    .filter(r => r.rewardType === 'MONEY')
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <div className="p-3 pb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-korean text-base font-bold text-gold">🏆 보상 현황</h1>
        <Link to="/history" className="font-korean text-[10px] text-sky underline">히스토리 →</Link>
      </div>

      {/* 한국 나이 레이블 */}
      {korAge && (
        <p className="font-korean text-xs text-stone">
          {currentMember.name} · {korAge}살 기록
        </p>
      )}

      {/* 당월 총합 */}
      {filtered.length > 0 && (
        <div className="bg-gold/10 border-2 border-gold px-4 py-3 flex items-center justify-between">
          <p className="font-korean text-sm font-bold text-pixel-dark">
            {MONTH_LABELS[selectedMonth]} 총합
          </p>
          <div className="text-right">
            {monthTotal > 0 && (
              <p className="font-pixel text-base text-gold">
                💰{monthTotal.toLocaleString('ko-KR')}원
              </p>
            )}
            <p className="font-korean text-[10px] text-stone">{filtered.length}건 보상</p>
          </div>
        </div>
      )}

      {/* 연도 탭 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {years.map(y => (
          <button key={y} type="button" onClick={() => setSelectedYear(y)}
            className={`flex-shrink-0 px-3 py-1 font-korean text-xs border-2 border-pixel-dark
              ${selectedYear === y ? 'bg-purple text-white' : 'bg-cream text-pixel-dark'}`}>
            {y}년
          </button>
        ))}
      </div>

      {/* 월 탭 */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {MONTH_LABELS.map((m, i) => (
          <button key={i} type="button" onClick={() => setSelectedMonth(i)}
            className={`flex-shrink-0 px-2 py-1 font-korean text-[10px] border-2
              ${selectedMonth === i ? 'bg-sky text-white border-sky' : 'bg-cream text-stone border-stone'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* 대상자 필터 탭 — 부모 전용 */}
      {isParent && memberTabs.length > 0 && (
        <div className="flex gap-1.5">
          <button type="button"
            onClick={() => setSelectedMember(null)}
            className={[
              'px-3 py-1.5 font-korean text-xs font-bold border-2 transition-all',
              selectedMember === null
                ? 'bg-pixel-dark text-gold border-gold'
                : 'bg-cream text-stone border-stone hover:border-purple',
            ].join(' ')}>
            전체
          </button>
          {memberTabs.map(tab => (
            <button key={tab.id} type="button"
              onClick={() => setSelectedMember(tab.id)}
              className={[
                'px-3 py-1.5 font-korean text-xs font-bold border-2 transition-all',
                selectedMember === tab.id
                  ? 'bg-purple text-white border-purple'
                  : 'bg-cream text-stone border-stone hover:border-purple',
              ].join(' ')}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 보상 종류별 합계 카드 — 5열 소형 */}
      {Object.keys(totals).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(totals).map(([type, amount]) => (
            <div key={type} className="flex flex-col items-center justify-center
                                        bg-cream border-2 border-pixel-dark px-2 py-1.5
                                        min-w-[56px]">
              <span className="text-base leading-none">{REWARD_ICONS[type] ?? '⭐'}</span>
              <span className="font-korean text-[10px] font-bold text-pixel-dark mt-0.5">
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
        <PixelCard padding="sm">
          <p className="font-korean text-xs text-stone text-center py-2">
            {selectedYear}년 {MONTH_LABELS[selectedMonth]}에{' '}
            {selectedMember ? `${getMemberDisplayName(selectedMember, cacheMembers)}의 ` : ''}
            받은 보상이 없어요
          </p>
        </PixelCard>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(r => {
            const mission = getMissionById(r.missionId)
            const missionStatus = mission?.status as MissionStatus | undefined
            const statusInfo = missionStatus
              ? MISSION_STATUS_LABEL[missionStatus]
              : { label: '승인됨', color: 'text-approved' }

            const performerName = getMemberDisplayName(r.memberId, cacheMembers)
            const approverName  = getMemberDisplayName(r.approvedBy, cacheMembers)

            // 접수 시각: statusHistory에서 PENDING_APPROVAL 전환 시점
            const submittedAt = mission?.statusHistory
              ?.find(h => h.to === 'PENDING_APPROVAL')
              ?.changedAt

            return (
              <PixelCard key={r.id} padding="sm">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {REWARD_ICONS[r.rewardType] ?? '⭐'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* 퀘스트명 */}
                    {mission?.title && (
                      <p className="font-korean text-xs font-bold text-purple truncate mb-0.5">
                        {mission.emoji} {mission.title}
                      </p>
                    )}
                    {/* 보상 내용 */}
                    <p className="font-korean text-sm font-bold text-pixel-dark">
                      {r.rewardType === 'MONEY'      ? `${(r.amount || 0).toLocaleString('ko-KR')}원` :
                       r.rewardType === 'GAME_TIME'  ? `게임시간 ${r.amount}분` :
                       r.rewardType === 'PHONE_TIME' ? `핸드폰 ${r.amount}분` :
                       r.rewardType === 'GIFT'       ? `🎁 ${r.customLabel || '선물'}` :
                       r.rewardType === 'DINING'     ? `🍕 ${r.customLabel || '외식'}` : `⭐ ${r.customLabel || '특별 보상'}`}
                    </p>
                    {/* 메타 정보 */}
                    <div className="mt-1 space-y-0.5">
                      {approverName && (
                        <p className="font-korean text-[10px] text-stone">
                          📋 등록: {approverName}
                        </p>
                      )}
                      {performerName && (
                        <p className="font-korean text-[10px] text-stone">
                          ⚔️ 수행: {performerName}
                        </p>
                      )}
                      {submittedAt && (
                        <p className="font-korean text-[10px] text-stone">
                          📩 접수: {formatDateTime(submittedAt)}
                        </p>
                      )}
                      <p className="font-korean text-[10px] text-stone">
                        ✅ 승인: {formatDateTime(r.approvedAt)}
                      </p>
                    </div>
                  </div>
                  {/* 미션 상태 뱃지 */}
                  <span className={`font-korean text-[10px] font-bold flex-shrink-0 mt-0.5 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </PixelCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
