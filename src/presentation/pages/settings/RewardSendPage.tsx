// 아이들 보상주기 — 엄마/아빠 공통 (v3.0 MC Dark)
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeMembers } from '@/infrastructure/firebase/collections/members'
import { sendManualReward } from '@/infrastructure/firebase/collections/rewards'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import type { Member } from '@/domain/entities/Member'

const INPUT_CLS  = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'
const SELECT_CLS = 'w-full input-pixel font-korean text-sm text-gold min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold bg-panel-darkest'

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
    if (error) { setMsg('error:발송 실패: ' + error); return }
    setMsg('ok:보상을 발송했어요!')
    setRewardAmount('')
    setRewardLabel('')
    setTimeout(() => setMsg(''), 3000)
  }

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  if (!isParent) return null

  const [msgType, msgText] = msg.includes(':') ? msg.split(':') as [string, string] : ['', msg]

  return (
    <div className="p-3 pb-4">
      <h1 className="t-heading text-gold t-pixel-shadow mb-3">🎁 아이들 보상주기</h1>

      <div className="card-pixel p-4 space-y-3">
        <p className="t-micro text-panel-sub">
          퀘스트와 무관하게 직접 보상을 발송해요. 아이 보상 탭에 이력이 쌓여요.
        </p>

        <select
          value={rewardMemberId}
          onChange={e => setRewardMemberId(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">아이 선택</option>
          {childMembers.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.realName})</option>
          ))}
        </select>

        <select
          value={rewardType}
          onChange={e => setRewardType(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="MONEY">💰 용돈</option>
          <option value="GAME_TIME">🎮 게임시간</option>
          <option value="PHONE_TIME">📱 핸드폰시간</option>
          <option value="GIFT">🎁 선물</option>
          <option value="DINING">🍕 외식</option>
          <option value="CUSTOM">⭐ 기타</option>
        </select>

        <input
          value={rewardAmount}
          onChange={e => setRewardAmount(e.target.value.replace(/\D/, ''))}
          placeholder={rewardType === 'MONEY' ? '금액 (원)' : rewardType.includes('TIME') ? '시간 (분)' : '수량 (개)'}
          className={INPUT_CLS}
        />

        {['GIFT', 'DINING', 'CUSTOM'].includes(rewardType) && (
          <input
            value={rewardLabel}
            onChange={e => setRewardLabel(e.target.value)}
            placeholder="내용 (예: 나이키 운동화)"
            maxLength={30}
            className={INPUT_CLS}
          />
        )}

        {msg && (
          <p className={`t-sub font-bold text-center ${msgType === 'ok' ? 'text-approved' : 'text-rejected'}`}>
            {msgType === 'ok' ? '✅ ' : '❌ '}{msgText}
          </p>
        )}

        <PixelButton
          variant="gold"
          size="lg"
          fullWidth
          disabled={sending || !rewardMemberId || !rewardAmount}
          onClick={handleSend}
        >
          {sending ? '발송 중...' : '🎁 보상 발송하기'}
        </PixelButton>
      </div>
    </div>
  )
}
