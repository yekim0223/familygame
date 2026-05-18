// Design Ref: §5.3 SCR-05 MissionListPage
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'

const LS_FAV_ORDER = 'fq_fav_order'

function readFavOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_FAV_ORDER) ?? '[]') } catch { return [] }
}
function writeFavOrder(ids: string[]) {
  localStorage.setItem(LS_FAV_ORDER, JSON.stringify(ids))
}
import { useMissions } from '@/presentation/hooks/useMissions'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { MissionCard } from '@/presentation/components/missions/MissionCard'
import { toggleMissionFavorite } from '@/infrastructure/firebase/collections/missions'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { startAnonymousSession } from '@/infrastructure/firebase/auth'
import type { Mission, MissionStatus, MissionType } from '@/domain/entities/Mission'
import type { Member } from '@/domain/entities/Member'

type StatusFilter = MissionStatus | 'ALL'
type TypeFilter = MissionType | 'ALL'

// 상태 탭 — 3개씩 2행
const STATUS_ROW1: { key: StatusFilter; label: string }[] = [
  { key: 'ALL',              label: '전체' },
  { key: 'ACTIVE',           label: '진행중' },
  { key: 'PENDING_APPROVAL', label: '완료신청' },
]
const STATUS_ROW2: { key: StatusFilter; label: string }[] = [
  { key: 'ON_HOLD',  label: '보류' },
  { key: 'APPROVED', label: '미션완료' },
  { key: 'EXPIRED',  label: '종료' },
]

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'ALL',     label: '전체' },
  { key: 'DAILY',   label: '일일' },
  { key: 'WEEKLY',  label: '주간' },
  { key: 'MONTHLY', label: '월간' },
  { key: 'CUSTOM',  label: '기간' },
]

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const STATUS_SORT: Record<MissionStatus, number> = {
  PENDING_APPROVAL: 0,
  ON_HOLD:          1,
  ACTIVE:           2,
  CHILD_REJECTED:   3,
  APPROVED:         4,
  REJECTED:         5,
  EXPIRED:          6,
}

function sortMissions(list: Mission[]): Mission[] {
  return [...list].sort((a, b) => {
    const dA = a.startDate.getTime()
    const dB = b.startDate.getTime()
    if (dB !== dA) return dB - dA
    return (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99)
  })
}

const btnBase = 'flex-1 py-3 font-korean text-sm font-bold border-4 transition-all active:translate-y-0.5'

