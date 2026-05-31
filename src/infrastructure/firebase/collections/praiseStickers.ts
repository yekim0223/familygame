// 칭찬 스티커 컬렉션 — families/{familyId}/praise_stickers
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsSubscribe, toDate } from '../firestore'

export type StickerType =
  | 'well_done' | 'star' | 'heart' | 'trophy'
  | 'rainbow'  | 'fire' | 'crown' | 'sparkle'

export const STICKER_INFO: Record<StickerType, { emoji: string; label: string; border: string }> = {
  well_done: { emoji: '🌟', label: '참 잘했어요',  border: 'border-gold'     },
  star:      { emoji: '⭐', label: '성실왕',       border: 'border-gold'     },
  heart:     { emoji: '💖', label: '사랑해요',     border: 'border-pink'     },
  trophy:    { emoji: '🏆', label: '챔피언!',      border: 'border-gold'     },
  rainbow:   { emoji: '🌈', label: '무지개 칭찬',  border: 'border-sky'      },
  fire:      { emoji: '🔥', label: '열정 만점',    border: 'border-rejected' },
  crown:     { emoji: '👑', label: '최고야!',      border: 'border-gold'     },
  sparkle:   { emoji: '✨', label: '반짝반짝',     border: 'border-purple'   },
}

export interface PraiseSticker {
  id: string
  senderId: string
  senderName: string
  targetMemberId: string
  stickerType: StickerType
  message: string
  createdAt: Date
}

function col(familyId: string) { return `families/${familyId}/praise_stickers` }

function toSticker(raw: any): PraiseSticker {
  return { ...raw, createdAt: toDate(raw.createdAt) } as PraiseSticker
}

export function subscribePraiseStickers(
  familyId: string,
  targetMemberId: string,
  onData: (stickers: PraiseSticker[]) => void
): () => void {
  return fsSubscribe<any>(
    col(familyId),
    [where('targetMemberId', '==', targetMemberId), orderBy('createdAt', 'desc')],
    raw => onData(raw.map(toSticker))
  )
}

export async function sendPraiseSticker(
  familyId: string,
  senderId: string,
  senderName: string,
  targetMemberId: string,
  stickerType: StickerType,
  message = ''
): Promise<{ error: string | null }> {
  const { error } = await fsAdd(col(familyId), {
    senderId, senderName, targetMemberId, stickerType, message,
  })
  return { error }
}
