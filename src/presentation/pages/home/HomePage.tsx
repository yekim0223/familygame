// Design Ref: §5-2 HomePage — 다크 마인크래프트 인벤토리 컨셉 (v3.0)
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { useMembers } from '@/presentation/hooks/useMembers'
import { LoginAnimation } from '@/presentation/components/animations/LoginAnimation'
import { CharacterSprite, PetSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import {
  CHARACTER_LABELS,
  BANNER_BG,
  BANNER_UNLOCKS,
} from '@/application/use-cases/characters/selectCharacter'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { QuestionBalloonButton } from '@/presentation/pages/home/QuestionBalloon'
import { subscribeNotices, type Notice } from '@/infrastructure/firebase/collections/notices'

// ── 공지사항 아코디언 아이템 ───────────────────────────────────────
function NoticeItem({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false)
  const dateStr = notice.createdAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
  return (
    <div className="border-b border-panel-border last:border-0">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 py-2.5 text-left active:bg-panel-surface/30">
        <div className="flex-1 min-w-0">
          <span className="font-korean text-sm font-bold text-cream truncate block">{notice.title}</span>
          <span className="font-korean text-xs text-panel-sub">{dateStr} · {notice.authorName}</span>
        </div>
        <span className="text-panel-sub text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <p className="font-korean text-xs text-cream/80 px-1 pb-2.5 leading-relaxed line-clamp-5">
          {notice.content}
        </p>
      )}
    </div>
  )
}

export default function HomePage() {
  const { currentMember } = useAuth()
  const { familyId } = useAuthStore()
  const { getMissionById } = useMissionStore()
  const { notifications } = useNotificationStore()
  // CLAUDE.md 규칙 11번: localStorage 직접 접근 금지 → useMembers 훅으로 실시간 구독
  const { getMemberName } = useMembers()
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

  // 피드: 부모/아이 모두 최근 활동 (NEW_MESSAGE 제외, 아이는 BEGGING_REQUEST 제외), 최대 10개
  const feedItems = (() => {
    const seen = new Set<string>()
    return notifications
      .filter(n => {
        if (n.type === 'NEW_MESSAGE') return false
        if (!isParent && n.type === 'BEGGING_REQUEST') return false
        const key = `${n.relatedId}-${n.type}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 10)
  })()

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

        {/* ① 프로필 카드 — PixelCard highlight + 배너 그라디언트 */}
        {(() => {
          const bannerId   = currentMember.character.worldBanner ?? 'overworld'
          const gradient   = BANNER_BG[bannerId] ?? 'from-grass to-green-700'
          const bannerInfo = BANNER_UNLOCKS.find(b => b.id === bannerId)
          return (
            <PixelCard
              variant="highlight"
              padding="sm"
              className={`bg-gradient-to-b ${gradient}`}
            >
              <div className="flex items-start gap-3">
                {/* 좌: 캐릭터 클릭 → 프로필 캐릭터 탭 */}
                <button
                  type="button"
                  onClick={() => navigate('/profile', { state: { panel: 'character' } })}
                  className="flex-shrink-0 relative active:scale-95 transition-transform"
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
                  {isChild && (
                    <ExpBar exp={currentMember.exp} level={currentMember.level} className="mt-1" />
                  )}
                </div>

                {/* 우: 마이펫 + 등급 배너 */}
                <div className="flex flex-col items-end justify-between flex-shrink-0 self-stretch py-0.5">
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
                  {bannerInfo && (
                    <button
                      type="button"
                      onClick={() => navigate('/profile', { state: { panel: 'banner' } })}
                      className="mt-auto active:scale-95 transition-transform"
                      title="등급 변경"
                    >
                      <span className="font-korean text-xs font-bold text-white
                                       bg-black/30 px-1.5 py-0.5 border border-white/30
                                       flex items-center gap-1">
                        {bannerInfo.emoji} {bannerInfo.label}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </PixelCard>
          )
        })()}

        {/* ② 부모 관리자 퀵 메뉴 */}
        {isParent && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { to: '/missions/new',   icon: '⚔️', label: '퀘스트 생성' },
              { to: '/begging/manage', icon: '🙏', label: '조르기 관리' },
              { to: '/rewards',        icon: '🏆', label: '보상 현황' },
            ].map(item => (
              <Link key={item.to} to={item.to}
                className="card-pixel flex flex-col items-center gap-1 py-3
                           hover:border-gold/60 active:translate-y-0.5 transition-all">
                <span className="text-xl">{item.icon}</span>
                <span className="font-korean text-xs font-bold text-cream text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ③ 최근 활동 피드 */}
        {feedItems.length > 0 && (
          <PixelCard variant="dark" padding="sm">
            <div className="flex items-center justify-between mb-2">
              <p className="t-heading text-gold">최근 활동</p>
              <Link to="/notifications" className="font-korean text-xs text-panel-sub underline">
                전체 보기
              </Link>
            </div>
            <div className="space-y-0">
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

                const getNavPath = () => {
                  switch (notif.type) {
                    case 'NEW_MESSAGE': case 'CHEER': return '/messages'
                    case 'BEG_RESULT': case 'BEGGING_REQUEST':
                      return isParent ? '/begging/manage' : '/begging'
                    case 'LEVEL_UP': return '/profile'
                    default:
                      if (!notif.relatedId) return '/missions'
                      return getMissionById(notif.relatedId) ? `/missions/${notif.relatedId}` : '/missions'
                  }
                }

                return (
                  <div
                    key={notif.id}
                    className="flex items-start gap-2 py-2 border-b border-panel-border last:border-0
                               cursor-pointer hover:bg-panel-surface/30 active:bg-panel-surface/50
                               transition-colors"
                    onClick={() => navigate(getNavPath())}
                  >
                    {!notif.isRead && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rejected mt-2" />
                    )}
                    <div className="flex-1 min-w-0">
                      {relatedMission && (
                        <p className="font-korean text-xs font-bold text-gold truncate">
                          📌 {relatedMission.title}
                        </p>
                      )}
                      <p className="font-korean text-xs text-cream leading-snug mt-0.5">
                        {notif.content}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {targetNames && (
                          <span className="font-korean text-xs text-panel-sub">👤 {targetNames}</span>
                        )}
                        {timeStr && (
                          <span className="font-korean text-xs text-panel-sub">{timeStr}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </PixelCard>
        )}

        {/* ④ 공지사항 아코디언 */}
        {notices.length > 0 && (
          <PixelCard variant="dark" padding="sm">
            <div className="flex items-center justify-between mb-2">
              <p className="t-heading text-gold">📢 공지사항</p>
            </div>
            <div>
              {notices.slice(0, 5).map(n => <NoticeItem key={n.id} notice={n} />)}
            </div>
          </PixelCard>
        )}

        {/* ⑤ 조르기 플로팅 버튼 (자녀) */}
        {isChild && (
          <Link
            to="/begging"
            className="fixed bottom-20 right-4 w-14 h-14 bg-pink border-4 border-pixel-dark
                       shadow-pixel flex flex-col items-center justify-center gap-0.5
                       active:translate-y-0.5 active:shadow-none z-30 animate-beg-bounce"
          >
            <span className="text-2xl leading-none">🙏</span>
            <span className="font-korean text-xs font-bold text-pixel-dark leading-none">
              조르기
            </span>
          </Link>
        )}

      </div>
    </>
  )
}
