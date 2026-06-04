// Design Ref: §5.3 SCR-03 RegisterPage — 4단계 회원가입 (MC Dark)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { signUp, DEFAULT_FAMILY_CODE } from '@/application/use-cases/auth/signUp'
import { login } from '@/application/use-cases/auth/login'
import { startAnonymousSession } from '@/infrastructure/firebase/auth'
import { REGISTER_CHARACTERS } from '@/application/use-cases/characters/selectCharacter'
import { UI_ROLE_LABELS, UI_ROLE_TO_ROLE, UI_ROLE_TO_REAL_NAME, type UIRole } from '@/domain/entities/Member'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { getFamilySettings, getMembersByFamily } from '@/infrastructure/firebase/collections/members'
import { hashFamilyCode } from '@/infrastructure/firebase/auth'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'

type Step = 1 | 2 | 3 | 4

const SELECTABLE_ROLES: UIRole[] = ['DAD', 'MOM', 'HAYOON', 'SEOYOON']

const ROLE_ICONS: Record<UIRole, string> = {
  DAD: '🧙‍♂️', MOM: '🧚‍♀️', HAYOON: '👼', SEOYOON: '🤡', OBSERVER: '👀',
}

const ROLE_DESCRIPTIONS: Record<UIRole, string> = {
  DAD: '최고 관리자', MOM: '부모 관리자', HAYOON: '첫째 딸', SEOYOON: '둘째 딸', OBSERVER: '',
}

const INPUT_CLS = 'w-full input-pixel font-korean text-base text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'
const INPUT_ERR_CLS = INPUT_CLS + ' !border-rejected'

