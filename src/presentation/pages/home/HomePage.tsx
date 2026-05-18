// Design Ref: §5.3 SCR-04 HomePage — 역할별 분리 대시보드
// 폰트 정책: font-korean 고딕 통일, 최소 text-xs(12px), 색상 3종(pixel-dark/stone/purple)
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useMissions } from '@/presentation/hooks/useMissions'
import { useNotifications } from '@/presentation/hooks/useNotifications'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { LoginAnimation } from '@/presentation/components/animations/LoginAnimation'
import { CharacterSprite, PetSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import { MissionCard } from '@/presentation/components/missions/MissionCard'
import { CHARACTER_LABELS } from '@/application/use-cases/characters/selectCharacter'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { BANNER_BG, BANNER_UNLOCKS } from '@/application/use-cases/characters/selectCharacter'
import { QuestionBalloonButton } from '@/presentation/pages/home/QuestionBalloon'
import { subscribeNotices, type Notice } from '@/infrastructure/firebase/collections/notices'
import type { Mission } from '@/domain/entities/Mission'

// ── 공지사항 아코디언 아이템 ───────────────────────────────────────
function NoticeItem({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false)
  const dateStr = notice.createdAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
  return (
    <div className="border-b border-stone/20 last:border-0">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 py-2 text-left active:bg-black/5">
        <div className="flex-1 min-w-0">
          <span className="font-korean text-xs font-bold text-pixel-dark truncate block">{notice.title}</span>
          <span className="font-korean text-[10px] text-stone">{dateStr} · {notice.authorName}</span>
        </div>
        <span className="text-stone text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <p className="font-korean text-xs text-stone px-1 pb-2 leading-relaxed line-clamp-5">
          {notice.content}
        </p>
      )}
    </div>
  )
}

function getMemberName(memberId: string): string {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return ''
    const { members } = JSON.parse(raw)
    const m = members.find((m: any) => m.id === memberId)
    return m ? `${m.name}${m.realName && m.realName !== m.name ? ` (${m.realName})` : ''}` : ''
  } catch { return '' }
}

// 공통 폰트 클래스 (고딕 시스템 폰트 기준)
const T = {
  section: 'font-korean text-sm font-bold text-pixel-dark',   // 섹션 제목
  body:    'font-korean text-sm text-pixel-dark',              // 본문
  sub:     'font-korean text-xs text-stone',                   // 보조 설명
  badge:   'font-korean text-xs font-bold',                    // 상태 배지
}

