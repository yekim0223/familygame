// Design Ref: §5.3 SCR-15,16 MessagesPage — 그룹채팅 + 1:1 DM
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useMessages } from '@/presentation/hooks/useMessages'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMessageStore } from '@/infrastructure/stores/messageStore'
import {
  sendMessage, sendDirectMessage,
  subscribeDirectChat, subscribeReceivedDMs,
  markMessageRead, markGroupMessagesRead, deleteMessage,
  toggleReaction,
} from '@/infrastructure/firebase/collections/messages'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'
import type { Message } from '@/domain/entities/Message'
import type { Member } from '@/domain/entities/Member'

type MessageTab = 'group' | 'direct'
type EmojiCat = '감정' | '동물' | '사물' | '음식'

const EMOJI_CATS: Record<EmojiCat, string[]> = {
  '감정': [
    '😄','😆','🥰','😎','🤣','😅','😭','😤',
    '🥺','😱','🤩','😴','🤔','😏','👻','😡',
    '🥳','😇','🤗','😬','😑','🤭','😶','😲',
    '🤑','😋','😍','🤪','😜','😛','🫡','💀',
  ],
  '동물': [
    '🐶','🐱','🐻','🐼','🦊','🐸','🦁','🐯',
    '🐨','🐙','🦄','🐠','🦋','🐧','🐺','🐮',
    '🐷','🐔','🐦','🦆','🦉','🦇','🐝','🐛',
    '🐢','🦎','🐍','🐊','🦕','🦖','🐬','🐳',
  ],
  '사물': [
    '⭐','🏆','🎮','🎯','🎲','🎸','⚽','🏀',
    '🎨','🚀','💎','🔥','✨','💡','🌈','💫',
    '⚡','🌙','☀️','🌊','🌸','🍀','🎃','🎄',
    '🎁','🎀','🎈','🎉','🎊','📱','💻','📚',
  ],
  '음식': [
    '🍕','🍔','🍦','🍰','🍩','🍫','🍣','🍜',
    '🍎','🍓','🥤','🧁','🍟','🌮','🎂','🍳',
    '🧆','🍱','🍛','🍝','🍿','🥨','🥞','🧇',
    '🍇','🍉','🥝','🍑','🥭','🍋','🍒','🥑',
  ],
}

// ── 리액션 이모지 5종 ─────────────────────────────────────────────
const REACTION_EMOJIS = ['👍', '👎', '😲', '😭', '🔥'] as const

// ── 헬퍼 ──────────────────────────────────────────────────────────

function getMemberInfo(id: string): { name: string; role: string; characterId: string } {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return { name: '', role: '', characterId: 'warrior' }
    const { members } = JSON.parse(raw)
    const m = (members as any[]).find(m => m.id === id)
    return m
      ? { name: m.name || m.realName || '', role: m.role || '', characterId: m.character?.characterId || 'warrior' }
      : { name: '', role: '', characterId: 'warrior' }
  } catch { return { name: '', role: '', characterId: 'warrior' } }
}

const CHILD_COLORS = ['bg-approved text-white', 'bg-gold text-pixel-dark']
function childColorCls(id: string): string {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % CHILD_COLORS.length
  return CHILD_COLORS[h]
}
function senderTagCls(role: string, id: string): string {
  if (role === 'DAD')   return 'bg-sky text-white'
  if (role === 'MOM')   return 'bg-pink text-pixel-dark'
  if (role === 'CHILD') return childColorCls(id)
  return 'bg-stone text-white'
}

