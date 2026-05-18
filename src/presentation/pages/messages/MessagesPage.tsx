// Design Ref: §5.3 SCR-15,16 MessagesPage — 그룹채팅 + 1:1
import { useState, useRef, useEffect } from 'react'
import { useMessages } from '@/presentation/hooks/useMessages'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMessageStore } from '@/infrastructure/stores/messageStore'
import { sendMessage } from '@/infrastructure/firebase/collections/messages'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import { CharacterSprite } from '@/presentation/components/character/CharacterSprite'
import type { Message } from '@/domain/entities/Message'

type MessageTab = 'group' | 'direct'

// 이모지 카테고리 (한글 탭, 8×4=32개)
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

// localStorage 캐시에서 멤버 정보 (이름 + 역할 + 캐릭터)
function getMemberInfo(id: string): { name: string; role: string; characterId: string; petId: string } {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return { name: '', role: '', characterId: 'warrior', petId: 'dog' }
    const { members } = JSON.parse(raw)
    const m = (members as any[]).find(m => m.id === id)
    return m ? {
      name:        m.name || m.realName || '',
      role:        m.role || '',
      characterId: m.character?.characterId || 'warrior',
      petId:       m.character?.petId || 'dog',
    } : { name: '', role: '', characterId: 'warrior', petId: 'dog' }
  } catch { return { name: '', role: '', characterId: 'warrior', petId: 'dog' } }
}

function getMemberName(id: string): string {
  return getMemberInfo(id).name
}

// 아이별 구분 색상 팔레트 (ID 해시로 일관된 색상 배정)
const CHILD_COLORS = [
  'bg-approved text-white',      // 초록 — 첫 번째 아이
  'bg-gold text-pixel-dark',     // 금색 — 두 번째 아이
]
function childColorCls(memberId: string): string {
  let hash = 0
  for (let i = 0; i < memberId.length; i++) hash = (hash + memberId.charCodeAt(i)) % CHILD_COLORS.length
  return CHILD_COLORS[hash]
}

// 역할별 이름 태그 색상
function senderTagCls(role: string, memberId: string): string {
  if (role === 'DAD')   return 'bg-sky text-white'
  if (role === 'MOM')   return 'bg-pink text-pixel-dark'
  if (role === 'CHILD') return childColorCls(memberId)
  return 'bg-stone text-white'
}

function getOtherMemberIds(myId: string): string[] {
  try {
    const raw = localStorage.getItem('fq_member_cache')
    if (!raw) return []
    const { members } = JSON.parse(raw)
    return (members as any[]).filter(m => m.id !== myId).map(m => m.id)
  } catch { return [] }
}

