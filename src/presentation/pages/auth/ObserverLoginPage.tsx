// Design Ref: §5.3 SCR-03b ObserverLoginPage — 게스트 접속 (가족ID 없이 신청)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  requestObserverAccess, checkObserverStatus,
  OBSERVER_TYPE_LABELS, type ObserverType, type ObserverStatus,
} from '@/application/use-cases/auth/observerLogin'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'

type Tab = 'apply' | 'check'

interface ApplyForm  { name: string; phoneLast4: string; type: ObserverType }
interface CheckForm  { phoneLast4: string }

const STATUS_INFO: Record<ObserverStatus, { emoji: string; title: string; desc: string; color: string }> = {
  pending:   { emoji: '⏳', title: '승인 대기 중',   desc: '아빠가 확인하면 접속할 수 있어요!',       color: 'text-hold' },
  approved:  { emoji: '✅', title: '접속 승인됨!',   desc: '24시간 접속이 활성화됐어요. 아래 버튼으로 입장하세요.', color: 'text-approved' },
  expired:   { emoji: '⌛', title: '접속 시간 만료', desc: '24시간이 지났어요. 다시 신청해주세요.',    color: 'text-cream/70' },
  rejected:  { emoji: '❌', title: '승인 거절됨',    desc: '아빠가 접속을 거절했어요.',              color: 'text-rejected' },
  'not-found': { emoji: '🔍', title: '신청 기록 없음', desc: '전화번호 뒤 4자리를 다시 확인해주세요.', color: 'text-cream/70' },
}

