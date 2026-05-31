// Design Ref: §5.3 SCR-20 SettingsPage — 마일스톤 3-1 칭찬스티커/격려 패널 추가 (v3.1)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import { formatNameWithAge } from '@/domain/services/KoreanAge'
import { signOut, clearAllLocalData } from '@/infrastructure/firebase/auth'
import {
  sendPraiseSticker,
  STICKER_INFO,
  type StickerType,
} from '@/infrastructure/firebase/collections/praiseStickers'
import { sendCheerMessage } from '@/infrastructure/firebase/collections/cheerMessages'
import type { Member } from '@/domain/entities/Member'

const INPUT_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { currentMember, familyId, clearSession } = useAuthStore()
  const [members, setMembers] = useState<Member[]>([])
  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  const isDad    = currentMember?.role === 'DAD'

  // ── 칭찬 스티커 발송 상태 ────────────────────────────────────────
  const [stickerTarget,  setStickerTarget]  = useState<string>('')
  const [stickerType,    setStickerType]    = useState<StickerType>('well_done')
  const [stickerMsg,     setStickerMsg]     = useState('')
  const [stickerSending, setStickerSending] = useState(false)
  const [stickerToast,   setStickerToast]   = useState<string | null>(null)

  // ── 원터치 격려 발송 상태 ────────────────────────────────────────
  const [cheerTarget,  setCheerTarget]  = useState<string>('')
  const [cheerText,    setCheerText]    = useState('')
  const [cheerSending, setCheerSending] = useState(false)
  const [cheerToast,   setCheerToast]   = useState<string | null>(null)

  useEffect(() => {
    if (!familyId) return
    const unsub = subscribeMembers(familyId, setMembers)
    return unsub
  }, [familyId])

  if (!isParent) {
    return (
      <div className="p-4">
        <p className="font-korean text-sm text-panel-sub text-center">부모만 볼 수 있어요</p>
      </div>
    )
  }

  const children = members.filter(m => m.role === 'CHILD' && m.isActive)

  const handleLogout = async () => {
    await signOut()
    clearSession()
    clearAllLocalData()
    navigate('/login')
  }

  const handleSendSticker = async () => {
    if (!familyId || !stickerTarget || !currentMember) return
    setStickerSending(true)
    const { error } = await sendPraiseSticker(
      familyId,
      currentMember.id,
      currentMember.name,
      stickerTarget,
      stickerType,
      stickerMsg.trim()
    )
    setStickerSending(false)
    if (error) {
      setStickerToast('발송 실패: ' + error)
    } else {
      setStickerMsg('')
      setStickerToast('칭찬 스티커를 붙여줬어요! 🌟')
    }
    setTimeout(() => setStickerToast(null), 3000)
  }

  const handleSendCheer = async () => {
    if (!familyId || !cheerTarget || !cheerText.trim() || !currentMember) return
    setCheerSending(true)
    const { error } = await sendCheerMessage(
      familyId,
      currentMember.id,
      currentMember.name,
      currentMember.role,
      currentMember.character.characterId,
      cheerTarget,
      cheerText.trim()
    )
    setCheerSending(false)
    if (error) {
      setCheerToast('발송 실패: ' + error)
    } else {
      setCheerText('')
      setCheerToast('응원 팝업을 전송했어요! 💖')
    }
    setTimeout(() => setCheerToast(null), 3000)
  }

  return (
    <div className="p-3 pb-4 space-y-3">
      <h1 className="t-heading text-gold t-pixel-shadow">⚙️ 설정</h1>

      {/* ── 가족 구성원 목록 ─────────────────────────────────────── */}
      <div className="card-pixel p-3">
        <p className="t-sub font-bold text-gold mb-3">가족 구성원</p>
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-3">
              <CharacterSprite
                characterId={member.character.characterId}
                role={member.role}
                size="sm"
                variant="job"
              />
              <div className="flex-1">
                <p className="t-sub font-bold text-cream">
                  {formatNameWithAge(member.name, member.birthDate)}
                </p>
                <p className="t-micro text-panel-sub">
                  {member.role === 'DAD' ? '아빠' : member.role === 'MOM' ? '엄마' : '자녀'}
                  {member.role === 'CHILD' && ` · Lv.${member.level}`}
                </p>
              </div>
              {isDad && member.id !== currentMember?.id && (
                <PixelButton
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/settings/master')}
                >
                  관리
                </PixelButton>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="t-micro text-panel-sub text-center py-2">구성원을 불러오는 중...</p>
          )}
        </div>
      </div>

      {/* ── 📌 칭찬 스티커 화이트보드 발송 패널 ─────────────────── */}
      {children.length > 0 && (
        <div className="card-pixel p-3">
          <p className="t-sub font-bold text-gold t-pixel-shadow mb-3">📌 칭찬 스티커 보내기</p>

          {/* 대상 자녀 선택 */}
          <p className="font-korean text-xs font-bold text-panel-sub mb-1">누구에게?</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {children.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setStickerTarget(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border-2 font-korean text-sm font-bold transition-colors
                  ${stickerTarget === c.id
                    ? 'border-gold bg-gold/20 text-gold'
                    : 'border-panel-border bg-panel-darkest text-cream hover:border-gold/50'}`}
              >
                <CharacterSprite
                  characterId={c.character.characterId}
                  role={c.role}
                  size="sm"
                  variant="job"
                  className="pointer-events-none"
                />
                {c.name}
              </button>
            ))}
          </div>

          {/* 스티커 종류 선택 */}
          <p className="font-korean text-xs font-bold text-panel-sub mb-1">스티커 종류</p>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {(Object.entries(STICKER_INFO) as [StickerType, typeof STICKER_INFO[StickerType]][]).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStickerType(key)}
                className={`flex flex-col items-center gap-0.5 py-2 border-2 transition-colors
                  ${stickerType === key
                    ? `${info.border} bg-gold/10`
                    : 'border-panel-border bg-panel-darkest hover:border-gold/40'}`}
              >
                <span className="text-2xl">{info.emoji}</span>
                <span className="font-korean text-xs text-cream leading-tight text-center">
                  {info.label}
                </span>
              </button>
            ))}
          </div>

          {/* 메모 (선택) */}
          <p className="font-korean text-xs font-bold text-panel-sub mb-1">메모 (선택)</p>
          <input
            value={stickerMsg}
            onChange={e => setStickerMsg(e.target.value)}
            placeholder="짧은 칭찬 메시지..."
            maxLength={30}
            className={`${INPUT_CLS} mb-3`}
          />

          <PixelButton
            variant="gold"
            size="lg"
            fullWidth
            disabled={!stickerTarget || stickerSending}
            onClick={handleSendSticker}
          >
            {stickerSending ? '붙이는 중...' : '📌 화이트보드에 붙여주기'}
          </PixelButton>

          {stickerToast && (
            <p className="font-korean text-xs text-gold text-center mt-2">{stickerToast}</p>
          )}
        </div>
      )}

      {/* ── 💖 원터치 실시간 격려 발송 ──────────────────────────── */}
      {children.length > 0 && (
        <div className="card-pixel p-3">
          <p className="t-sub font-bold text-gold t-pixel-shadow mb-3">💖 원터치 응원 보내기</p>
          <p className="font-korean text-xs text-panel-sub mb-3">
            버튼 하나로 자녀 화면에 응원 팝업을 띄워줘요!
          </p>

          {/* 대상 자녀 선택 */}
          <p className="font-korean text-xs font-bold text-panel-sub mb-1">누구에게?</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {children.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCheerTarget(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border-2 font-korean text-sm font-bold transition-colors
                  ${cheerTarget === c.id
                    ? 'border-pink bg-pink/20 text-pink'
                    : 'border-panel-border bg-panel-darkest text-cream hover:border-pink/50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* 응원 문구 빠른 선택 */}
          <p className="font-korean text-xs font-bold text-panel-sub mb-1">응원 문구</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {[
              '포기하지 마! 엄마가 항상 응원해! 🔥',
              '할 수 있어! 넌 최고야 💖',
              '오늘도 파이팅! 엄마가 사랑해 🌟',
              '힘내! 힘들면 쉬어도 돼, 하지만 포기는 금지야 🌈',
            ].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setCheerText(preset)}
                className={`text-left px-3 py-2 border-2 font-korean text-sm transition-colors
                  ${cheerText === preset
                    ? 'border-pink bg-pink/20 text-cream'
                    : 'border-panel-border bg-panel-darkest text-panel-sub hover:border-pink/40'}`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            value={cheerText}
            onChange={e => setCheerText(e.target.value)}
            placeholder="직접 입력..."
            maxLength={60}
            className={`${INPUT_CLS} mb-3`}
          />

          <PixelButton
            variant="purple"
            size="lg"
            fullWidth
            disabled={!cheerTarget || !cheerText.trim() || cheerSending}
            onClick={handleSendCheer}
          >
            {cheerSending ? '전송 중...' : '💌 응원 팝업 발송'}
          </PixelButton>

          {cheerToast && (
            <p className="font-korean text-xs text-gold text-center mt-2">{cheerToast}</p>
          )}
        </div>
      )}

      {/* ── 아빠 전용: 마스터 관리자 패널 ──────────────────────── */}
      {isDad && (
        <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/master')}>
          🛠️ 마스터 관리자 패널
        </PixelButton>
      )}

      {/* ── 공통 메뉴 ──────────────────────────────────────────── */}
      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/rewards-send')}>
        🎁 아이들 보상주기
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/begging/manage')}>
        🙏 조르기 요청 관리
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/question-answers')}>
        💌 두근두근 질문함
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/special-days')}>
        📅 기념일·생일 관리
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/settings/notices')}>
        📢 공지사항 관리
      </PixelButton>

      <PixelButton variant="gold" size="lg" fullWidth onClick={() => navigate('/statistics')}>
        📊 통계 보기
      </PixelButton>

      {/* ── 로그아웃 ──────────────────────────────────────────── */}
      <div className="pt-2">
        <PixelButton variant="danger" size="lg" fullWidth onClick={handleLogout}>
          로그아웃
        </PixelButton>
      </div>
    </div>
  )
}
