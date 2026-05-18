// 아이들 보상주기 — 엄마/아빠 공통
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { sendManualReward } from '@/infrastructure/firebase/collections/rewards'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'
import type { Member } from '@/domain/entities/Member'

export default function RewardSendPage() {
  const { currentMember, familyId } = useAuthStore()
  const [members, setMembers] = useState<Member[]>([])

  const [rewardMemberId, setRewardMemberId] = useState('')
  const [rewardType,     setRewardType]     = useState('MONEY')
  const [rewardAmount,   setRewardAmount]   = useState('')
  const [rewardLabel,    setRewardLabel]    = useState('')
  const [sending,        setSending]        = useState(false)
  const [msg,            setMsg]            = useState('')

  useEffect(() => {
    if (!familyId) return
    return subscribeMembers(familyId, setMembers)
  }, [familyId])

  const childMembers = members.filter(m => m.role === 'CHILD')

  const handleSend = async () => {
    if (!familyId || !rewardMemberId || !rewardAmount) return
    setSending(true)
    setMsg('')
    const { error } = await sendManualReward(
      familyId,
      rewardMemberId,
      currentMember?.id ?? '',
      rewardType,
      Number(rewardAmount),
      rewardLabel || undefined,
    )
    setSending(false)
    if (error) { setMsg('❌ 발송 실패: ' + error); return }
    setMsg('✅ 보상을 발송했어요!')
    setRewardAmount('')
    setRewardLabel('')
    setTimeout(() => setMsg(''), 3000)
  }

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  if (!isParent) return null

  return (
    <div className="p-3 pb-4">
      <h1 className="font-korean text-base font-bold text-gold mb-3">🎁 아이들 보상주기</h1>
      <PixelCard padding="sm">
        <p className="font-korean text-xs text-stone mb-4">
          퀘스트와 무관하게 직접 보상을 발송해요. 아이 보상 탭에 이력이 쌓여요.
        </p>
        <div className="space-y-2">
          <select value={rewardMemberId} onChange={e => setRewardMemberId(e.target.value)}
            className="w-full bg-pixel-dark text-gold font-korean text-sm
                       border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold">
            <option value="">아이 선택</option>
            {childMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.realName})</option>
            ))}
          </select>

          <select value={rewardType} onChange={e => setRewardType(e.target.value)}
            className="w-full bg-pixel-dark text-gold font-korean text-sm
                       border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold">
            <option value="MONEY">💰 용돈</option>
            <option value="GAME_TIME">🎮 게임시간</option>
            <option value="PHONE_TIME">📱 핸드폰시간</option>
            <option value="GIFT">🎁 선물</option>
            <option value="DINING">🍕 외식</option>
            <option value="CUSTOM">⭐ 기타</option>
          </select>

          <input value={rewardAmount} onChange={e => setRewardAmount(e.target.value.replace(/\D/, ''))}
            placeholder={rewardType === 'MONEY' ? '금액 (원)' : rewardType.includes('TIME') ? '시간 (분)' : '수량 (개)'}
            className="w-full bg-pixel-dark text-gold font-korean text-sm
                       border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold" />

          {['GIFT', 'DINING', 'CUSTOM'].includes(rewardType) && (
            <input value={rewardLabel} onChange={e => setRewardLabel(e.target.value)}
              placeholder="내용 (예: 나이키 운동화)" maxLength={30}
              className="w-full bg-pixel-dark text-gold font-korean text-sm
                         border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold" />
          )}

          {msg && (
            <p className={`font-korean text-xs font-bold text-center ${msg.startsWith('✅') ? 'text-approved' : 'text-rejected'}`}>
              {msg}
            </p>
          )}

          <button type="button" onClick={handleSend}
            disabled={sending || !rewardMemberId || !rewardAmount}
            className="w-full py-3 bg-gold border-4 border-yellow-600 font-korean text-sm font-bold
                       text-pixel-dark hover:bg-yellow-400 active:translate-y-0.5 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? '발송 중...' : '🎁 보상 발송하기'}
          </button>
        </div>
      </PixelCard>
    </div>
  )
}