export default function ObserverLoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('apply')
  const [loading, setLoading] = useState(false)
  const [applyDone, setApplyDone] = useState(false)
  const [checkStatus, setCheckStatus] = useState<ObserverStatus | null>(null)
  const [error, setError] = useState('')

  const applyForm = useForm<ApplyForm>({ defaultValues: { type: 'GRANDMA' } })
  const checkForm = useForm<CheckForm>()

  // ── 신청 제출 ──────────────────────────────────────────────
  const onApply = async (data: ApplyForm) => {
    if (!data.name.trim()) { setError('이름을 입력해주세요'); return }
    if (data.phoneLast4.length !== 4) { setError('전화번호 뒤 4자리를 입력해주세요'); return }

    setLoading(true); setError('')
    const { success, error: reqError } = await requestObserverAccess(data)
    setLoading(false)

    if (!success && reqError) { setError(reqError); return }
    setApplyDone(true)
  }

  // ── 상태 확인 ──────────────────────────────────────────────
  const onCheck = async (data: CheckForm) => {
    if (data.phoneLast4.length !== 4) { setError('전화번호 뒤 4자리를 입력해주세요'); return }
    setLoading(true); setError('')
    const { status } = await checkObserverStatus(data.phoneLast4)
    setLoading(false)
    setCheckStatus(status)
  }

  const tabCls = (t: Tab) =>
    `flex-1 py-2.5 font-korean text-sm font-bold transition-colors
     ${tab === t ? 'bg-purple text-white' : 'bg-cream text-cream/70 hover:bg-purple/10'}`

  return (
    <div className="min-h-screen bg-minecraft flex flex-col">
      {/* 헤더 */}
      <div className="p-4 pt-6 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/login')}
          className="font-korean text-cream text-sm hover:text-gold transition-colors">
          ← 뒤로
        </button>
        <h1 className="font-korean text-base font-bold text-gold">게스트 접속</h1>
      </div>

      <div className="flex-1 px-4 pb-8">
        {/* 탭 */}
        <div className="flex border-4 border-pixel-dark mb-4">
          <button type="button" className={tabCls('apply')} onClick={() => { setTab('apply'); setError('') }}>
            접속 신청
          </button>
          <button type="button" className={tabCls('check')} onClick={() => { setTab('check'); setError('') }}>
            상태 확인
          </button>
        </div>

        {/* ── 신청 탭 ── */}
        {tab === 'apply' && (
          applyDone ? (
            /* 신청 완료 화면 */
            <PixelCard className="text-center space-y-4">
              <div className="text-5xl">👀</div>
              <p className="font-korean text-base font-bold text-pixel-dark">접속 신청 완료!</p>
              <p className="font-korean text-sm text-cream/70">
                아빠가 승인하면 접속할 수 있어요.<br/>
                "상태 확인" 탭에서 전화번호 뒤 4자리를 입력하면<br/>승인 여부를 확인할 수 있어요.
              </p>
              <PixelButton variant="primary" fullWidth onClick={() => setTab('check')}>
                상태 확인하기 →
              </PixelButton>
            </PixelCard>
          ) : (
            <PixelCard className="space-y-4">
              <p className="font-korean text-sm text-cream/70">
                앱 계정 없이 아이들 활동을 구경할 수 있어요 👴👵<br/>
                신청 후 아빠 승인 시 24시간 접속 가능해요.
              </p>

              <div>
                <label className="font-korean text-xs font-bold text-pixel-dark block mb-1">이름 (닉네임)</label>
                <input
                  {...applyForm.register('name', { required: true })}
                  placeholder="예: 할머니, 할아버지"
                  className="w-full bg-pixel-dark text-gold font-korean text-sm
                             border-4 border-pixel-dark px-3 py-2.5
                             focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="font-korean text-xs font-bold text-pixel-dark block mb-1">
                  핸드폰 뒤 4자리 <span className="text-cream/70 font-normal">(상태 확인에 사용)</span>
                </label>
                <input
                  {...applyForm.register('phoneLast4', { required: true, maxLength: 4 })}
                  type="tel" placeholder="1234" maxLength={4}
                  className="w-full bg-pixel-dark text-gold font-korean text-sm
                             border-4 border-pixel-dark px-3 py-2.5
                             focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="font-korean text-xs font-bold text-pixel-dark block mb-1">유형 선택</label>
                <select
                  {...applyForm.register('type')}
                  className="w-full bg-pixel-dark text-gold font-korean text-sm
                             border-4 border-pixel-dark px-3 py-2.5
                             focus:outline-none focus:border-gold"
                >
                  {(Object.entries(OBSERVER_TYPE_LABELS) as [ObserverType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {error && <p className="font-korean text-xs text-rejected">{error}</p>}

              <PixelButton
                type="button" variant="gold" fullWidth size="lg" disabled={loading}
                onClick={applyForm.handleSubmit(onApply)}
              >
                {loading ? '신청 중...' : '접속 신청하기'}
              </PixelButton>
            </PixelCard>
          )
        )}

        {/* ── 상태 확인 탭 ── */}
        {tab === 'check' && (
          <div className="space-y-4">
            <PixelCard className="space-y-4">
              <p className="font-korean text-sm font-bold text-pixel-dark">승인 상태 확인</p>
              <div>
                <label className="font-korean text-xs font-bold text-pixel-dark block mb-1">
                  핸드폰 뒤 4자리
                </label>
                <input
                  {...checkForm.register('phoneLast4', { required: true, maxLength: 4 })}
                  type="tel" placeholder="신청 시 입력한 번호" maxLength={4}
                  className="w-full bg-pixel-dark text-gold font-korean text-sm
                             border-4 border-pixel-dark px-3 py-2.5
                             focus:outline-none focus:border-gold"
                />
              </div>
              {error && <p className="font-korean text-xs text-rejected">{error}</p>}
              <PixelButton
                type="button" variant="primary" fullWidth disabled={loading}
                onClick={checkForm.handleSubmit(onCheck)}
              >
                {loading ? '확인 중...' : '상태 확인'}
              </PixelButton>
            </PixelCard>

            {/* 상태 결과 */}
            {checkStatus && (() => {
              const info = STATUS_INFO[checkStatus]
              return (
                <PixelCard className="text-center space-y-3">
                  <div className="text-4xl">{info.emoji}</div>
                  <p className={`font-korean text-base font-bold ${info.color}`}>{info.title}</p>
                  <p className="font-korean text-sm text-cream/70">{info.desc}</p>
                  {checkStatus === 'approved' && (
                    <PixelButton variant="gold" fullWidth onClick={() => navigate('/home')}>
                      지금 입장하기 →
                    </PixelButton>
                  )}
                  {(checkStatus === 'expired' || checkStatus === 'rejected') && (
                    <PixelButton variant="ghost" fullWidth onClick={() => setTab('apply')}>
                      다시 신청하기
                    </PixelButton>
                  )}
                </PixelCard>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
