// 엄마의 칭찬 스티커 화이트보드 — 아이별 누적 노출
import { useState, useEffect } from 'react'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import {
  subscribePraiseStickers,
  STICKER_INFO,
  type PraiseSticker,
} from '@/infrastructure/firebase/collections/praiseStickers'

interface Props {
  familyId: string
  memberId: string
}

const MAX_VISIBLE = 9

function StickerPost({
  sticker,
  index,
}: {
  sticker: PraiseSticker
  index: number
}) {
  const info = STICKER_INFO[sticker.stickerType] ?? STICKER_INFO.well_done
  // 미세 회전으로 포스트잇 느낌
  const rotDeg = ((index * 7 + 2) % 9) - 4
  return (
    <div
      className={`inventory-slot !w-auto !h-auto px-2 py-1.5 flex flex-col items-center gap-0.5
                  border-2 ${info.border} min-w-[60px] max-w-[72px] select-none`}
      style={{ transform: `rotate(${rotDeg}deg)` }}
      title={sticker.message || info.label}
    >
      <span className="text-2xl leading-none">{info.emoji}</span>
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
  const [showAll,    setShowAll]    = useState(false)

  useEffect(() => {
    if (!familyId || !memberId) return
    return subscribePraiseStickers(familyId, memberId, setStickers)
  }, [familyId, memberId])

  const visible = stickers.slice(0, MAX_VISIBLE)
  const extra   = stickers.length - MAX_VISIBLE

  return (
    <div className="card-pixel p-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <p className="t-sub text-gold t-pixel-shadow">📌 엄마의 칭찬 보드</p>
        {stickers.length > 0 && (
          <span className="font-pixel text-xs text-gold">{stickers.length}개</span>
        )}
      </div>

      {/* 화이트보드 영역 */}
      <div className="bg-panel-darkest border-2 border-panel-border min-h-[90px] p-3">
        {stickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-2 gap-1">
            <span className="text-3xl">📭</span>
            <p className="font-korean text-xs text-panel-sub text-center">
              아직 칭찬 스티커가 없어요
            </p>
            <p className="font-korean text-xs text-panel-sub text-center">
              열심히 하면 붙여줄게요! 🌟
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-start">
            {visible.map((s, i) => (
              <StickerPost key={s.id} sticker={s} index={i} />
            ))}
            {extra > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inventory-slot !w-auto !h-auto px-3 py-2 flex items-center justify-center
                           border-2 border-panel-border hover:border-gold transition-colors"
              >
                <span className="font-korean text-xs text-gold">+{extra}개 더</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 전체 보기 팝업 */}
      <PixelModal
        open={showAll}
        title="📌 칭찬 스티커 전체"
        onClose={() => setShowAll(false)}
        size="sm"
      >
        <div className="max-h-64 overflow-y-auto">
          <div className="flex flex-wrap gap-2 items-start p-1">
            {stickers.map((s, i) => (
              <StickerPost key={s.id} sticker={s} index={i} />
            ))}
          </div>
        </div>
      </PixelModal>
    </div>
  )
}
