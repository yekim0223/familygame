// Design Ref: §5.3 SCR-05 MissionListPage
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { useMembers } from '@/presentation/hooks/useMembers'
import { MissionCard } from '@/presentation/components/missions/MissionCard'
import { toggleMissionFavorite } from '@/infrastructure/firebase/collections/missions'
import type { Mission } from '@/domain/entities/Mission'

const LS_FAV_ORDER = 'fq_fav_order'

function readFavOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_FAV_ORDER) ?? '[]') } catch { return [] }
}
function writeFavOrder(ids: string[]) {
  localStorage.setItem(LS_FAV_ORDER, JSON.stringify(ids))
}

type MissionMode = 'all' | 'shared' | 'individual'
type SortKey = 'newest' | 'oldest' | 'deadline' | 'difficulty' | 'favorites'

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'newest',     label: '최신순',   icon: '🆕' },
  { key: 'oldest',     label: '오래된순', icon: '📅' },
  { key: 'deadline',   label: '마감임박', icon: '⏰' },
  { key: 'difficulty', label: '난이도↑',  icon: '🔥' },
  { key: 'favorites',  label: '즐겨찾기', icon: '⭐' },
]

export default function MissionListPage() {
  const { missions, loading } = useMissionStore()
  const { currentMember, familyId } = useAuthStore()

  const { members } = useMembers()

  const [mode, setMode]               = useState<MissionMode>('all')
  const [sortKey, setSortKey]             = useState<SortKey>('newest')
  const [selectedChild, setSelectedChild] = useState<string | null>(null)
  const [favOrder, setFavOrder]           = useState<string[]>(readFavOrder)

  // useMembers 훅으로 실시간 구독 — 자녀만 필터
  const childMembers = useMemo(
    () => members
      .filter(m => m.role === 'CHILD')
      .map(m => ({ id: m.id, name: m.name, realName: m.realName })),
    [members]
  )

  // 개별 모드 진입 시 첫 아이 자동 선택
  useEffect(() => {
    if (mode === 'individual' && childMembers.length > 0 && !selectedChild) {
      setSelectedChild(childMembers[0].id)
    }
  }, [childMembers, mode, selectedChild])

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  // 모드 전환 시 아이 자동 선택
  const handleModeChange = (newMode: MissionMode) => {
    setMode(newMode)
    if (newMode === 'individual' && childMembers.length > 0 && !selectedChild) {
      setSelectedChild(childMembers[0].id)
    }
  }

  const filtered = useMemo(() => {
    let base: Mission[]

    if (mode === 'all') {
      base = isParent
        ? missions
        : missions.filter(m => m.targetMemberIds.includes(currentMember?.id ?? ''))
    } else if (mode === 'shared') {
      base = missions.filter(m => m.targetMemberIds.length > 1)
    } else {
      const individualMissions = missions.filter(m => m.targetMemberIds.length === 1)
      if (isParent) {
        base = selectedChild
          ? individualMissions.filter(m => m.targetMemberIds.includes(selectedChild))
          : individualMissions
      } else {
        base = individualMissions.filter(m =>
          m.targetMemberIds.includes(currentMember?.id ?? '')
        )
      }
    }

    return [...base].sort((a, b) => {
      if (sortKey === 'favorites') {
        const aIdx = favOrder.indexOf(a.id)
        const bIdx = favOrder.indexOf(b.id)
        const aFav = aIdx !== -1
        const bFav = bIdx !== -1
        if (aFav && !bFav) return -1
        if (!aFav && bFav) return 1
        if (aFav && bFav) return aIdx - bIdx
        return b.createdAt.getTime() - a.createdAt.getTime()
      }
      if (sortKey === 'oldest') return a.createdAt.getTime() - b.createdAt.getTime()
      if (sortKey === 'deadline') {
        const aExp = a.status === 'EXPIRED', bExp = b.status === 'EXPIRED'
        if (aExp && !bExp) return 1
        if (!aExp && bExp) return -1
        return a.endDate.getTime() - b.endDate.getTime()
      }
      if (sortKey === 'difficulty') return b.difficulty - a.difficulty
      // 'newest' (default)
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
  }, [missions, mode, selectedChild, isParent, currentMember?.id, favOrder, sortKey])

  const handleFavoriteToggle = useCallback((id: string, current: boolean) => {
    if (!familyId) return
    const nowFav = !current
    toggleMissionFavorite(familyId, id, nowFav)
    setFavOrder(prev => {
      const next = nowFav
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter(fid => fid !== id)
      writeFavOrder(next)
      return next
    })
  }, [familyId])

  return (
    <div className="p-3 pb-4 space-y-3">

      {/* 전체 / 공동 / 개별 탭 — bg-panel-darkest 바, 활성: bg-panel-surface + gold 하단 라인 */}
      <div className="flex bg-panel-darkest border-4 border-panel-border overflow-hidden">
        {(['all', 'shared', 'individual'] as MissionMode[]).map(tab => {
          const label = tab === 'all' ? '전체' : tab === 'shared' ? '공동' : '개별'
          const isActive = mode === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleModeChange(tab)}
              className={[
                'flex-1 py-3 font-korean text-sm font-bold transition-colors border-b-4',
                isActive
                  ? 'bg-panel-surface text-cream border-gold'
                  : 'bg-transparent text-panel-sub border-transparent hover:text-cream',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 개별 미션 — 아이별 탭 (부모만) */}
      {mode === 'individual' && isParent && childMembers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {childMembers.map(child => (
            <button key={child.id} type="button"
              onClick={() => setSelectedChild(child.id)}
              className={[
                'flex-1 py-2.5 border-4 font-korean text-sm font-bold transition-colors',
                selectedChild === child.id
                  ? 'bg-panel-surface text-cream border-gold'
                  : 'bg-panel-darkest text-panel-sub border-panel-border hover:text-cream',
              ].join(' ')}>
              {child.name}
              {child.realName && child.realName !== child.name && (
                <span className="block font-korean text-xs opacity-70">{child.realName}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 결과 수 + 정렬 */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-korean text-xs text-panel-sub whitespace-nowrap">
          {mode === 'all' ? '전체' : mode === 'shared' ? '공동' : '개별'} · {filtered.length}개
        </p>
        <div className="flex gap-1 overflow-x-auto flex-shrink-0 pb-0.5">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortKey(opt.key)}
              className={[
                'flex-shrink-0 px-2 py-1 border-2 font-korean text-xs transition-colors',
                sortKey === opt.key
                  ? 'bg-gold/20 border-gold text-gold font-bold'
                  : 'bg-panel-darkest border-panel-border text-panel-sub',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 미션 목록 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <p className="font-korean text-sm text-panel-sub animate-pulse">⏳ 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <img src="/assets/icons/sword.svg" width={52} height={52} alt="" style={{ imageRendering: 'pixelated', opacity: 0.35 }} />
          <p className="font-korean text-sm text-panel-sub text-center">
            {mode === 'all' ? '미션이 없어요' : mode === 'shared' ? '공동 미션이 없어요' : '개별 미션이 없어요'}
          </p>
          {isParent && <p className="font-korean text-xs text-panel-sub">+ 버튼으로 추가해봐요!</p>}
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
