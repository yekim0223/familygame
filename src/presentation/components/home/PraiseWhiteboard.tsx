// 칭찬 스티커 화이트보드 — 가족 모두 서로 보낼 수 있음, SVG 아이콘, 2줄 페이지네이션
import { useState, useEffect, useRef } from 'react'
import {
  subscribePraiseStickers,
  STICKER_INFO,
  type PraiseSticker,
} from '@/infrastructure/firebase/collections/praiseStickers'
import { EffectOverlay } from '@/presentation/components/effects/EffectOverlay'

interface Props {
  familyId: string
  memberId: string
}

// 2줄(열3개) = 6개 단위로 페이지네이션
const PAGE_SIZE = 6

function StickerPost({ sticker, index }: { sticker: PraiseSticker; index: number }) {
  const info = STICKER_INFO[sticker.stickerType] ?? STICKER_INFO.well_done
  const rotDeg = ((index * 7 + 2) % 9) - 4
  return (
    <div
      className={`inventory-slot !w-auto !h-auto px-2 py-1.5 flex flex-col items-center gap-0.5
                  border-2 ${info.border} min-w-[60px] max-w-[72px] select-none`}
      style={{ transform: `rotate(${rotDeg}deg)` }}
      title={sticker.message || info.label}
    >
      <img
        src={info.svg} alt={info.label}
        width={28} height={28}
        style={{ imageRendering: 'pixelated' }}
      />
      <span className="font-korean text-xs text-gold font-bold leading-tight text-center">
        {info.label}
      </span>
      {sticker.message ? (
        <span className="font-korean text-xs text-panel-sub leading-tight text-center line-clamp-2">
          {sticker.message}
        </span>
      ) : null}
      <span className="font-pixel text-xs text-gold/50 leading-none mt-0.5">
        {sticker.senderName}
      </span>
    </div>
  )
}

export function PraiseWhiteboard({ familyId, memberId }: Props) {
  const [stickers,   setStickers]   = useState<PraiseSticker[]>([])
  const [showCount,  setShowCount]  = useState(PAGE_SIZE)
  const [showEffect, setShowEffect] = useState(false)
  const prevCountRef = useRef<number>(-1)

  useEffect(() => {
    if (!familyId || !memberId) return
    return subscribePraiseStickers(familyId, memberId, (incoming) => {
      setStickers(incoming)
      if (prevCountRef.current >= 0 && incoming.length > prevCountRef.current) {
        setShowEffect(true)
      }
      prevCountRef.current = incoming.length
    })
  }, [familyId, memberId])

  const visible = stickers.slice(0, showCount)
  const hasMore = stickers.length > showCount

  return (
    <div className="card-pixel p-3">
      {showEffect && (
        <EffectOverlay type="hearts" count={22} onEnd={() => setShowEffect(false)} />
      )}
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <img src="/assets/icons/star.svg" width={16} height={16} alt="" style={{ imageRendering: 'pixelated' }} />
          <p className="t-sub text-gold t-pixel-shadow">칭찬 보드</p>
        </div>
        {stickers.length > 0 && (
          <span className="font-pixel text-xs text-gold">{stickers.length}개</span>
        )}
      </div>

      {/* 화이트보드 영역 */}
      <div className="bg-panel-darkest border-2 border-panel-border min-h-[90px] p-3">
        {stickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-2 gap-1">
            <img src="/assets/icons/gift.svg" width={36} height={36} alt="" style={{ imageRendering: 'pixelated', opacity: 0.4 }} />
            <p className="font-korean text-xs text-panel-sub text-center">
              아직 칭찬 스티커가 없어요
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-start">
            {visible.map((s, i) => (
              <StickerPost key={s.id} sticker={s} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* 더보기 버튼 */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowCount(c => c + PAGE_SIZE)}
          className="mt-2 w-full font-korean text-xs text-panel-sub text-center
                     hover:text-cream transition-colors active:scale-95"
        >
          ▼ 더 보기 (+{Math.min(PAGE_SIZE, stickers.length - showCount)}개)
        </button>
      )}
    </div>
  )
}