const CHILD_BUBBLE_BORDERS = ['border-approved', 'border-gold'] as const
function getBubbleBorderCls(role: string, id: string): string {
  if (role === 'DAD')   return 'border-sky'
  if (role === 'MOM')   return 'border-pink'
  if (role === 'CHILD') {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % CHILD_BUBBLE_BORDERS.length
    return CHILD_BUBBLE_BORDERS[h]
  }
  return 'border-panel-border'
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatDateLabel(dk: string) {
  const [, m, d] = dk.split('-'); return `${m}월 ${d}일`
}

const ROLE_LABEL: Record<string, string> = { DAD: '아빠', MOM: '엄마', CHILD: '자녀', OBSERVER: '옵저버' }
const ROLE_COLOR: Record<string, string> = {
  DAD: 'bg-sky text-white', MOM: 'bg-pink text-pixel-dark',
  CHILD: 'bg-approved text-white', OBSERVER: 'bg-stone text-white',
}

// ── ReactionPicker — 롱프레스 후 나타나는 이모지 팝업 ─────────────

function ReactionPicker({
  messageId, familyId, myId,
  currentReactions, isMine,
  onClose, onDelete,
}: {
  messageId: string
  familyId: string
  myId: string
  currentReactions: Record<string, string[]>
  isMine: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const handleReact = async (emoji: string) => {
    await toggleReaction(familyId, messageId, emoji, myId, currentReactions)
    onClose()
  }
  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 bg-panel-darkest border-2 border-gold/60
                 shadow-[0_4px_16px_#00000080] z-50"
      onClick={e => e.stopPropagation()}
    >
      {REACTION_EMOJIS.map(emoji => {
        const reacted = (currentReactions[emoji] ?? []).includes(myId)
        return (
          <button
            key={emoji}
            type="button"
            onPointerDown={e => { e.stopPropagation(); handleReact(emoji) }}
            className={[
              'w-10 h-10 flex items-center justify-center text-xl',
              'border-2 transition-all duration-100 active:scale-90',
              reacted
                ? 'border-gold bg-gold/20'
                : 'border-panel-border bg-panel-dark hover:border-gold/60 hover:bg-gold/10',
            ].join(' ')}
          >
            {emoji}
          </button>
        )
      })}
      {isMine && (
        <button
          type="button"
          onPointerDown={e => { e.stopPropagation(); onDelete(); onClose() }}
          className="w-10 h-10 flex items-center justify-center text-xl
                     border-2 border-rejected bg-panel-dark hover:bg-rejected/20
                     transition-all duration-100 active:scale-90"
        >
          🗑️
        </button>
      )}
    </div>
  )
}

// ── ReactionChips — 메시지 하단 리액션 카운트 표시 ──────────────────

function ReactionChips({
  reactions, myId, members, messageId, familyId,
}: {
  reactions: Record<string, string[]>
  myId: string
  members: Member[]
  messageId: string
  familyId: string
}) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0)
  if (entries.length === 0) return null

  const getName = (id: string) => members.find(m => m.id === id)?.name ?? getMemberInfo(id).name ?? id

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, ids]) => {
        const iMine = ids.includes(myId)
        const names = ids.map(getName).join(', ')
        return (
          <button
            key={emoji}
            type="button"
            onPointerDown={e => {
              e.stopPropagation()
              toggleReaction(familyId, messageId, emoji, myId, reactions)
            }}
            onMouseEnter={() => setTooltip(emoji)}
            onMouseLeave={() => setTooltip(null)}
            className={[
              'relative flex items-center gap-0.5 px-1.5 py-0.5',
              'border-2 font-pixel text-xs leading-none transition-all active:scale-95',
              iMine
                ? 'border-gold bg-gold/20 text-gold'
                : 'border-panel-border bg-panel-dark text-cream/80',
            ].join(' ')}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span>{ids.length}</span>
            {tooltip === emoji && (
              <div className="absolute bottom-full left-0 mb-1 z-50 whitespace-nowrap
                              bg-panel-darkest border border-gold/40 px-2 py-1
                              font-korean text-xs text-cream shadow-lg pointer-events-none">
                {names}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────

function MessageBubble({
  message, isMine, showName, unreadCount,
  familyId, myId, members, onDelete,
}: {
  message: Message
  isMine: boolean
  showName: boolean
  unreadCount: number
  familyId: string
  myId: string
  members: Member[]
  onDelete: (id: string) => void
}) {
  const { name, role, characterId } = getMemberInfo(message.senderId)
  const timeStr = new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const tagCls  = senderTagCls(role, message.senderId)

  const [showPicker, setShowPicker] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactions = message.reactions ?? {}

  const startLongPress = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 480)
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }, [])

  return (
    <div
      className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} mb-3`}
      onClick={() => showPicker && setShowPicker(false)}
    >
      {!isMine && showName && (
        <div className="flex-shrink-0 self-end mb-4">
          <CharacterSprite characterId={characterId} role={role as any} size="sm" variant="job" />
        </div>
      )}
      {!isMine && !showName && <div className="w-8 flex-shrink-0" />}

      <div className={`max-w-[72%] min-w-0 flex flex-col relative ${isMine ? 'items-end' : 'items-start'}`}>
        {showName && name && (
          <span className={`font-korean text-xs font-bold px-2 py-0.5 mb-1 border-2 border-black t-pixel-shadow ${tagCls}`}>
            {name}
          </span>
        )}

        {/* 리액션 피커 팝업 — 말풍선 위 */}
        {showPicker && (
          <div className={`absolute ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1 z-50`}>
            <ReactionPicker
              messageId={message.id}
              familyId={familyId}
              myId={myId}
              currentReactions={reactions}
              isMine={isMine}
              onClose={() => setShowPicker(false)}
              onDelete={() => onDelete(message.id)}
            />
          </div>
        )}

        {/* 말풍선 — 보라색(내 메시지) vs 역할별 테두리(상대방) — 탭색(sky/pink)과 명도 대비 확보 */}
        <div
          className={[
            'speech-bubble break-words min-w-0 cursor-pointer select-none',
            isMine
              ? 'bg-purple text-white border-purple/80 shadow-[inset_2px_2px_0px_#ffffff20]'
              : `${getBubbleBorderCls(role, message.senderId)} shadow-[inset_2px_2px_0px_#ffffff15,inset_-2px_-2px_0px_#00000060]`,
          ].join(' ')}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          onTouchCancel={cancelLongPress}
          onContextMenu={e => { e.preventDefault(); setShowPicker(p => !p) }}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
        >
          {message.content}
        </div>

        {/* 리액션 칩 */}
        {Object.keys(reactions).length > 0 && (
          <ReactionChips
            reactions={reactions}
            myId={myId}
            members={members}
            messageId={message.id}
            familyId={familyId}
          />
        )}

        {/* 시간 + 읽음 수 */}
        <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          {isMine && unreadCount > 0 && (
            <span className="font-pixel text-xs text-gold leading-none">{unreadCount}</span>
          )}
          <span className="font-korean text-xs text-cream/60">{timeStr}</span>
        </div>
      </div>
    </div>
  )
}