interface FormData {
  nickname: string
  uiRole: UIRole
  familyCode: string
  birthYear: string
  birthMonth: string
  birthDay: string
  calendarType: '양력' | '음력'
  characterId: string
  pin: string
  pinConfirm: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setCurrentMember, setFamilyId: setStoreFamilyId, familyId: authFamilyId } = useAuthStore()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step2Validating, setStep2Validating] = useState(false)
  const [step2ServerError, setStep2ServerError] = useState('')
  const [registeredRealNames, setRegisteredRealNames] = useState<string[]>([])

  const [showCode,       setShowCode]       = useState(false)
  const [showPin,        setShowPin]        = useState(false)
  const [showPinConfirm, setShowPinConfirm] = useState(false)

  const { register, watch, setValue, handleSubmit } = useForm<FormData>({
    defaultValues: {
      uiRole: 'DAD', calendarType: '양력',
      familyCode: DEFAULT_FAMILY_CODE, characterId: 'dad-warrior',
    },
  })

  const watchedRole = watch('uiRole')
  const watchedChar = watch('characterId')
  const watchedCal  = watch('calendarType')

  useEffect(() => {
    if (step !== 2) return
    const fid = localStorage.getItem('familyId') || authFamilyId || ''
    if (!fid) return
    localStorage.setItem('familyId', fid)
    startAnonymousSession().then(() =>
      getMembersByFamily(fid).then(({ data }) => setRegisteredRealNames(data.map(m => m.realName)))
    )
  }, [step, authFamilyId])

  const handleRoleChange = (role: UIRole) => {
    setValue('uiRole', role)
    const chars = REGISTER_CHARACTERS[role]
    if (chars?.length) setValue('characterId', chars[0].id)
    if (role === 'DAD') setValue('familyCode', DEFAULT_FAMILY_CODE)
    setStep2ServerError('')
  }

  const w = (field: keyof FormData) => (watch(field) as string) ?? ''

  const errs = {
    nickname: (() => {
      const v = w('nickname').trim()
      if (!v) return '닉네임을 입력해주세요'
      if (v.length > 10) return '닉네임은 10자 이내로 입력해주세요'
      return ''
    })(),
    familyCode: !w('familyCode').trim() ? '가족 인증키를 입력해주세요' : '',
    pin: (() => {
      const p = w('pin')
      if (!p.trim()) return 'PIN을 입력해주세요'
      if (p.length < 2) return 'PIN은 2자리 이상이어야 해요'
      if (p.length > 8) return 'PIN은 최대 8자리예요'
      return ''
    })(),
    pinConfirm: w('pinConfirm') && w('pin') !== w('pinConfirm') ? 'PIN 번호가 일치하지 않아요' : '',
    birthYear: (() => {
      const y = parseInt(w('birthYear') || '0')
      if (!w('birthYear')) return '태어난 연도를 입력해주세요'
      if (y < 1940 || y > 2025) return '1940~2025 사이 연도를 입력해주세요'
      return ''
    })(),
    birthMonth: (() => {
      const m = parseInt(w('birthMonth') || '0')
      if (!w('birthMonth')) return '태어난 월을 입력해주세요'
      if (m < 1 || m > 12) return '1~12월 사이로 입력해주세요'
      return ''
    })(),
    birthDay: (() => {
      const d = parseInt(w('birthDay') || '0')
      if (!w('birthDay')) return '태어난 일을 입력해주세요'
      if (d < 1 || d > 31) return '1~31일 사이로 입력해주세요'
      return ''
    })(),
  }

  const canProceed1 = !errs.nickname
  const canProceed2 = !errs.familyCode && !errs.pin && !errs.pinConfirm
                      && w('pin') === w('pinConfirm') && w('pin').length >= 2
  const canProceed3 = !errs.birthYear && !errs.birthMonth && !errs.birthDay

  const handleStep2Next = async () => {
    if (!canProceed2) return
    setStep2ServerError('')

    if (watchedRole === 'DAD') { setStep(3); return }

    const storedFamilyId = localStorage.getItem('familyId') || authFamilyId || ''
    if (storedFamilyId) {
      localStorage.setItem('familyId', storedFamilyId)
    } else {
      setStep2ServerError('아빠가 먼저 가입해야 해요. 아빠로 가입 후 다시 시도해주세요.')
      return
    }

    setStep2Validating(true)
    try {
      const { uid } = await startAnonymousSession()
      if (!uid) { setStep2ServerError('서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.'); return }

      const code = w('familyCode').trim()
      const realName = UI_ROLE_TO_REAL_NAME[watchedRole]
      const { data: settings } = await getFamilySettings(storedFamilyId)
      if (!settings) { setStep2ServerError('가족 정보를 찾을 수 없어요. 아빠에게 문의해주세요.'); return }
      const codeHash = await hashFamilyCode(code)
      if (settings.familyCodeHash !== codeHash) { setStep2ServerError('가족 인증키가 맞지 않아요.'); return }
      const { data: members } = await getMembersByFamily(storedFamilyId)
      if (members.length >= 4) { setStep2ServerError('이미 모든 가족 구성원이 등록되었습니다.'); return }
      if (members.some(m => m.realName === realName)) {
        setStep2ServerError(`${realName} 역할은 이미 가입되어 있어요.`)
        return
      }
      setStep(3)
    } finally {
      setStep2Validating(false)
    }
  }

  const progressPct = (step / 4) * 100
  const [successDone, setSuccessDone] = useState(false)

  const onSubmit = async (data: FormData) => {
    if (!data.pin || data.pin !== data.pinConfirm) { setError('PIN 번호를 다시 확인해주세요'); return }
    setLoading(true)
    setError('')
    const role = UI_ROLE_TO_ROLE[data.uiRole]
    const realName = UI_ROLE_TO_REAL_NAME[data.uiRole]
    try {
      const result = await signUp({
        name: data.nickname.trim(), realName,
        familyCode: data.familyCode.trim(), familyId: undefined,
        birthYear: parseInt(data.birthYear), birthMonth: parseInt(data.birthMonth),
        birthDay: parseInt(data.birthDay), calendarType: data.calendarType,
        role, uiRole: data.uiRole, pin: data.pin, characterId: data.characterId,
      })

      if (result.error === 'ALREADY_REGISTERED' && result.familyId && result.memberId) {
        const { success: loginOk, member } = await login(result.familyId, result.memberId, data.pin)
        if (loginOk && member) { setCurrentMember(member); setStoreFamilyId(result.familyId); navigate('/home') }
        else setError('이미 가입된 계정이에요. PIN 번호를 다시 확인해주세요.')
        return
      }

      if (!result.success || !result.familyId || !result.memberId) {
        setError(result.error ?? '가입 중 오류가 발생했어요')
        return
      }

      const { success: loginOk, member } = await login(result.familyId, result.memberId, data.pin)
      if (loginOk && member) { setCurrentMember(member); setStoreFamilyId(result.familyId) }

      if (data.uiRole === 'DAD') setSuccessDone(true)
      else navigate('/home')

    } catch (e: any) {
      const code: string = e?.code ?? ''
      const msg: string  = e?.message ?? ''
      if (code === 'deadline-exceeded' || msg.includes('timeout')) {
        setError('연결 시간이 초과됐어요. 인터넷 연결을 확인하고 다시 시도해주세요.')
      } else if (code === 'permission-denied') {
        setError('접근 권한 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
      } else if (code === 'unavailable') {
        setError('서버에 접속할 수 없어요. 인터넷 연결을 확인해주세요.')
      } else if (code.startsWith('auth/')) {
        setError(code === 'auth/operation-not-allowed'
          ? 'Firebase Console에서 익명 로그인을 활성화해주세요.'
          : `인증 오류 (${code})`)
      } else {
        setError(`오류가 발생했어요 (${code || msg || '알 수 없는 오류'})`)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── 아빠 가입 성공 화면 ──────────────────────────────────────────
  if (successDone) {
    return (
      <div className="min-h-screen bg-panel-darkest flex flex-col items-center justify-center px-4">
        <div className="card-pixel p-6 w-full max-w-sm text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="font-korean text-lg font-bold text-cream">축하합니다. 가입이 완료되었어요</h2>
          <p className="font-korean text-sm text-panel-sub leading-relaxed">
            이제 엄마·하윤·서윤도 가입할 수 있어요.<br/>
            아래 <span className="text-gold">가족 인증키</span>를 설정해주세요.
          </p>
          <PixelButton variant="gold" fullWidth size="lg" onClick={() => navigate('/settings')}>
            설정으로 이동하기
          </PixelButton>
          <PixelButton variant="ghost" fullWidth size="lg" onClick={() => navigate('/home')}>
            홈으로 입장하기
          </PixelButton>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-panel-darkest flex flex-col">
      {/* 헤더 + 진행바 */}
      <div className="p-4 pt-6">
        <div className="flex items-center justify-between mb-3">
          <PixelButton variant="ghost" size="sm"
            onClick={() => step > 1 ? setStep((step - 1) as Step) : navigate('/login')}>
            ← 뒤로
          </PixelButton>
          <span className="font-pixel text-xs text-gold">{step} / 4</span>
        </div>
        <div className="exp-bar">
          <div className="exp-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex-1 px-4 pb-8">
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* ── STEP 1: 닉네임 ── */}
          {step === 1 && (
            <div className="card-pixel p-4 mt-2 space-y-3">
              <h2 className="font-korean text-base font-bold text-cream">사용할 이름(닉네임)을 알려줘</h2>
              <p className="font-korean text-sm text-panel-sub">앱에서 보여질 닉네임이에요. 닉네임 옆에 실제 이름이 표시돼요.</p>
              <input
                {...register('nickname', { required: true })}
                placeholder="예: 아빠, 엄마, 하니, 유이..."
                maxLength={10}
                autoFocus
                className={errs.nickname && w('nickname') ? INPUT_ERR_CLS : INPUT_CLS}
              />
              {errs.nickname && w('nickname') && (
                <p className="font-korean text-sm text-rejected">{errs.nickname}</p>
              )}
              <p className="font-korean text-xs text-panel-sub">최대 10자 · 언제든지 수정 가능</p>
              <PixelButton variant="gold" fullWidth size="lg"
                onClick={() => canProceed1 && setStep(2)} disabled={!canProceed1}>
                다음
              </PixelButton>
            </div>
          )}

          {/* ── STEP 2: 역할 + 인증키 + PIN ── */}
          {step === 2 && (
            <div className="card-pixel p-4 mt-2 space-y-4">

              {/* 역할 선택 */}
              <div>
                <h2 className="font-korean text-base font-bold text-cream mb-3">역할 선택</h2>
                <div className="grid grid-cols-2 gap-2">
                  {SELECTABLE_ROLES.map(role => {
                    const isRegistered = registeredRealNames.includes(UI_ROLE_TO_REAL_NAME[role])
                    const isSelected   = watchedRole === role && !isRegistered
                    return (
                      <PixelButton
                        key={role}
                        variant={isRegistered ? 'ghost' : isSelected ? 'gold' : 'ghost'}
                        size="sm"
                        fullWidth
                        disabled={isRegistered}
                        onClick={() => !isRegistered && handleRoleChange(role)}
                        className="flex flex-col items-center py-3 h-auto gap-1"
                      >
                        <span className="text-2xl">{ROLE_ICONS[role]}</span>
                        <span className="font-bold text-sm">{UI_ROLE_LABELS[role]}</span>
                        <span className="text-xs opacity-80">
                          {isRegistered ? '✅ 가입완료' : ROLE_DESCRIPTIONS[role]}
                        </span>
                      </PixelButton>
                    )
                  })}
                </div>
              </div>

              {/* 가족 인증키 */}
              <div>
                <label className="font-korean text-sm font-bold text-panel-sub block mb-1">가족 인증키</label>
                <div className="relative">
                  <input
                    {...register('familyCode', { required: true })}
                    type={showCode ? 'text' : 'password'}
                    placeholder="우리 가족만 아는 코드"
                    className={errs.familyCode && w('familyCode') ? INPUT_ERR_CLS + ' pr-10' : INPUT_CLS + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowCode(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
                    {showCode ? '🙈' : '👁️'}
                  </button>
                </div>
                {errs.familyCode && w('familyCode') !== undefined && (
                  <p className="font-korean text-sm text-rejected mt-1">{errs.familyCode}</p>
                )}
                {watchedRole === 'DAD' && !errs.familyCode && (
                  <p className="font-korean text-xs text-panel-sub mt-1">기본값: {DEFAULT_FAMILY_CODE} — 설정에서 변경 가능</p>
                )}
              </div>

              {/* PIN */}
              <div>
                <label className="font-korean text-sm font-bold text-panel-sub block mb-1">로그인 PIN (2~8자리)</label>
                <div className="relative mb-2">
                  <input
                    {...register('pin', { required: true, maxLength: 8 })}
                    type={showPin ? 'text' : 'password'}
                    placeholder="숫자 또는 영문 (예: 1234)"
                    maxLength={8}
                    className={errs.pin && w('pin') ? INPUT_ERR_CLS + ' pr-10' : INPUT_CLS + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowPin(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
                    {showPin ? '🙈' : '👁️'}
                  </button>
                </div>
                {errs.pin && w('pin') && <p className="font-korean text-sm text-rejected mb-1">{errs.pin}</p>}
                <div className="relative">
                  <input
                    {...register('pinConfirm', { required: true, maxLength: 8 })}
                    type={showPinConfirm ? 'text' : 'password'}
                    placeholder="PIN 번호 확인"
                    maxLength={8}
                    className={errs.pinConfirm ? INPUT_ERR_CLS + ' pr-10' : INPUT_CLS + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowPinConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gold text-base">
                    {showPinConfirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {errs.pinConfirm && <p className="font-korean text-sm text-rejected mt-1">{errs.pinConfirm}</p>}
                {!errs.pin && !errs.pinConfirm && w('pin') && w('pinConfirm') && w('pin') === w('pinConfirm') && (
                  <p className="font-korean text-sm text-approved mt-1">PIN 번호가 일치해요</p>
                )}
              </div>

              {step2ServerError && (
                <div className="bg-rejected/10 border-2 border-rejected px-3 py-3">
                  <p className="font-korean text-sm font-bold text-rejected">⚠ 가입 불가</p>
                  <p className="font-korean text-xs text-rejected mt-1">{step2ServerError}</p>
                </div>
              )}

              <PixelButton variant="gold" fullWidth size="lg"
                onClick={handleStep2Next} disabled={!canProceed2 || step2Validating}>
                {step2Validating ? '확인 중...' : '다음'}
              </PixelButton>
            </div>
          )}

          {/* ── STEP 3: 생년월일 ── */}
          {step === 3 && (
            <div className="card-pixel p-4 mt-2 space-y-4">
              <div>
                <h2 className="font-korean text-base font-bold text-cream mb-1">생년월일</h2>
                <p className="font-korean text-sm text-panel-sub mb-3">달력에 생일이 자동으로 표시돼요.</p>

                <div className="flex gap-2 mb-4">
                  {(['양력', '음력'] as const).map(ct => (
                    <PixelButton key={ct}
                      variant={watchedCal === ct ? 'purple' : 'ghost'}
                      size="sm" className="flex-1"
                      onClick={() => setValue('calendarType', ct)}>
                      {ct}
                    </PixelButton>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'birthYear', label: '년', placeholder: '2018', min: '1940', max: '2025' },
                    { key: 'birthMonth', label: '월', placeholder: '9', min: '1', max: '12' },
                    { key: 'birthDay', label: '일', placeholder: '3', min: '1', max: '31' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="font-korean text-xs text-panel-sub block mb-1">{f.label}</label>
                      <input
                        {...register(f.key as keyof FormData, { required: true })}
                        type="number" placeholder={f.placeholder} min={f.min} max={f.max}
                        className={INPUT_CLS}
                      />
                    </div>
                  ))}
                </div>

                {(errs.birthYear || errs.birthMonth || errs.birthDay) && (
                  <div className="mt-2 space-y-0.5">
                    {errs.birthYear  && w('birthYear')  && <p className="font-korean text-sm text-rejected">{errs.birthYear}</p>}
                    {errs.birthMonth && w('birthMonth') && <p className="font-korean text-sm text-rejected">{errs.birthMonth}</p>}
                    {errs.birthDay   && w('birthDay')   && <p className="font-korean text-sm text-rejected">{errs.birthDay}</p>}
                  </div>
                )}
                {watchedCal === '음력' && (
                  <p className="font-korean text-sm text-hold mt-2">음력 생일은 달력에 음력 기준으로 표시돼요.</p>
                )}
              </div>

              <PixelButton variant="gold" fullWidth size="lg"
                onClick={() => canProceed3 && setStep(4)} disabled={!canProceed3}>
                다음
              </PixelButton>
            </div>
          )}

          {/* ── STEP 4: 캐릭터 선택 ── */}
          {step === 4 && (
            <div className="card-pixel p-4 mt-2 space-y-4">
              <div>
                <h2 className="font-korean text-base font-bold text-cream mb-1">내 캐릭터 선택</h2>
                <p className="font-korean text-sm text-panel-sub mb-3">
                  {UI_ROLE_LABELS[watchedRole]} — RPG 직업을 골라요
                </p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(REGISTER_CHARACTERS[watchedRole] ?? []).map(char => {
                    const isSelected = watchedChar === char.id
                    return (
                      <PixelButton key={char.id}
                        variant={isSelected ? 'gold' : 'ghost'}
                        size="sm" fullWidth
                        onClick={() => setValue('characterId', char.id)}
                        className="flex items-center gap-2 h-auto py-2.5 !justify-start"
                      >
                        <span className="text-xl flex-shrink-0">{char.emoji}</span>
                        <span className="font-korean text-xs leading-tight flex-1 text-left">{char.label}</span>
                        {isSelected && <span className="text-gold flex-shrink-0">✓</span>}
                      </PixelButton>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div className="bg-rejected/10 border-2 border-rejected px-3 py-3 space-y-2">
                  <p className="font-korean text-sm font-bold text-rejected">⚠ 가입에 실패했어요</p>
                  <p className="font-korean text-xs text-rejected leading-relaxed">{error}</p>
                  <button type="button" onClick={() => setError('')}
                    className="font-korean text-xs text-panel-sub underline">닫고 다시 시도하기</button>
                </div>
              )}

              <PixelButton type="submit" variant="gold" fullWidth size="lg"
                disabled={loading || !watchedChar}>
                {loading ? '가입 처리 중...' : '가입 완료!'}
              </PixelButton>
              <p className="font-korean text-xs text-panel-sub text-center">캐릭터는 나중에 프로필에서 변경 가능해요</p>
            </div>
          )}

        </form>
      </div>
    </div>
  )
}
