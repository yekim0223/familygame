// 기념일·생일·특별일 관리 페이지 (부모 전용)
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeSpecialDays, addSpecialDay, removeSpecialDay,
  SPECIAL_DAY_TYPE_LABELS, SPECIAL_DAY_EMOJIS,
  type SpecialDayDoc, type SpecialDayType,
} from '@/infrastructure/firebase/collections/specialDays'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'

const TYPES: SpecialDayType[] = ['birthday', 'anniversary', 'holiday', 'other']
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)

const INPUT_CLS = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2 focus:outline-none focus:border-gold'
const SELECT_CLS = 'w-full input-pixel font-korean text-sm text-gold min-h-[44px] px-2 py-2 focus:outline-none focus:border-gold'

export default function SpecialDaysPage() {
  const { familyId, currentMember } = useAuthStore()

  const [days, setDays]     = useState<SpecialDayDoc[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const [name,    setName]    = useState('')
  const [type,    setType]    = useState<SpecialDayType>('birthday')
  const [month,   setMonth]   = useState(1)
  const [day,     setDay]     = useState(1)
  const [isLunar, setIsLunar] = useState(false)
  const [emoji,   setEmoji]   = useState('🎂')

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  useEffect(() => {
    if (!familyId || !isParent) return
    const unsub = subscribeSpecialDays(familyId, all => setDays(all.filter((d: any) => !d.deleted)))
    return unsub
  }, [familyId, isParent])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  const handleAdd = async () => {
    if (!familyId || !name.trim()) { showToast('이름을 입력해줘요', false); return }
    setSaving(true)
    const { error } = await addSpecialDay(familyId, {
      name: name.trim(), type, month, day, isLunar, emoji,
    })
    setSaving(false)
    if (error) { showToast('저장 실패: ' + error, false); return }
    showToast(`"${name.trim()}" 등록 완료!`, true)
    setName(''); setType('birthday'); setMonth(1); setDay(1); setIsLunar(false); setEmoji('🎂')
  }

  const handleRemoveConfirm = async () => {
    if (!familyId || !deleteTarget) return
    const { error } = await removeSpecialDay(familyId, deleteTarget.id)
    setDeleteTarget(null)
    if (error) showToast('삭제 실패', false)
    else showToast('삭제됐어요', true)
  }

  if (!isParent) {
    return <div className="p-4"><p className="font-korean text-sm text-panel-sub">부모만 볼 수 있어요</p></div>
  }

  return (
    <div className="p-3 pb-8 space-y-3">

      {/* 토스트 */}
      <PixelModal
        open={!!toast}
        onClose={() => setToast(null)}
        title={toast?.ok ? '✅ 완료' : '❌ 오류'}
        size="sm"
      >
        <p className={`font-korean text-sm text-center py-2 ${toast?.ok ? 'text-approved' : 'text-rejected'}`}>
          {toast?.msg}
        </p>
        <PixelButton variant="ghost" size="sm" fullWidth onClick={() => setToast(null)}>닫기</PixelButton>
      </PixelModal>

      {/* 삭제 확인 */}
      <PixelModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="삭제 확인"
        size="sm"
      >
        <p className="font-korean text-sm text-cream text-center mb-5">
          "{deleteTarget?.name}" 을(를) 삭제할까요?
        </p>
        <div className="flex gap-3">
          <PixelButton variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>취소</PixelButton>
          <PixelButton variant="danger" className="flex-1" onClick={handleRemoveConfirm}>삭제</PixelButton>
        </div>
      </PixelModal>

      <div className="flex items-center gap-2">
        <span className="text-base">📅</span>
        <h1 className="t-sub font-bold text-gold t-pixel-shadow">기념일·생일 관리</h1>
      </div>

      {/* ── 추가 폼 ── */}
      <div className="card-pixel p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">➕</span>
          <p className="t-sub font-bold text-gold t-pixel-shadow">새 특별일 등록</p>
        </div>

        <input
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder="예: 하윤 생일, 결혼기념일"
          maxLength={20}
          className={`${INPUT_CLS} mb-2`}
        />

        {/* 유형 선택 */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {TYPES.map(t => (
            <PixelButton
              key={t}
              variant={type === t ? 'purple' : 'ghost'}
              size="sm"
              fullWidth
              onClick={() => setType(t)}
            >
              {SPECIAL_DAY_TYPE_LABELS[t]}
            </PixelButton>
          ))}
        </div>

        {/* 날짜 (월/일) */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <p className="font-korean text-xs text-panel-sub mb-1">월</p>
            <select value={month} onChange={e => setMonth(+e.target.value)} className={SELECT_CLS}>
              {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="font-korean text-xs text-panel-sub mb-1">일</p>
            <select value={day} onChange={e => setDay(+e.target.value)} className={SELECT_CLS}>
              {DAYS.map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
          </div>
          <div className="flex-shrink-0 flex flex-col">
            <p className="font-korean text-xs text-panel-sub mb-1">음력</p>
            <PixelButton
              variant={isLunar ? 'sky' : 'ghost'}
              size="sm"
              onClick={() => setIsLunar(p => !p)}
              className="h-[44px]"
            >
              {isLunar ? '음력' : '양력'}
            </PixelButton>
          </div>
        </div>

        {/* 이모지 선택 */}
        <div className="mb-3">
          <p className="font-korean text-xs text-panel-sub mb-1">이모지 — 현재 선택: {emoji}</p>
          <div className="grid grid-cols-8 gap-1">
            {SPECIAL_DAY_EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setEmoji(e)}
                className={[
                  'text-xl aspect-square flex items-center justify-center border-2 transition-all',
                  emoji === e
                    ? 'border-gold bg-gold/20 scale-110'
                    : 'border-panel-border bg-panel-darkest hover:bg-gold/10 active:scale-95',
                ].join(' ')}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <PixelButton
          variant="gold" size="lg" fullWidth
          disabled={saving || !name.trim()}
          onClick={handleAdd}
        >
          {saving ? '등록 중...' : '+ 등록하기'}
        </PixelButton>
      </div>

      {/* ── 등록된 목록 ── */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">📋</span>
        <p className="t-sub font-bold text-gold t-pixel-shadow">등록된 특별일 ({days.length})</p>
      </div>
      {days.length === 0 ? (
        <div className="card-pixel p-4 text-center">
          <p className="font-korean text-sm text-panel-sub py-2">아직 등록된 특별일이 없어요 📅</p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map(d => (
            <div key={d.id} className="card-pixel p-3 flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">{d.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-korean text-sm font-bold text-cream">{d.name}</p>
                <p className="font-korean text-xs text-panel-sub">
                  {d.month}월 {d.day}일{d.isLunar ? ' (음력)' : ''} · {SPECIAL_DAY_TYPE_LABELS[d.type]}
                </p>
              </div>
              <PixelButton
                variant="danger" size="sm"
                onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
              >
                삭제
              </PixelButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