// ── EmojiPanel ─────────────────────────────────────────────────────

function EmojiPanel({ onPick, emojiCat, setEmojiCat }: {
  onPick: (e: string) => void
  emojiCat: EmojiCat
  setEmojiCat: (c: EmojiCat) => void
}) {
  return (
    <div className="border-b-2 border-black bg-panel-darkest">
      <div className="flex border-b-2 border-black">
        {(Object.keys(EMOJI_CATS) as EmojiCat[]).map(cat => (
          <button key={cat} type="button" onClick={() => setEmojiCat(cat)}
            className={`flex-1 py-2 font-korean text-sm font-bold border-r-2 border-black last:border-r-0 transition-colors
              ${emojiCat === cat ? 'bg-sky text-pixel-dark' : 'bg-panel-dark text-cream hover:bg-sky/20'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8">
        {EMOJI_CATS[emojiCat].map(e => (
          <button key={e} type="button" onClick={() => onPick(e)}
            className="aspect-square flex items-center justify-center text-2xl hover:bg-gold/20 active:bg-gold/40 transition-colors">
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── MessageInputBar ────────────────────────────────────────────────

function MessageInputBar({ onSend, disabled, showEmojiPanel, setShowEmojiPanel, emojiCat, setEmojiCat }: {
  onSend: (text: string) => Promise<void>
  disabled?: boolean
  showEmojiPanel: boolean
  setShowEmojiPanel: (v: boolean) => void
  emojiCat: EmojiCat
  setEmojiCat: (c: EmojiCat) => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const t = text.trim()
    if (!t || disabled || sending) return
    setSending(true)
    setShowEmojiPanel(false)
    await onSend(t)
    setText('')
    setSending(false)
  }

  return (
    <div className="flex-shrink-0 border-t-4 border-black bg-panel-darkest">
      {showEmojiPanel && (
        <EmojiPanel
          emojiCat={emojiCat}
          setEmojiCat={setEmojiCat}
          onPick={e => setText(prev => prev + e)}
        />
      )}
      <div className="flex gap-2 p-2">
        <button type="button" onClick={() => setShowEmojiPanel(!showEmojiPanel)}
          className={`w-10 h-10 border-4 flex items-center justify-center text-xl flex-shrink-0
            ${showEmojiPanel ? 'bg-sky/20 border-sky' : 'bg-panel-dark border-black hover:border-sky'}`}>
          😊
        </button>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="메시지 입력..."
          className="flex-1 min-w-0 bg-panel-darkest text-gold font-korean text-sm
                     border-4 border-black px-3 py-2
                     focus:outline-none focus:border-sky
                     shadow-[inset_3px_3px_0px_#00000090]" />
        <PixelButton
          variant="purple"
          size="md"
          disabled={sending || !text.trim() || disabled}
          onClick={handleSend}
          className="flex-shrink-0"
        >
          전송
        </PixelButton>
      </div>
    </div>
  )
}

// ── 날짜 구분선 포함 메시지 렌더 ──────────────────────────────────────

function renderMessageList(
  messages: Message[],
  myId: string,
  familyId: string,
  members: Member[],
  totalActiveMembers: number,
  isDM: boolean,
  partnerId: string | null,
  onDeleteMsg: (id: string) => void,
): JSX.Element[] {
  const items: JSX.Element[] = []
  let lastDate = '', lastSenderId = ''
  messages.forEach(msg => {
    const dk = toDateKey(new Date(msg.createdAt))
    if (dk !== lastDate) {
      items.push(
        <div key={`d-${dk}`} className="chat-date-divider my-3">
          <span>{formatDateLabel(dk)}까지 메시지입니다</span>
        </div>
      )
      lastDate = dk; lastSenderId = ''
    }
    const isMine   = msg.senderId === myId
    const showName = !isMine && msg.senderId !== lastSenderId

    let unreadCount = 0
    if (isMine) {
      if (isDM && partnerId) {
        unreadCount = msg.readBy.includes(partnerId) ? 0 : 1
      } else {
        unreadCount = Math.max(0, totalActiveMembers - msg.readBy.length)
      }
    }

    items.push(
      <MessageBubble
        key={msg.id}
        message={msg}
        isMine={isMine}
        showName={showName}
        unreadCount={unreadCount}
        familyId={familyId}
        myId={myId}
        members={members}
        onDelete={onDeleteMsg}
      />
    )
    lastSenderId = msg.senderId
  })
  return items
}

// ════════════════════════════════════════════════════════════════

export default function MessagesPage() {
  const { familyId, currentMember } = useAuthStore()
  const { markGroupRead }           = useMessageStore()
  const { groupMessages }           = useMessages()
  const myId = currentMember?.id ?? ''
  const isObserver = currentMember?.role === 'OBSERVER'

  const [activeTab,       setActiveTab]       = useState<MessageTab>('group')
  const [showEmojiPanel,  setShowEmojiPanel]  = useState(false)
  const [emojiCat,        setEmojiCat]        = useState<EmojiCat>('감정')
  const [deleteConfirm,   setDeleteConfirm]   = useState<string | null>(null)

  // ── 그룹 채팅 ────────────────────────────────────────────────
  const groupRef = useRef<HTMLDivElement>(null)
  const scrollGroupBottom = () => {
    if (groupRef.current) groupRef.current.scrollTop = groupRef.current.scrollHeight
  }

  useEffect(() => {
    if (activeTab !== 'group' || !myId || !familyId) return
    markGroupRead(myId)
    markGroupMessagesRead(familyId, groupMessages, myId)
  }, [activeTab, familyId, myId])

  useEffect(() => {
    if (activeTab !== 'group') return
    scrollGroupBottom()
    if (familyId && myId) markGroupMessagesRead(familyId, groupMessages, myId)
  }, [groupMessages, activeTab])

  // ── 멤버 목록 ────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([])
  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  const activeMembers = useMemo(() => members.filter(m => m.isActive), [members])

  // ── DM — 받은 메시지 전체 (unread 뱃지) ─────────────────────
  const [receivedDMs, setReceivedDMs] = useState<Message[]>([])
  useEffect(() => {
    if (!familyId || !myId) return
    return subscribeReceivedDMs(familyId, myId, setReceivedDMs)
  }, [familyId, myId])

  const unreadBySender = useMemo(() => {
    if (!myId) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    receivedDMs
      .filter(m => !m.readBy.includes(myId))
      .forEach(m => { counts[m.senderId] = (counts[m.senderId] ?? 0) + 1 })
    return counts
  }, [receivedDMs, myId])

  const totalDMUnread = useMemo(() =>
    Object.values(unreadBySender).reduce((s, n) => s + n, 0),
    [unreadBySender]
  )

  // ── DM — 대화 상대 선택 / 메시지 구독 ────────────────────────
  const [partnerId,  setPartnerId]  = useState<string | null>(null)
  const [directMsgs, setDirectMsgs] = useState<Message[]>([])
  const directRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!familyId || !myId || !partnerId) { setDirectMsgs([]); return }
    return subscribeDirectChat(familyId, myId, partnerId, setDirectMsgs)
  }, [familyId, myId, partnerId])

  useEffect(() => {
    if (!familyId || !myId || !partnerId) return
    directMsgs
      .filter(m => m.senderId === partnerId && !m.readBy.includes(myId))
      .forEach(m => markMessageRead(familyId, m.id, myId, m.readBy))
  }, [directMsgs, familyId, myId, partnerId])

  // 규칙 8: scrollIntoView 금지, scrollTop = scrollHeight 사용
  useEffect(() => {
    if (directRef.current) directRef.current.scrollTop = directRef.current.scrollHeight
  }, [directMsgs])

  const partner      = members.find(m => m.id === partnerId)
  const otherMembers = activeMembers.filter(m => m.id !== myId)

  // ── 전송 핸들러 ──────────────────────────────────────────────
  const handleGroupSend = async (text: string) => {
    if (!familyId || !myId) return
    await sendMessage(familyId, myId, text, null)
  }

  const handleDMSend = async (text: string) => {
    if (!familyId || !myId || !partnerId) return
    await sendDirectMessage(familyId, myId, partnerId, text)
  }

  const handleTabChange = (tab: MessageTab) => {
    setActiveTab(tab)
    setShowEmojiPanel(false)
    if (tab !== 'direct') setPartnerId(null)
  }

  const handleDeleteRequest = (id: string) => setDeleteConfirm(id)

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !familyId) return
    await deleteMessage(familyId, deleteConfirm)
    setDeleteConfirm(null)
  }

  // ════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-112px)] overflow-hidden">

      {/* ── 탭 바 — sky(그룹) / pink(DM): 보라색 말풍선과 명도 3:1+ 대비 ── */}
      <div className="flex border-b-4 border-black flex-shrink-0 bg-panel-darkest">
        <button type="button" onClick={() => handleTabChange('group')}
          className={`flex-1 py-3 font-korean text-sm font-bold border-r-2 border-black transition-colors
            ${activeTab === 'group'
              ? 'bg-sky text-pixel-dark'
              : 'bg-panel-darkest text-cream/70 hover:bg-sky/10'}`}>
          💌 그룹채팅
        </button>
        <button type="button" onClick={() => handleTabChange('direct')}
          className={`relative flex-1 py-3 font-korean text-sm font-bold transition-colors
            ${activeTab === 'direct'
              ? 'bg-pink text-pixel-dark'
              : 'bg-panel-darkest text-cream/70 hover:bg-pink/10'}`}>
          👤 1:1 채팅
          {totalDMUnread > 0 && (
            <span className="absolute top-1.5 right-3 min-w-[18px] h-[18px] bg-rejected text-white
                             font-pixel text-xs rounded-none flex items-center justify-center px-1
                             border border-white">
              {totalDMUnread > 9 ? '9+' : totalDMUnread}
            </span>
          )}
        </button>
      </div>

      {/* ── 그룹 채팅 ──────────────────────────────────────────── */}
      {activeTab === 'group' && (
        <>
          <div ref={groupRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-2 pb-1">
            {groupMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-korean text-sm text-cream font-bold">아직 대화가 없어요 💌</p>
                <p className="font-korean text-xs text-cream/60 mt-1">첫 메시지를 보내봐요!</p>
              </div>
            ) : renderMessageList(
              groupMessages, myId, familyId ?? '', members,
              activeMembers.length, false, null, handleDeleteRequest
            )}
          </div>

          {isObserver ? (
            <div className="flex-shrink-0 p-3 border-t-4 border-black text-center">
              <p className="font-korean text-xs text-cream/60">읽기 전용 (옵저버)</p>
            </div>
          ) : (
            <MessageInputBar
              onSend={handleGroupSend}
              showEmojiPanel={showEmojiPanel}
              setShowEmojiPanel={setShowEmojiPanel}
              emojiCat={emojiCat}
              setEmojiCat={setEmojiCat}
            />
          )}
        </>
      )}

      {/* ── 1:1 채팅 — 파트너 미선택 ────────────────────────── */}
      {activeTab === 'direct' && !partnerId && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 pt-5 pb-3">
            <p className="font-korean text-base font-bold text-cream">대화할 가족을 선택해주세요</p>
          </div>

          {otherMembers.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-korean text-sm text-cream/60">가족 구성원이 없어요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 px-3 py-2">
              {otherMembers.map(member => {
                const unread  = unreadBySender[member.id] ?? 0
                const tagCls  = ROLE_COLOR[member.role] ?? 'bg-stone text-white'
                return (
                  <button key={member.id} type="button"
                    onClick={() => { setPartnerId(member.id); setShowEmojiPanel(false) }}
                    className="card-pixel flex items-center gap-3 px-4 py-3 hover:bg-gold/10
                               active:bg-gold/20 transition-colors text-left w-full">
                    <div className="flex-shrink-0">
                      <CharacterSprite
                        characterId={member.character.characterId}
                        role={member.role}
                        size="md"
                        variant="job"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-korean text-base font-bold text-cream truncate">
                          {member.name}
                        </span>
                        <span className={`font-korean text-xs font-bold px-1.5 py-0.5 border border-black flex-shrink-0 ${tagCls}`}>
                          {ROLE_LABEL[member.role] ?? member.role}
                        </span>
                      </div>
                      {member.realName && member.realName !== member.name && (
                        <p className="font-korean text-xs text-panel-sub mt-0.5">{member.realName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {unread > 0 && (
                        <span className="min-w-[22px] h-[22px] bg-rejected text-white font-pixel text-xs
                                         flex items-center justify-center px-1 border border-white">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                      <span className="font-pixel text-cream/50 text-xs">›</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 1:1 채팅 — 대화 화면 ──────────────────────────── */}
      {activeTab === 'direct' && partnerId && (
        <>
          {/* 헤더 — 상대방 크고 직관적으로 앵커 */}
          <div className="flex-shrink-0 bg-panel-darkest border-b-4 border-pink/60">
            {/* 뒤로가기 + 안내 */}
            <div className="flex items-center px-3 py-2 border-b border-panel-border/30">
              <button type="button"
                onClick={() => { setPartnerId(null); setShowEmojiPanel(false) }}
                className="flex items-center gap-1 px-3 py-1.5 bg-panel-dark border-4 border-panel-border
                           font-korean text-sm font-bold text-cream
                           hover:border-pink active:scale-95 transition-all">
                ← 뒤로
              </button>
              <span className="ml-auto font-korean text-xs text-cream/40">
                가족만 볼 수 있어요
              </span>
            </div>

            {/* 상대방 프로필 — 크고 직관적 */}
            {partner && (
              <div className="flex flex-col items-center py-4 gap-2">
                <div className="scale-125 mb-1">
                  <CharacterSprite
                    characterId={partner.character.characterId}
                    role={partner.role}
                    size="lg"
                    variant="job"
                  />
                </div>
                <div className="text-center">
                  <p className="t-heading text-cream t-pixel-shadow">{partner.name}</p>
                  {partner.realName && partner.realName !== partner.name && (
                    <p className="font-korean text-xs text-panel-sub mt-0.5">({partner.realName})</p>
                  )}
                  <span className={`inline-block mt-1.5 font-korean text-xs font-bold px-2 py-0.5 border border-black
                    ${ROLE_COLOR[partner.role] ?? 'bg-stone text-white'}`}>
                    {ROLE_LABEL[partner.role] ?? partner.role}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 메시지 목록 */}
          <div ref={directRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-2 pb-1">
            {directMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
                <p className="text-3xl">💌</p>
                <p className="font-korean text-sm text-cream font-bold">
                  {partner?.name ?? ''}와 첫 대화를 시작해봐요!
                </p>
                <p className="font-korean text-xs text-cream/60">메시지는 가족끼리만 볼 수 있어요</p>
              </div>
            ) : renderMessageList(
              directMsgs, myId, familyId ?? '', members,
              2, true, partnerId, handleDeleteRequest
            )}
          </div>

          {isObserver ? (
            <div className="flex-shrink-0 p-3 border-t-4 border-black text-center">
              <p className="font-korean text-xs text-cream/60">읽기 전용 (옵저버)</p>
            </div>
          ) : (
            <MessageInputBar
              onSend={handleDMSend}
              showEmojiPanel={showEmojiPanel}
              setShowEmojiPanel={setShowEmojiPanel}
              emojiCat={emojiCat}
              setEmojiCat={setEmojiCat}
            />
          )}
        </>
      )}

      {/* ── 삭제 확인 팝업 (규칙 3: PixelModal 사용) ─────────── */}
      <PixelModal
        open={!!deleteConfirm}
        title="메시지 삭제"
        onClose={() => setDeleteConfirm(null)}
        size="sm"
      >
        <p className="font-korean text-sm text-cream text-center mb-1">메시지를 삭제할까요?</p>
        <p className="font-korean text-xs text-panel-sub text-center mb-5">삭제된 메시지는 복구할 수 없어요</p>
        <div className="flex gap-3">
          <PixelButton variant="ghost" className="flex-1" onClick={() => setDeleteConfirm(null)}>
            취소
          </PixelButton>
          <PixelButton variant="danger" className="flex-1" onClick={handleDeleteConfirm}>
            삭제
          </PixelButton>
        </div>
      </PixelModal>
    </div>
  )
}
