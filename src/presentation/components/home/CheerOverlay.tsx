// 실시간 격려 팝업 — 엄마/아빠가 발송 → 자녀 화면에 오버레이
import { useState, useEffect } from 'react'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import {
  subscribeUnreadCheers,
  markCheerRead,
  type CheerMessage,
} from '@/infrastructure/firebase/collections/cheerMessages'
import type { Role } from '@/domain/entities/Member'

interface Props {
  familyId: string
  memberId: string
}

export function CheerOverlay({ familyId, memberId }: Props) {
  const [pending, setPending] = useState<CheerMessage[]>([])
  const [current, setCurrent] = useState<CheerMessage | null>(null)

  useEffect(() => {
    if (!familyId || !memberId) return
    return subscribeUnreadCheers(familyId, memberId, setPending)
  }, [familyId, memberId])

  // 미읽음 메시지가 생기면 현재 팝업이 없을 때 다음 것을 꺼냄
  useEffect(() => {
    if (pending.length > 0 && !current) {
      setCurrent(pending[0])
    }
  }, [pending, current])

  const handleDismiss = async () => {
    if (!current) return
    await markCheerRead(familyId, current.id)
    setCurrent(null)
  }

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        className="bg-panel-dark border-4 border-gold mx-4 p-6 max-w-sm w-full text-center
                   shadow-[0_0_40px_#FFD70050,inset_2px_2px_0px_#ffffff20]"
        onClick={e => e.stopPropagation()}
      >
        {/* 발신자 캐릭터 */}
        <div className="flex justify-center mb-3">
          <CharacterSprite
            characterId={current.senderCharacterId || 'warrior'}
            role={current.senderRole as Role}
            size="xl"
            variant="job"
            animate="bob"
          />
        </div>

        {/* 발신자 이름 */}
        <p className="t-heading text-gold t-pixel-shadow mb-1">
          {current.senderName}의 응원 💖
        </p>

        {/* 말풍선 */}
        <div className="speech-bubble border-pink mt-3 mb-5 text-left">
          <p className="font-korean text-base text-cream leading-relaxed">
            &ldquo;{current.content}&rdquo;
          </p>
        </div>

        {/* 닫기 버튼 */}
        <PixelButton variant="gold" size="lg" fullWidth onClick={handleDismiss}>
          💪 힘내서 해볼게요!
        </PixelButton>
      </div>
    </div>
  )
}