export default function MissionListPage() {
  const { missions, loading } = useMissions()
  const { currentMember, familyId } = useAuthStore()
  const now = new Date()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [targetFilter, setTargetFilter] = useState<string>('ALL')   // 대상 자녀
  const [creatorFilter, setCreatorFilter] = useState<string>('ALL') // 등록자 (부모)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(now.getMonth())
  const [childMembers, setChildMembers] = useState<{ id: string; name: string }[]>([])
  const [parentMembers, setParentMembers] = useState<{ id: string; name: string; role: string }[]>([])
  const [favOrder, setFavOrder] = useState<string[]>(readFavOrder)

  useEffect(() => {
    if (!familyId) return
    let cancelled = false
    startAnonymousSession().then(() => {
      if (cancelled) return
      return subscribeMembers(familyId, (members: Member[]) => {
        setChildMembers(members.filter(m => m.role === 'CHILD').map(m => ({ id: m.id, name: m.name })))
        setParentMembers(members.filter(m => m.role === 'DAD' || m.role === 'MOM').map(m => ({
          id: m.id, name: m.role === 'DAD' ? '아빠' : '엄마', role: m.role,
        })))
      })
    })
    return () => { cancelled = true }
  }, [familyId])

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  const filtered = useMemo(() => {
    const base = missions.filter(m => {
      if (selectedMonth !== null && m.startDate.getMonth() !== selectedMonth) return false
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && m.type !== typeFilter) return false
      if (!isParent && !m.targetMemberIds.includes(currentMember?.id ?? '')) return false
      if (isParent && targetFilter !== 'ALL' && !m.targetMemberIds.includes(targetFilter)) return false
      if (isParent && creatorFilter !== 'ALL' && m.creatorId !== creatorFilter) return false
      return true
    })

    // 즐겨찾기 우선 정렬 (추가된 순서대로) → 그 다음 날짜+상태 정렬
    return [...base].sort((a, b) => {
      const aIdx = favOrder.indexOf(a.id)
      const bIdx = favOrder.indexOf(b.id)
      const aFav = aIdx !== -1
      const bFav = bIdx !== -1
      if (aFav && !bFav) return -1
      if (!aFav && bFav) return 1
      if (aFav && bFav) return aIdx - bIdx // 추가된 순서대로
      // 둘 다 비즐겨찾기: 날짜 + 상태 기준
      const dDiff = b.startDate.getTime() - a.startDate.getTime()
      if (dDiff !== 0) return dDiff
      return (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99)
    })
  }, [missions, selectedMonth, statusFilter, typeFilter, targetFilter, creatorFilter, isParent, currentMember?.id, favOrder])

  const handleFavoriteToggle = useCallback((id: string, current: boolean) => {
    if (!familyId) return
    const nowFav = !current
    toggleMissionFavorite(familyId, id, nowFav)
    setFavOrder(prev => {
      let next: string[]
      if (nowFav) {
        // 즐겨찾기 추가 — 맨 끝에 (추가 순서 유지)
        next = prev.includes(id) ? prev : [...prev, id]
      } else {
        // 즐겨찾기 해제
        next = prev.filter(fid => fid !== id)
      }
      writeFavOrder(next)
      return next
    })
  }, [familyId])

  const activeTabCls = 'bg-purple text-white border-purple'
  const inactiveTabCls = 'bg-cream text-pixel-dark border-pixel-dark hover:border-gold'

  return (
    <div className="p-3 pb-4 space-y-2">

      {/* 월별 선택바 */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        <button type="button" onClick={() => setSelectedMonth(null)}
          className={`flex-shrink-0 px-3 py-1.5 font-korean text-xs font-bold border-2
            ${selectedMonth === null ? 'bg-pixel-dark text-gold border-gold' : 'bg-cream text-stone border-stone hover:border-purple'}`}>
          전체
        </button>
        {MONTH_LABELS.map((m, i) => (
          <button key={i} type="button" onClick={() => setSelectedMonth(i)}
            className={`flex-shrink-0 px-2 py-1.5 font-korean text-xs border-2
              ${selectedMonth === i ? 'bg-sky text-white border-sky' : 'bg-cream text-stone border-stone hover:border-sky'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* 상태 탭 — 3×2 대형 버튼 */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {STATUS_ROW1.map(tab => (
            <button key={tab.key} type="button" onClick={() => setStatusFilter(tab.key)}
              className={`${btnBase} ${statusFilter === tab.key ? activeTabCls : inactiveTabCls}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {STATUS_ROW2.map(tab => (
            <button key={tab.key} type="button" onClick={() => setStatusFilter(tab.key)}
              className={`${btnBase} ${statusFilter === tab.key ? activeTabCls : inactiveTabCls}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 유형 필터 */}
      <div className="flex gap-1.5">
        {TYPE_FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setTypeFilter(f.key)}
            className={`flex-shrink-0 px-2 py-1.5 font-korean text-xs font-bold border-2
              ${typeFilter === f.key ? 'bg-purple text-white border-purple' : 'bg-cream text-pixel-dark border-stone hover:border-purple'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 대상 자녀 필터 (부모만) */}
      {isParent && childMembers.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {[{ key: 'ALL', name: '전체 아이' }, ...childMembers.map(m => ({ key: m.id, name: m.name }))].map(f => (
            <button key={f.key} type="button" onClick={() => setTargetFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 font-korean text-xs font-bold border-2
                ${targetFilter === f.key ? 'bg-sky text-white border-sky' : 'bg-cream text-pixel-dark border-stone hover:border-sky'}`}>
              👤 {f.name}
            </button>
          ))}
        </div>
      )}

      {/* 등록자 필터 (부모만) */}
      {isParent && parentMembers.length > 0 && (
        <div className="flex gap-1.5">
          {[{ key: 'ALL', name: '전체 등록' }, ...parentMembers.map(m => ({ key: m.id, name: `${m.name} 등록` }))].map(f => (
            <button key={f.key} type="button" onClick={() => setCreatorFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 font-korean text-xs font-bold border-2
                ${creatorFilter === f.key ? 'bg-hold text-white border-orange-700' : 'bg-cream text-pixel-dark border-stone hover:border-hold'}`}>
              ✏️ {f.name}
            </button>
          ))}
        </div>
      )}

      {/* 결과 수 */}
      <p className="font-korean text-[10px] text-stone text-right">
        {selectedMonth !== null ? `${MONTH_LABELS[selectedMonth]} · ` : '전체 · '}{filtered.length}개
      </p>

      {/* 미션 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <p className="font-korean text-xs text-stone animate-pulse">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">⚔️</p>
          <p className="font-korean text-sm text-stone">퀘스트가 없어요</p>
          {isParent && <p className="font-korean text-xs text-stone mt-1">아래 + 버튼으로 추가해봐요!</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(mission => (
            <MissionCard key={mission.id} mission={mission} onFavoriteToggle={handleFavoriteToggle} />
          ))}
        </div>
      )}

      {isParent && (
        <Link to="/missions/new"
          className="fixed bottom-20 right-4 w-14 h-14 bg-gold border-4 border-pixel-dark
                     shadow-pixel flex items-center justify-center font-pixel text-xl
                     hover:border-white active:translate-y-0.5 active:shadow-none z-30">
          +
        </Link>
      )}
    </div>
  )
}
