// Design Ref: §5-2 HomePage — 마일스톤 3-1 전면 개편 (v3.1)
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/hooks/useAuth'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNotificationStore } from '@/infrastructure/stores/notificationStore'
import { useMembers } from '@/presentation/hooks/useMembers'
import { useInventoryStore } from '@/infrastructure/stores/userInventoryStore'
import { LoginAnimation } from '@/presentation/components/animations/LoginAnimation'
import { CharacterSprite, PetSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { ExpBar } from '@/presentation/components/pixel/ExpBar'
import {
  CHARACTER_LABELS,
  BANNER_UNLOCKS,
} from '@/application/use-cases/characters/selectCharacter'
import { useMissionStore } from '@/infrastructure/stores/missionStore'
import { QuestionBalloonButton } from '@/presentation/pages/home/QuestionBalloon'
import { subscribeNotices, type Notice } from '@/infrastructure/firebase/collections/notices'
import { PraiseWhiteboard } from '@/presentation/components/home/PraiseWhiteboard'
import { CheerOverlay } from '@/presentation/components/home/CheerOverlay'
import type { Member } from '@/domain/entities/Member'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'

// ── 무기 아이콘 매핑 ──────────────────────────────────────────────
const WEAPON_ICON: Record<string, string> = {
  basic: '🗡️',
  laser: '⚡',
  double: '🔫',
}
const WEAPON_LABEL: Record<string, string> = {
  basic: '단검',
  laser: '레이저',
  double: '더블건',
}

// ── 피드 타입별 아이콘 ────────────────────────────────────────────
const NOTIF_ICON: Record<string, string> = {
  NEW_MISSION: '⚔️',
  MISSION_CONFIRMED: '✅',
  MISSION_PENDING: '⏳',
  MISSION_APPROVED: '🎉',
  MISSION_REJECTED: '❌',
  MISSION_HOLD: '⏸️',
  MISSION_EXPIRED: '💀',
  BEGGING_REQUEST: '🙏',
  BEG_RESULT: '🎁',
  LEVEL_UP: '⬆️',
  NEW_MESSAGE: '💬',
  CHEER: '📣',
  MOM_CHEER: '💖',
}

// ── 랜덤 가족 응원 문구 풀 ────────────────────────────────────────
const CHEER_POOL: Record<string, string[]> = {
  DAD: [
    '포기하지 마! 아빠가 뒤에서 응원해! 🔥',
    '할 수 있어! 아빠도 어렸을 때 힘들었어. 근데 해냈어! 💪',
    '오늘도 최선을 다하는 거야! 아빠가 자랑스러워 ⭐',
    '파이팅! 어려울 때일수록 더 빛나는 거야 ✨',
  ],
  MOM: [
    '엄마가 항상 응원해! 넌 뭐든 잘 할 수 있어 💖',
    '힘내! 힘들면 쉬어도 돼, 하지만 포기는 금지야 🌈',
    '우리 아가 최고야! 오늘도 파이팅 🌟',
    '엄마가 사랑해~ 잘 할 수 있어! 🥰',
  ],
}

function pickCheer(members: Member[]): { member: Member; text: string } | null {
  const parents = members.filter(m => m.role === 'DAD' || m.role === 'MOM' && m.isActive)
  if (parents.length === 0) return null
  const m = parents[Math.floor(Math.random() * parents.length)]
  const pool = CHEER_POOL[m.role] ?? CHEER_POOL.DAD
  return { member: m, text: pool[Math.floor(Math.random() * pool.length)] }
}

// ── 공지사항 아코디언 아이템 ──────────────────────────────────────
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

// ── 랜덤 응원 말풍선 ─────────────────────────────────────────────
function RandomCheerBubble({ members }: { members: Member[] }) {
  const [cheer, setCheer] = useState<{ member: Member; text: string } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = () => {
      const c = pickCheer(members)
      if (c) { setCheer(c); setVisible(true) }
    }
    // 4초 후 첫 출현
    const t1 = setTimeout(show, 4_000)
    // 이후 35초마다 반복
    const t2 = setInterval(show, 35_000)
    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [members])

  if (!visible || !cheer) return null

  const role = cheer.member.role
  return (
    <div className="relative flex items-start gap-2 animate-fade-in">
      <CharacterSprite
        characterId={cheer.member.character.characterId}
        role={role}
        size="sm"
        variant="job"
      />
      <div className="flex-1 min-w-0">
        <div className="speech-bubble border-gold relative">
          <p className="font-korean text-xs font-bold text-gold mb-0.5 t-pixel-shadow">
            [{role === 'DAD' ? '아빠' : '엄마'}]
          </p>
          <p className="font-korean text-sm text-cream leading-snug">&ldquo;{cheer.text}&rdquo;</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="flex-shrink-0 text-panel-sub hover:text-cream text-xs mt-1"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════

export default function HomePage() {
  const { currentMember } = useAuth()
  const { familyId } = useAuthStore()
  const { getMissionById } = useMissionStore()
  const { notifications } = useNotificationStore()
  const { getMemberName } = useMembers()
  const navigate = useNavigate()

  // 인벤토리 — 장착 무기·스킨·펫 (실시간 반영)
  const currentWeapon = useInventoryStore(s => s.currentWeapon) || 'basic'
  const currentSkin = useInventoryStore(s => s.currentSkin)
  const currentPet = useInventoryStore(s => s.currentPet)

  const [showAnim, setShowAnim] = useState(true)
  const [animDone, setAnimDone] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  if (!currentMember) return null

  const isParent = currentMember.role === 'DAD' || currentMember.role === 'MOM'
  const isChild = currentMember.role === 'CHILD'
  // 스토어 장착값 우선, 없으면 Firebase 기본값 (rule 38)
  const displayCharId = currentSkin || currentMember.character.characterId
  const displayPetId = currentPet || currentMember.character.petId
  const jobLabel = CHARACTER_LABELS[displayCharId] ?? ''

  // 용사의 여정 피드 (MISSION_EXPIRED 포함, 최대 5개)
  const feedItems = useMemo(() => {
    const missionEventTypes = new Set([
      'NEW_MISSION', 'MISSION_CONFIRMED', 'MISSION_PENDING',
      'MISSION_APPROVED', 'MISSION_REJECTED', 'MISSION_HOLD',
    ])
    const seen = new Set<string>()
    return notifications
      .filter(n => {
        if (n.type === 'NEW_MESSAGE') return false
        if (!isParent && n.type === 'BEGGING_REQUEST') return false
        // 삭제된 퀘스트 연관 알림 제외 (오해 방지 가드)
        if (n.relatedId && missionEventTypes.has(n.type) && !getMissionById(n.relatedId)) return false
        const key = `${n.relatedId}-${n.type}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 5)
  }, [notifications, isParent, getMissionById])

  return (
    <>
      {/* 로그인 애니메이션 */}
      {showAnim && !animDone && (
        <div onClick={() => { setShowAnim(false); setAnimDone(true) }}>
          <LoginAnimation
            role={currentMember.role}
            characterId={currentMember.character.characterId}
            onComplete={() => { setShowAnim(false); setAnimDone(true) }}
          />
        </div>
      )}

      {/* 실시간 격려 팝업 (자녀 전용) */}
      {isChild && familyId && (
        <CheerOverlay familyId={familyId} memberId={currentMember.id} />
      )}

      <div className="p-3 pb-4 space-y-3">

        {/* ① 프로필 카드 — 무기·펫 풀셋 UI */}
        {(() => {
          const bannerId = currentMember.character.worldBanner ?? 'overworld'
          const bannerInfo = BANNER_UNLOCKS.find(b => b.id === bannerId)
          return (
            <PixelCard
              variant="highlight"
              padding="md"
              className="bg-[#1a1510] relative overflow-hidden"
            >
              {/* 던전 픽셀 내부 테두리 */}
              <div className="absolute inset-[3px] border border-gold/20 pointer-events-none" />
              <div className="flex items-start gap-3 py-3 relative">
                {/* 좌: 캐릭터 + 무기 배지 */}
                <div className="flex-shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => navigate('/profile', { state: { panel: 'character' } })}
                    className="relative active:scale-95 transition-transform block"
                    title="캐릭터 변경"
                  >
                    <CharacterSprite
                      characterId={displayCharId}
                      role={currentMember.role}
                      size="lg"
                      animate={animDone ? 'bob' : 'none'}
                    />
                  </button>
                  {/* 무기 배지 — 하단 좌측 */}
                  <div
                    className="absolute -bottom-1 -left-1 bg-panel-darkest border-2 border-gold
                                px-1.5 py-0.5 flex items-center gap-0.5"
                    title={WEAPON_LABEL[currentWeapon]}
                  >
                    <span className="text-sm leading-none">{WEAPON_ICON[currentWeapon] ?? '🗡️'}</span>
                    <span className="font-pixel text-xs text-gold leading-none hidden sm:inline">
                      {WEAPON_LABEL[currentWeapon]}
                    </span>
                  </div>
                </div>

                {/* 중: 이름·정보 */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-korean text-sm font-bold text-cream">
                      {currentMember.name}
                    </span>
                    {currentMember.realName && currentMember.realName !== currentMember.name && (
                      <span className="font-korean text-xs text-cream/70">({currentMember.realName})</span>
                    )}
                  </div>
                  {jobLabel && (
                    <span className="font-korean text-xs text-cream/80">· {jobLabel}</span>
                  )}
                  {isParent && (
                    <p className="font-korean text-xs text-cream/80 mt-0.5">
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
                    {/* 펫 스프라이트 — 레트로 인벤토리 프레임 */}
                    <button
                      type="button"
                      onClick={() => navigate('/profile', { state: { panel: 'pet' } })}
                      className="relative active:scale-95 transition-transform"
                      title="마이펫 변경"
                    >
                      <div className="bg-panel-darkest border-2 border-gold/60 p-1
                                       shadow-[inset_2px_2px_0px_#00000090,inset_-1px_-1px_0px_#ffffff15]">
                        <PetSprite petId={displayPetId} size="sm" />
                      </div>
                    </button>
                  </div>
                  {bannerInfo && (
                    <button
                      type="button"
                      onClick={() => navigate('/profile', { state: { panel: 'banner' } })}
                      className="mt-auto active:scale-95 transition-transform"
                      title="등급 변경"
                    >
                      <span className="font-korean text-xs font-bold text-gold
                                       bg-panel-darkest px-1.5 py-0.5 border border-gold/40
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

        {/* ② 랜덤 가족 응원 말풍선 (자녀 전용) */}
        {isChild && members.length > 0 && (
          <RandomCheerBubble members={members} />
        )}

        {/* ③ 칭찬 화이트보드 (자녀 전용) */}
        {isChild && familyId && (
          <PraiseWhiteboard familyId={familyId} memberId={currentMember.id} />
        )}

        {/* ④ 부모 관리자 퀵 메뉴 */}
        {isParent && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { to: '/missions/new', icon: '⚔️', label: '퀘스트 생성' },
              { to: '/begging/manage', icon: '🙏', label: '조르기 관리' },
              { to: '/rewards', icon: '🏆', label: '보상 현황' },
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

        {/* ⑤ 패밀리 늬우스 피드 */}
        {feedItems.length > 0 && (
          <PixelCard variant="dark" padding="sm">
            <div className="flex items-center justify-between mb-2">
              <p className="t-heading text-gold">📜 용사의 여정</p>
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
                const icon = NOTIF_ICON[notif.type] ?? '📌'

                const getNavPath = () => {
                  switch (notif.type) {
                    case 'NEW_MESSAGE': case 'CHEER': case 'MOM_CHEER': return '/messages'
                    case 'BEG_RESULT': case 'BEGGING_REQUEST':
                      return isParent ? '/begging/manage' : '/begging'
                    case 'LEVEL_UP': return '/profile'
                    case 'MISSION_EXPIRED': return '/missions'
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
                    <span className="flex-shrink-0 text-base mt-0.5">{icon}</span>
                    {!notif.isRead && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rejected mt-2" />
                    )}
                    <div className="flex-1 min-w-0">
                      {relatedMission && notif.type !== 'MISSION_EXPIRED' && (
                        <p className="font-korean text-xs font-bold text-gold truncate">
                          {relatedMission.title}
                        </p>
                      )}
                      <p className={`font-korean text-xs leading-snug mt-0.5 ${notif.type === 'MISSION_EXPIRED' ? 'text-panel-sub line-through' : 'text-cream'
                        }`}>
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

        {/* ⑥ 공지사항 아코디언 */}
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

        {/* ⑦ 조르기 플로팅 버튼 (자녀) */}
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
