// Design Ref: §5.3 SCR-15,16 MessagesPage — 그룹채팅 + 1:1 DM
import { useState, useRef, useEffect, useMemo } from 'react'
import { useMessages } from '@/presentation/hooks/useMessages'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMessageStore } from '@/infrastructure/stores/messageStore'
import {
  sendMessage, sendDirectMessage,
  subscribeDirectChat, subscribeReceivedDMs,
  markMessageRead, markGroupMessagesRead, deleteMessage,
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

// 역할별 말풍선 테두리 색상 — 부모: 역할 테마 컬러, 아이: 개인별 고유 컬러
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

// ── MessageBubble ──────────────────────────────────────────────────

function MessageBubble({
  message, isMine, showName, unreadCount,
  isSelected, onSelect, onDelete,
}: {
  message: Message
  isMine: boolean
  showName: boolean
  unreadCount: number
  isSelected: boolean
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const { name, role, characterId } = getMemberInfo(message.senderId)
  const timeStr = new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const tagCls  = senderTagCls(role, message.senderId)

  return (
    <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
      {!isMine && showName && (
        <div className="flex-shrink-0 self-end mb-4">
          <CharacterSprite characterId={characterId} role={role as any} size="sm" variant="job" />
        </div>
      )}
      {!isMine && !showName && <div className="w-8 flex-shrink-0" />}

      <div className={`max-w-[72%] min-w-0 flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {showName && name && (
          <span className={`font-korean text-xs font-bold px-2 py-0.5 mb-1 border-2 border-black t-pixel-shadow ${tagCls}`}>
            {name}{isMine ? ' (나)' : ''}
          </span>
        )}
        {isMine && !showName && (
          <span className="font-korean text-xs text-cream/50 mb-0.5 px-1">(나)</span>
        )}

        {/* 말풍선 — speech-bubble 베이스, 역할별 테두리 오버라이드 */}
        <div
          className={[
            'speech-bubble break-words min-w-0 cursor-pointer',
            isMine
              ? 'bg-purple text-white border-purple/80 shadow-[inset_2px_2px_0px_#ffffff20]'
              : `${getBubbleBorderCls(role, message.senderId)} shadow-[inset_2px_2px_0px_#ffffff15,inset_-2px_-2px_0px_#00000060]`,
            isSelected && isMine ? 'border-rejected' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => isMine && onSelect(isSelected ? null : message.id)}
        >
          {message.content}
        </div>

        {/* 시간 + 읽음 수 + 삭제 버튼 */}
        <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          {isMine && unreadCount > 0 && (
            <span className="font-pixel text-xs text-gold leading-none">{unreadCount}</span>
          )}
          <span className="font-korean text-xs text-cream/60">{timeStr}</span>
          {isMine && isSelected && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(message.id) }}
              className="font-korean text-xs text-rejected font-bold px-1.5 py-0.5 bg-panel-darkest border border-rejected hover:bg-rejected hover:text-white transition-colors"
            >
              삭제
            </button>
          )}
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
              ${emojiCat === cat ? 'bg-purple text-white' : 'bg-panel-dark text-cream hover:bg-purple/20'}`}>
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
            ${showEmojiPanel ? 'bg-gold/20 border-gold' : 'bg-panel-dark border-black hover:border-gold'}`}>
          😊
        </button>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="메시지 입력..."
          className="flex-1 min-w-0 bg-panel-darkest text-gold font-korean text-sm
                     border-4 border-black px-3 py-2
                     focus:outline-none focus:border-gold
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
  totalActiveMembers: number,
  isDM: boolean,
  partnerId: string | null,
  selectedMsgId: string | null,
  onSelectMsg: (id: string | null) => void,
  onDeleteMsg: (id: string) => void
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
        isSelected={selectedMsgId === msg.id}
        onSelect={onSelectMsg}
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

  const [selectedMsgId,   setSelectedMsgId]   = useState<string | null>(null)
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

  // ── 멤버 목록 (DM 파트너 선택용) ─────────────────────────────
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
  const [partnerId,    setPartnerId]    = useState<string | null>(null)
  const [directMsgs,   setDirectMsgs]  = useState<Message[]>([])
  const directRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!familyId || !myId || !partnerId) { setDirectMsgs([]); return }
    return subscribeDirectChat(familyId, myId, partnerId, setDirectMsgs)
  }, [familyId, myId, partnerId])

  // DM 읽음 처리 (파트너 메시지 자동 마킹)
  useEffect(() => {
    if (!familyId || !myId || !partnerId) return
    directMsgs
      .filter(m => m.senderId === partnerId && !m.readBy.includes(myId))
      .forEach(m => markMessageRead(familyId, m.id, myId, m.readBy))
  }, [directMsgs, familyId, myId, partnerId])

  // DM 스크롤 하단 유지 (규칙 8: scrollIntoView 금지, scrollTop = scrollHeight 사용)
  useEffect(() => {
    if (directRef.current) directRef.current.scrollTop = directRef.current.scrollHeight
  }, [directMsgs])

  const partner = members.find(m => m.id === partnerId)

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
    setSelectedMsgId(null)
    if (tab !== 'direct') setPartnerId(null)
  }

  const handleDeleteRequest = (id: string) => {
    setDeleteConfirm(id)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !familyId) return
    await deleteMessage(familyId, deleteConfirm)
    setDeleteConfirm(null)
    setSelectedMsgId(null)
  }

  const handleAreaClick = () => setSelectedMsgId(null)

  // ════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-112px)] overflow-hidden" onClick={handleAreaClick}>

      {/* ── 탭 바 ──────────────────────────────────────────── */}
      <div className="flex border-b-4 border-black flex-shrink-0 bg-panel-darkest">
        <button type="button" onClick={() => handleTabChange('group')}
          className={`flex-1 py-3 font-korean text-sm font-bold border-r-2 border-black
            ${activeTab === 'group' ? 'bg-purple text-white' : 'bg-panel-darkest text-cream hover:bg-purple/10'}`}>
          💌 그룹채팅
        </button>
        <button type="button" onClick={() => handleTabChange('direct')}
          className={`relative flex-1 py-3 font-korean text-sm font-bold
            ${activeTab === 'direct' ? 'bg-purple text-white' : 'bg-panel-darkest text-cream hover:bg-purple/10'}`}>
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

      {/* ── 그룹 채팅 ──────────────────────────────────────── */}
      {activeTab === 'group' && (
        <>
          <div ref={groupRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-2 pb-1">
            {groupMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-korean text-sm text-cream font-bold">아직 대화가 없어요 💌</p>
                <p className="font-korean text-xs text-cream/60 mt-1">첫 메시지를 보내봐요!</p>
              </div>
            ) : renderMessageList(
              groupMessages, myId, activeMembers.length, false, null,
              selectedMsgId, setSelectedMsgId, handleDeleteRequest
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

      {/* ── 1:1 채팅 — 파트너 미선택 (멤버 목록) ────────────── */}
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
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-3 py-2 bg-panel-darkest border-b-4 border-black flex-shrink-0">
            <button type="button"
              onClick={() => { setPartnerId(null); setShowEmojiPanel(false); setSelectedMsgId(null) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-panel-dark border-4 border-panel-border
                         font-korean text-sm font-bold text-cream
                         hover:border-gold active:scale-95 transition-all flex-shrink-0">
              ← 뒤로
            </button>

            {partner && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <CharacterSprite
                  characterId={partner.character.characterId}
                  role={partner.role}
                  size="sm"
                  variant="job"
                />
                <div className="min-w-0">
                  <p className="font-korean text-sm font-bold text-cream truncate">{partner.name}</p>
                  <span className={`font-korean text-xs font-bold px-1.5 py-0 border border-black
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
              directMsgs, myId, 2, true, partnerId,
              selectedMsgId, setSelectedMsgId, handleDeleteRequest
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