export default function HomePage() {
  const { currentMember } = useAuth()
  const { familyId } = useAuthStore()
  const { missions } = useMissions()
  const { getMissionById } = useMissionStore()
  const { notifications } = useNotifications()
  const navigate = useNavigate()

  const [showAnim, setShowAnim] = useState(true)
  const [animDone, setAnimDone] = useState(false)
  const [notices, setNotices]   = useState<Notice[]>([])

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  if (!currentMember) return null

  const isParent = currentMember.role === 'DAD' || currentMember.role === 'MOM'
  const isChild  = currentMember.role === 'CHILD'
  const jobLabel = CHARACTER_LABELS[currentMember.character.characterId] ?? ''

  const startOfToday2 = (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
  const endOfToday2   = (() => { const d = new Date(); d.setHours(23,59,59,999); return d })()

  // 오늘 범위 내에 겹치는 미션만 표시 (지난 미션 제외)
  const todayMissions: Mission[] = isParent
    ? missions.filter(m => {
        const s = new Date(m.startDate); s.setHours(0,0,0,0)
        const e = new Date(m.endDate);   e.setHours(23,59,59,999)
        return m.status !== 'EXPIRED' && s <= endOfToday2 && e >= startOfToday2
      })
    : missions.filter(m => {
        const s = new Date(m.startDate); s.setHours(0,0,0,0)
        const e = new Date(m.endDate);   e.setHours(23,59,59,999)
        return m.targetMemberIds.includes(currentMember.id) &&
               m.status !== 'EXPIRED' && s <= endOfToday2 && e >= startOfToday2
      })

  // 이번 주 범위 (월~일)
  const startOfWeek = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // 월요일 기준
    return d
  })()
  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()
  const endOfToday   = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d })()

  const myMissions = missions.filter(m => m.targetMemberIds.includes(currentMember.id))

  // 오늘 미션
  const todayMy       = myMissions.filter(m => m.startDate <= endOfToday && m.endDate >= startOfToday)
  const todayApproved = todayMy.filter(m => m.status === 'APPROVED').length
  const todayActive   = todayMy.filter(m => m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL').length
  const todayTotal    = todayMy.length
  const todayPercent  = todayTotal > 0 ? Math.round((todayApproved / todayTotal) * 100) : 0

  // 이번 주 미션
  const weeklyMissions    = myMissions.filter(m => m.startDate >= startOfWeek)
  const weeklyApproved    = weeklyMissions.filter(m => m.status === 'APPROVED').length
  const weeklyActive      = weeklyMissions.filter(m => m.status === 'ACTIVE' || m.status === 'PENDING_APPROVAL').length
  const weeklyTotal       = weeklyMissions.length
  const weeklyPercent     = weeklyTotal > 0 ? Math.round((weeklyApproved / weeklyTotal) * 100) : 0

  // 피드: 부모=미션신청+조르기요청 / 아이=내 알림(BEG_RESULT·HOLD·REJECTED 등)
  const feedItems = (() => {
    const seen = new Set<string>()
    return notifications
      .filter(n => {
        if (n.type === 'NEW_MESSAGE') return false
        // 부모: BEG_RESULT·LEVEL_UP 불필요, BEGGING_REQUEST·MISSION_PENDING 중심
        if (isParent && (n.type === 'BEG_RESULT' || n.type === 'LEVEL_UP')) return false
        // 아이: BEGGING_REQUEST는 표시 안 함 (본인이 보낸 것)
        if (!isParent && n.type === 'BEGGING_REQUEST') return false
        const key = `${n.relatedId}-${n.type}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 5)
  })()

  const statusLabel: Record<string, { text: string; color: string }> = {
    ACTIVE:           { text: '진행중',   color: 'text-sky' },
    PENDING_APPROVAL: { text: '승인대기', color: 'text-hold' },
    APPROVED:         { text: '완료',     color: 'text-approved' },
    ON_HOLD:          { text: '보류',     color: 'text-hold' },
    REJECTED:         { text: '반려',     color: 'text-rejected' },
    CHILD_REJECTED:   { text: '거절됨',   color: 'text-rejected' },
  }

  return (
    <>
      {showAnim && !animDone && (
        <div onClick={() => { setShowAnim(false); setAnimDone(true) }}>
          <LoginAnimation
            role={currentMember.role}
            characterId={currentMember.character.characterId}
            onComplete={() => { setShowAnim(false); setAnimDone(true) }}
          />
        </div>
      )}

      <div className="p-3 pb-4 space-y-3">

        {/* ① 프로필 카드 (등급 배경 적용) */}
        {(() => {
          const bannerId = currentMember.character.worldBanner ?? 'overworld'
          const gradient = BANNER_BG[bannerId] ?? 'from-grass to-green-700'
          const bannerInfo = BANNER_UNLOCKS.find(b => b.id === bannerId)
          return (
            <div className={`border-4 border-pixel-dark bg-gradient-to-b ${gradient} p-3`}>
              <div className="flex items-start gap-3">
                {/* 좌: 캐릭터 — 클릭 시 프로필 캐릭터 탭으로 이동 */}
                <button
                  type="button"
                  onClick={() => navigate('/profile', { state: { panel: 'character' } })}
                  className="flex-shrink-0 relative group active:scale-95 transition-transform"
                  title="캐릭터 변경"
                >
                  <CharacterSprite
                    characterId={currentMember.character.characterId}
                    role={currentMember.role}
                    size="lg"
                    variant="job"
                    animate={animDone ? 'bob' : 'none'}
                  />
                </button>

                {/* 중: 이름·정보 */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-korean text-sm font-bold text-white drop-shadow">
                      {currentMember.name}
                    </span>
                    {currentMember.realName && currentMember.realName !== currentMember.name && (
                      <span className="font-korean text-xs text-white/70">({currentMember.realName})</span>
                    )}
                  </div>
                  {jobLabel && (
                    <span className="font-korean text-xs text-white/80">· {jobLabel}</span>
                  )}
                  {isParent && (
                    <p className="font-korean text-xs text-white/80 mt-0.5">
                      관리자 · {currentMember.role === 'DAD' ? '아빠' : '엄마'}
                    </p>
                  )}
                  {/* 자녀: Lv은 ExpBar에서만 표시 — 중복 방지 */}
                  {isChild && (
                    <ExpBar exp={currentMember.exp} level={currentMember.level} className="mt-1" />
                  )}
                </div>

                {/* 우: 마이펫(상단) + 등급(하단) */}
                <div className="flex flex-col items-end justify-between flex-shrink-0 self-stretch py-0.5">
                  {/* 마이펫 — 클릭 시 프로필 마이펫 탭으로 이동 */}
                  <div className="flex items-start gap-1.5">
                    {isChild && familyId && (
                      <QuestionBalloonButton member={currentMember} familyId={familyId} />
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/profile', { state: { panel: 'pet' } })}
                      className="relative active:scale-95 transition-transform"
                      title="마이펫 변경"
                    >
                      <PetSprite petId={currentMember.character.petId} size="sm" />
                    </button>
                  </div>

                  {/* 등급 배너 — 클릭 시 프로필 등급 탭으로 이동 */}
                  {bannerInfo && (
                    <button
                      type="button"
                      onClick={() => navigate('/profile', { state: { panel: 'banner' } })}
                      className="mt-auto active:scale-95 transition-transform"
                      title="등급 변경"
                    >
                      <span className="font-korean text-[9px] font-bold text-white
                                       bg-black/30 px-1.5 py-0.5 border border-white/30
                                       flex items-center gap-1">
                        {bannerInfo.emoji} {bannerInfo.label}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ② 부모 관리자 퀵 메뉴 */}
        {isParent && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { to: '/missions/new',   icon: '⚔️', label: '퀘스트 생성' },
              { to: '/begging/manage', icon: '🙏', label: '조르기 요청 관리' },
              { to: '/rewards',        icon: '💰', label: '보상 현황' },
            ].map(item => (
              <Link key={item.to} to={item.to}
                className="flex flex-col items-center gap-1 py-3 bg-cream border-2 border-pixel-dark
                           hover:border-purple active:translate-y-0.5 transition-all">
                <span className="text-xl">{item.icon}</span>
                <span className="font-korean text-[10px] font-bold text-pixel-dark text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* 승인 대기 배너 제거 — 퀵메뉴의 퀘스트 배지로 대체 */}

        {/* ③ 최근 활동 피드 */}
        {feedItems.length > 0 && (
          <PixelCard padding="sm">
            <div className="flex items-center justify-between mb-2">
              <p className="font-korean text-sm font-bold text-purple">
                {isParent ? '우리 아이들 신청 보기' : '최근 활동'}
              </p>
              <Link to="/notifications" className="font-korean text-xs text-stone underline">
                전체 보기
              </Link>
            </div>
            <div className="space-y-1">
              {feedItems.map(notif => {
                const relatedMission = notif.relatedId ? getMissionById(notif.relatedId) : null
                const targetNames = relatedMission?.targetMemberIds
                  .map(getMemberName).filter(Boolean).join(', ')
                const timeStr = notif.createdAt
                  ? notif.createdAt.toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', hour12: false,
                    })
                  : ''

                // 알림 타입별 이동 경로
                const getNavPath = () => {
                  switch (notif.type) {
                    case 'NEW_MESSAGE': case 'CHEER': return '/messages'
                    case 'BEG_RESULT': case 'BEGGING_REQUEST':
                      return isParent ? '/begging/manage' : '/begging'
                    case 'LEVEL_UP': return '/profile'
                    default:
                      if (!notif.relatedId) return '/missions'
                      // 미션이 스토어에 없으면 (삭제됨 등) 목록으로 이동
                      return getMissionById(notif.relatedId) ? `/missions/${notif.relatedId}` : '/missions'
                  }
                }

                return (
                  <div
                    key={notif.id}
                    className="flex items-start gap-2 py-1.5 border-b border-stone/20 last:border-0
                               cursor-pointer hover:bg-black/5 active:bg-black/10 transition-colors rounded-sm"
                    onClick={() => navigate(getNavPath())}
                  >
                    {!notif.isRead && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rejected mt-1.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      {relatedMission && (
                        <p className="font-korean text-xs font-bold text-pixel-dark truncate">
                          📌 {relatedMission.title}
                        </p>
                      )}
                      <p className="font-korean text-xs text-stone leading-snug mt-0.5">{notif.content}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {targetNames && (
                          <span className="font-korean text-[10px] text-purple">👤 {targetNames}</span>
                        )}
                        {timeStr && (
                          <span className="font-korean text-[10px] text-stone/70">{timeStr}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </PixelCard>
        )}

        {/* ④ 오늘의 퀘스트 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-korean text-sm font-bold text-purple">
              {isParent ? '우리 아이들 미션 보기' : '오늘의 퀘스트'}
            </p>
            <Link to="/missions" className="font-korean text-xs text-stone underline">
              전체 보기
            </Link>
          </div>

          {todayMissions.length === 0 ? (
            <PixelCard padding="sm">
              <p className="font-korean text-xs text-stone text-center py-2">
                오늘 등록된 일일 퀘스트가 없어요
              </p>
            </PixelCard>
          ) : isParent ? (
            <div className="space-y-2">
              {todayMissions.slice(0, 3).map(mission => {
                const assignedName = mission.targetMemberIds.map(getMemberName).filter(Boolean).join(', ')
                const st = statusLabel[mission.status] ?? { text: mission.status, color: 'text-stone' }
                return (
                  <div
                    key={mission.id}
                    className="bg-cream border-2 border-pixel-dark px-3 py-2
                               flex items-center justify-between gap-2 cursor-pointer"
                    onClick={() => navigate(`/missions/${mission.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-korean text-xs font-bold text-pixel-dark truncate">
                        {mission.emoji} {mission.title}
                      </p>
                      <p className="font-korean text-[10px] text-stone">
                        {[
                          assignedName,
                          getMemberName(mission.creatorId) ? `등록: ${getMemberName(mission.creatorId)}` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`font-korean text-xs font-bold flex-shrink-0 ${st.color}`}>
                      {st.text}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {todayMissions.map(mission => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          )}
        </div>

        {/* ⑤ 진행률 박스 2개 (자녀) */}
        {isChild && (todayTotal > 0 || weeklyTotal > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {/* 오늘 진행율 */}
            <PixelCard padding="sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-korean text-xs font-bold text-purple">오늘 진행율</p>
                <span className="font-korean text-xs font-bold text-pixel-dark">{todayPercent}%</span>
              </div>
              <div className="exp-bar">
                <div className="exp-bar-fill" style={{ width: `${todayPercent}%` }} />
              </div>
              <p className="font-korean text-[10px] text-stone mt-1">
                완료 {todayApproved}/{todayTotal}
                {todayActive > 0 && (
                  <span className="text-sky"> · 진행중 {todayActive}</span>
                )}
              </p>
            </PixelCard>

            {/* 이번 주 진행율 */}
            <PixelCard padding="sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-korean text-xs font-bold text-purple">이번 주 진행율</p>
                <span className="font-korean text-xs font-bold text-pixel-dark">{weeklyPercent}%</span>
              </div>
              <div className="exp-bar">
                <div className="exp-bar-fill" style={{ width: `${weeklyPercent}%` }} />
              </div>
              <p className="font-korean text-[10px] text-stone mt-1">
                완료 {weeklyApproved}/{weeklyTotal}
                {weeklyActive > 0 && (
                  <span className="text-sky"> · 진행중 {weeklyActive}</span>
                )}
              </p>
            </PixelCard>
          </div>
        )}

        {/* ⑦ 공지사항 아코디언 */}
        {notices.length > 0 && (
          <PixelCard padding="sm">
            <div className="flex items-center justify-between mb-2">
              <p className="font-korean text-sm font-bold text-purple">📢 공지사항</p>
            </div>
            <div>
              {notices.slice(0, 5).map(n => <NoticeItem key={n.id} notice={n} />)}
            </div>
          </PixelCard>
        )}

        {/* ⑥ 조르기 플로팅 버튼 (자녀) — 2행 + 30초 통통 */}
        {isChild && (
          <Link
            to="/begging"
            className="fixed bottom-20 right-4 w-14 h-14 bg-pink border-4 border-pixel-dark
                       shadow-pixel flex flex-col items-center justify-center gap-0.5
                       active:translate-y-0.5 active:shadow-none z-30
                       animate-beg-bounce"
          >
            <span className="text-2xl leading-none">🙏</span>
            <span className="font-korean text-[10px] font-bold text-pixel-dark leading-none">
              조르기
            </span>
          </Link>
        )}

      </div>
    </>
  )
}