// 날짜 문자열 (yyyy-mm-dd)
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${m}월 ${d}일`
}

// 메시지 버블 — 캐릭터 이미지 + 닉네임 + (나) 표시
function MessageBubble({ message, isMine, showName }: { message: Message; isMine: boolean; showName: boolean }) {
  const { name: senderName, role, characterId } = getMemberInfo(message.senderId)
  const timeStr = new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const tagCls  = senderTagCls(role, message.senderId)

  return (
    <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} mb-3`}>

      {/* 캐릭터 아바타 (내 메시지는 숨김) */}
      {!isMine && showName && (
        <div className="flex-shrink-0 self-end mb-4">
          <CharacterSprite characterId={characterId} role={role as any} size="sm" variant="job" />
        </div>
      )}
      {!isMine && !showName && <div className="w-8 flex-shrink-0" />}

      <div className={`max-w-[72%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {/* 닉네임 태그 */}
        {showName && senderName && (
          <span className={`font-korean text-xs font-bold px-2 py-0.5 mb-1 border-2 border-pixel-dark ${tagCls}`}>
            {senderName}{isMine ? ' (나)' : ''}
          </span>
        )}
        {isMine && !showName && (
          <span className="font-korean text-[10px] text-stone/60 mb-0.5 px-1">(나)</span>
        )}
        <div className={`px-3 py-2 border-4 font-korean text-sm leading-snug
          ${isMine
            ? 'bg-purple text-white border-purple/80'
            : 'bg-cream text-pixel-dark border-pixel-dark'}`}>
          {message.content}
        </div>
        <span className="font-korean text-[10px] text-stone/80 mt-0.5 px-1">
          {timeStr}{isMine && (message.readBy.length > 1 ? ' ✓✓' : ' ✓')}
        </span>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const { groupMessages } = useMessages()
  const { familyId, currentMember } = useAuthStore()
  const { markGroupRead } = useMessageStore()
  const [activeTab, setActiveTab] = useState<MessageTab>('group')
  const [text, setText] = useState('')
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [emojiCat, setEmojiCat] = useState<EmojiCat>('감정')
  const [sending, setSending] = useState(false)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isObserver = currentMember?.role === 'OBSERVER'

  const scrollToBottom = (smooth = false) => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = smooth ? el.scrollHeight : el.scrollHeight
  }

  useEffect(() => {
    if (activeTab === 'group' && currentMember) markGroupRead(currentMember.id)
    if (activeTab === 'group') scrollToBottom()
  }, [activeTab, currentMember?.id])

  useEffect(() => {
    scrollToBottom()
  }, [groupMessages])

  const handleSend = async () => {
    if (!text.trim() || !familyId || !currentMember || isObserver) return
    const trimmed = text.trim()
    setSending(true)
    setShowEmojiPanel(false)
    await sendMessage(familyId, currentMember.id, trimmed, null)
    setText('')
    setSending(false)
  }

  // 날짜 구분선 포함 메시지 렌더링
  const renderMessages = () => {
    const items: JSX.Element[] = []
    let lastDate = ''
    let lastSenderId = ''
    groupMessages.forEach((msg, idx) => {
      const dateKey = toDateKey(new Date(msg.createdAt))
      if (dateKey !== lastDate) {
        items.push(
          <div key={`date-${dateKey}`} className="chat-date-divider my-3">
            <span>{formatDateLabel(dateKey)}까지 메시지입니다</span>
          </div>
        )
        lastDate = dateKey
        lastSenderId = ''
      }
      const isMine = msg.senderId === currentMember?.id
      const showName = !isMine && msg.senderId !== lastSenderId
      items.push(
        <MessageBubble key={msg.id} message={msg} isMine={isMine} showName={showName} />
      )
      lastSenderId = msg.senderId
    })
    return items
  }

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* 서브탭 — 2개 (응원함 제거) */}
      <div className="flex border-b-4 border-dirt flex-shrink-0">
        {([
          { key: 'group',  label: '💌 그룹채팅' },
          { key: 'direct', label: '👤 1:1 채팅' },
        ] as const).map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 font-korean text-sm font-bold border-r-2 border-dirt last:border-r-0
              ${activeTab === tab.key ? 'bg-purple text-white' : 'bg-cream text-pixel-dark hover:bg-purple/10'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 그룹 채팅 */}
      {activeTab === 'group' && (
        <>
          <div ref={containerRef} className="flex-1 overflow-y-auto px-3 pt-2 pb-1">
            {groupMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="font-korean text-xs text-stone">아직 대화가 없어요 💌</p>
                <p className="font-korean text-xs text-stone mt-1">첫 메시지를 보내봐요!</p>
              </div>
            ) : renderMessages()}
            <div ref={bottomRef} />
          </div>

          {!isObserver ? (
            <div className="flex-shrink-0 border-t-4 border-dirt bg-cream">
              {/* 이모지 패널 */}
              {showEmojiPanel && (
                <div className="border-b-2 border-dirt bg-cream">
                  {/* 한글 카테고리 탭 */}
                  <div className="flex border-b-2 border-dirt">
                    {(Object.keys(EMOJI_CATS) as EmojiCat[]).map(cat => (
                      <button key={cat} type="button" onClick={() => setEmojiCat(cat)}
                        className={[
                          'flex-1 py-2 font-korean text-sm font-bold border-r-2 border-dirt last:border-r-0 transition-colors',
                          emojiCat === cat
                            ? 'bg-purple text-white'
                            : 'bg-cream text-pixel-dark hover:bg-purple/10',
                        ].join(' ')}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  {/* 이모지 그리드 — 8열 × 4행 꽉 채우기 */}
                  <div className="grid grid-cols-8">
                    {EMOJI_CATS[emojiCat].map(e => (
                      <button key={e} type="button"
                        onClick={() => setText(prev => prev + e)}
                        className="aspect-square flex items-center justify-center text-2xl
                                   hover:bg-gold/20 active:bg-gold/40 transition-colors">
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* 입력창 */}
              <div className="flex gap-2 p-2">
                <button type="button" onClick={() => setShowEmojiPanel(p => !p)}
                  className={`w-10 h-10 border-4 flex items-center justify-center text-xl flex-shrink-0
                    ${showEmojiPanel ? 'bg-gold/20 border-gold' : 'bg-pink border-pixel-dark hover:border-gold'}`}>
                  😊
                </button>
                <input value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="메시지 입력..."
                  className="flex-1 bg-pixel-dark text-gold font-korean text-sm
                             border-4 border-pixel-dark px-3 py-2
                             focus:outline-none focus:border-gold" />
                <button type="button" onClick={handleSend}
                  disabled={sending || !text.trim()}
                  className="px-4 py-2 bg-purple border-4 border-pixel-dark font-korean text-sm
                             text-white font-bold hover:border-gold active:translate-y-0.5
                             transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                  전송
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 p-3 border-t-4 border-dirt text-center">
              <p className="font-korean text-xs text-stone">읽기 전용 (옵저버)</p>
            </div>
          )}
        </>
      )}

      {/* 1:1 채팅 */}
      {activeTab === 'direct' && (
        <div className="flex-1 flex items-center justify-center">
          <PixelCard padding="sm" className="text-center mx-4">
            <p className="text-3xl mb-2">💌</p>
            <p className="font-korean text-sm text-pixel-dark font-bold">1:1 채팅</p>
            <p className="font-korean text-xs text-stone mt-1">
              Phase 3에서 구현 예정이에요
            </p>
          </PixelCard>
        </div>
      )}
    </div>
  )
}
