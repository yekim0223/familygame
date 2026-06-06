// Design Ref: §5.3 SCR-05 MissionListPage
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { useMembers } from '@/presentation/hooks/useMembers'
import { MissionCard } from '@/presentation/components/missions/MissionCard'
import { toggleMissionFavorite } from '@/infrastructure/firebase/collections/missions'
import type { Mission, MissionStatus } from '@/domain/entities/Mission'

const LS_FAV_ORDER = 'fq_fav_order'

function readFavOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_FAV_ORDER) ?? '[]') } catch { return [] }
}
function writeFavOrder(ids: string[]) {
  localStorage.setItem(LS_FAV_ORDER, JSON.stringify(ids))
}

type MissionMode = 'all' | 'shared' | 'individual'

const STATUS_SORT: Record<MissionStatus, number> = {
  PENDING_APPROVAL: 0,
  ON_HOLD:          1,
  ACTIVE:           2,
  CHILD_REJECTED:   3,
  APPROVED:         4,
  REJECTED:         5,
  EXPIRED:          6,
}

export default function MissionListPage() {
  const { missions, loading } = useMissionStore()
  const { currentMember, familyId } = useAuthStore()

  const { members } = useMembers()

  const [mode, setMode]               = useState<MissionMode>('all')
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
      // 전체 미션
      base = isParent
        ? missions
        : missions.filter(m => m.targetMemberIds.includes(currentMember?.id ?? ''))
    } else if (mode === 'shared') {
      // 공동 미션: targetMemberIds 2명 이상
      base = missions.filter(m => m.targetMemberIds.length > 1)
    } else {
      // 개별 미션: targetMemberIds 1명
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

    // 즐겨찾기 우선, 그 다음 날짜+상태 정렬
    return [...base].sort((a, b) => {
      const aIdx = favOrder.indexOf(a.id)
      const bIdx = favOrder.indexOf(b.id)
      const aFav = aIdx !== -1
      const bFav = bIdx !== -1
      if (aFav && !bFav) return -1
      if (!aFav && bFav) return 1
      if (aFav && bFav) return aIdx - bIdx
      const dDiff = b.startDate.getTime() - a.startDate.getTime()
      if (dDiff !== 0) return dDiff
      return (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99)
    })
  }, [missions, mode, selectedChild, isParent, currentMember?.id, favOrder])

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

      {/* 결과 수 */}
      <p className="font-korean text-xs text-panel-sub text-right">
        {mode === 'all' ? '전체' : mode === 'shared' ? '공동' : '개별'} · {filtered.length}개
      </p>

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
