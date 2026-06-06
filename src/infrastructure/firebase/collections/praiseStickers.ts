// 칭찬 스티커 컬렉션 — families/{familyId}/praise_stickers
import { where, orderBy } from 'firebase/firestore'
import { fsAdd, fsSubscribe, fsQuery, fsDelete, toDate } from '../firestore'

export type StickerType =
  | 'well_done' | 'champion'    | 'heart'     | 'happy'
  | 'lightning' | 'sword_hero'  | 'gift'      | 'game_king'
  | 'music_star'| 'super'       | 'letter'    | 'mega'
  | 'home_love' | 'check_done'  | 'adventure' | 'love_heart'

export const STICKER_INFO: Record<StickerType, { svg: string; label: string; border: string }> = {
  well_done:  { svg: '/assets/icons/star.svg',             label: '참 잘했어요', border: 'border-gold'     },
  champion:   { svg: '/assets/icons/trophy.svg',           label: '챔피언!',     border: 'border-gold'     },
  heart:      { svg: '/assets/icons/emotion-love.svg',     label: '사랑해요',    border: 'border-pink'     },
  happy:      { svg: '/assets/icons/emotion-happy.svg',    label: '행복해요',    border: 'border-gold'     },
  lightning:  { svg: '/assets/icons/lightning.svg',        label: '슈퍼파워!',   border: 'border-gold'     },
  sword_hero: { svg: '/assets/icons/sword.svg',            label: '용사왕!',     border: 'border-purple'   },
  gift:       { svg: '/assets/icons/gift.svg',             label: '선물왕',      border: 'border-sky'      },
  game_king:  { svg: '/assets/icons/gamepad.svg',          label: '게임왕',      border: 'border-purple'   },
  music_star: { svg: '/assets/icons/music.svg',            label: '음악천재',    border: 'border-sky'      },
  super:      { svg: '/assets/icons/emotion-surprise.svg', label: '깜짝천재!',   border: 'border-gold'     },
  letter:     { svg: '/assets/icons/letter.svg',           label: '소통왕',      border: 'border-sky'      },
  mega:       { svg: '/assets/icons/megaphone.svg',        label: '리더왕!',     border: 'border-gold'     },
  home_love:  { svg: '/assets/icons/home.svg',             label: '가족사랑',    border: 'border-pink'     },
  check_done: { svg: '/assets/icons/check-circle.svg',     label: '완벽해!',     border: 'border-approved' },
  adventure:  { svg: '/assets/icons/bag.svg',              label: '모험가',      border: 'border-purple'   },
  love_heart: { svg: '/assets/icons/begging.svg',          label: '정성왕',      border: 'border-pink'     },
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

export async function clearPraiseStickers(
  familyId: string,
  targetMemberId: string
): Promise<void> {
  const { data } = await fsQuery<PraiseSticker>(col(familyId), [
    where('targetMemberId', '==', targetMemberId),
  ])
  await Promise.all(data.map(s => fsDelete(`${col(familyId)}/${s.id}`)))
}
