// 기념일·생일·특별일 관리 — 가족 모두 등록·수정 가능, 삭제는 부모만
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeSpecialDays, addSpecialDay, updateSpecialDay, removeSpecialDay,
  SPECIAL_DAY_TYPE_LABELS, SPECIAL_DAY_EMOJIS, REPEAT_TYPE_LABELS,
  type SpecialDayDoc, type SpecialDayType, type RepeatType,
} from '@/infrastructure/firebase/collections/specialDays'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'

const TYPES: SpecialDayType[] = ['birthday', 'anniversary', 'holiday', 'other']
const REPEAT_TYPES: RepeatType[] = ['once', 'monthly', 'yearly']
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)

const INPUT_CLS  = 'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2 focus:outline-none focus:border-gold'
const SELECT_CLS = 'w-full input-pixel font-korean text-sm text-gold min-h-[44px] px-2 py-2 focus:outline-none focus:border-gold'

function blankForm() {
  return { name: '', type: 'birthday' as SpecialDayType, month: 1, day: 1, isLunar: false, emoji: '🎂', repeatType: 'yearly' as RepeatType }
}

export default function SpecialDaysPage() {
  const { familyId, currentMember } = useAuthStore()

  const [days, setDays]         = useState<SpecialDayDoc[]>([])
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [editingId, setEditingId]       = useState<string | null>(null)

  // 추가 폼
  const [form, setForm] = useState(blankForm())

  // 수정 폼 (editingId != null 일 때 사용)
  const [editForm, setEditForm] = useState(blankForm())

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'

  useEffect(() => {
    if (!familyId) return
    return subscribeSpecialDays(familyId, all => setDays(all.filter((d: any) => !d.deleted)))
  }, [familyId])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  const handleAdd = async () => {
    if (!familyId || !form.name.trim()) { showToast('이름을 입력해줘요', false); return }
    setSaving(true)
    const { error } = await addSpecialDay(familyId, { ...form, name: form.name.trim() })
    setSaving(false)
    if (error) { showToast('저장 실패: ' + error, false); return }
    showToast(`"${form.name.trim()}" 등록 완료!`, true)
    setForm(blankForm())
  }

  const startEdit = (d: SpecialDayDoc) => {
    setEditingId(d.id)
    setEditForm({ name: d.name, type: d.type, month: d.month, day: d.day, isLunar: d.isLunar, emoji: d.emoji, repeatType: d.repeatType ?? 'yearly' })
  }

  const handleUpdate = async () => {
    if (!familyId || !editingId || !editForm.name.trim()) return
    const { error } = await updateSpecialDay(familyId, editingId, { ...editForm, name: editForm.name.trim() })
    if (error) { showToast('수정 실패', false); return }
    showToast('수정됐어요', true)
    setEditingId(null)
  }

  const handleRemoveConfirm = async () => {
    if (!familyId || !deleteTarget) return
    const { error } = await removeSpecialDay(familyId, deleteTarget.id)
    setDeleteTarget(null)
    if (error) showToast('삭제 실패', false)
    else showToast('삭제됐어요', true)
  }

  const FormFields = ({ f, set }: { f: typeof form; set: (v: typeof form) => void }) => (
    <>
      <input value={f.name} onChange={e => set({ ...f, name: e.target.value.slice(0, 20) })}
        placeholder="예: 하윤 생일, 결혼기념일" maxLength={20} className={`${INPUT_CLS} mb-2`} />
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {TYPES.map(t => (
          <PixelButton key={t} variant={f.type === t ? 'purple' : 'ghost'} size="sm" fullWidth onClick={() => set({ ...f, type: t })}>
            {SPECIAL_DAY_TYPE_LABELS[t]}
          </PixelButton>
        ))}
      </div>
      {/* 반복 타입 */}
      <div className="mb-2">
        <p className="font-korean text-xs text-panel-sub mb-1">반복 타입</p>
        <div className="grid grid-cols-3 gap-1.5">
          {REPEAT_TYPES.map(rt => (
            <PixelButton key={rt} variant={f.repeatType === rt ? 'sky' : 'ghost'} size="sm" fullWidth onClick={() => set({ ...f, repeatType: rt })}>
              {REPEAT_TYPE_LABELS[rt]}
            </PixelButton>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <p className="font-korean text-xs text-panel-sub mb-1">월</p>
          <select value={f.month} onChange={e => set({ ...f, month: +e.target.value })} className={SELECT_CLS}>
            {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
        <div className="flex-1">
          <p className="font-korean text-xs text-panel-sub mb-1">일</p>
          <select value={f.day} onChange={e => set({ ...f, day: +e.target.value })} className={SELECT_CLS}>
            {DAYS.map(d => <option key={d} value={d}>{d}일</option>)}
          </select>
        </div>
        <div className="flex-shrink-0 flex flex-col">
          <p className="font-korean text-xs text-panel-sub mb-1">음력</p>
          <PixelButton variant={f.isLunar ? 'sky' : 'ghost'} size="sm" onClick={() => set({ ...f, isLunar: !f.isLunar })} className="h-[44px]">
            {f.isLunar ? '음력' : '양력'}
          </PixelButton>
        </div>
      </div>
      <div className="mb-3">
        <p className="font-korean text-xs text-panel-sub mb-1">이모지 — 현재: {f.emoji}</p>
        <div className="grid grid-cols-8 gap-1">
          {SPECIAL_DAY_EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => set({ ...f, emoji: e })}
              className={['text-xl aspect-square flex items-center justify-center border-2 transition-all',
                f.emoji === e ? 'border-gold bg-gold/20 scale-110' : 'border-panel-border bg-panel-darkest hover:bg-gold/10'].join(' ')}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <div className="p-3 pb-8 space-y-3">
      {toast && (
        <PixelModal open={!!toast} onClose={() => setToast(null)} title={toast?.ok ? '✅ 완료' : '❌ 오류'} size="sm">
          <p className={`font-korean text-sm text-center py-2 ${toast?.ok ? 'text-approved' : 'text-rejected'}`}>{toast?.msg}</p>
          <PixelButton variant="ghost" size="sm" fullWidth onClick={() => setToast(null)}>닫기</PixelButton>
        </PixelModal>
      )}

      <PixelModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="삭제 확인" size="sm">
        <p className="font-korean text-sm text-cream text-center mb-5">"{deleteTarget?.name}" 을(를) 삭제할까요?</p>
        <div className="flex gap-3">
          <PixelButton variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>취소</PixelButton>
          <PixelButton variant="danger" className="flex-1" onClick={handleRemoveConfirm}>삭제</PixelButton>
        </div>
      </PixelModal>

      <div className="flex items-center gap-2">
        <img src="/assets/icons/calendar.svg" width={18} height={18} alt="" style={{ imageRendering: 'pixelated' }} />
        <h1 className="t-sub font-bold text-gold t-pixel-shadow">기념일·생일 관리</h1>
      </div>

      {/* ── 추가 폼 ── */}
      <div className="card-pixel p-3">
        <p className="t-sub font-bold text-gold t-pixel-shadow mb-3">새 특별일 등록</p>
        <FormFields f={form} set={setForm} />
        <PixelButton variant="gold" size="lg" fullWidth disabled={saving || !form.name.trim()} onClick={handleAdd}>
          {saving ? '등록 중...' : '+ 등록하기'}
        </PixelButton>
      </div>

      {/* ── 등록된 목록 ── */}
      <p className="t-sub font-bold text-gold t-pixel-shadow">등록된 특별일 ({days.length})</p>
      {days.length === 0 ? (
        <div className="card-pixel p-4 text-center">
          <p className="font-korean text-sm text-panel-sub py-2">아직 등록된 특별일이 없어요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map(d => (
            <div key={d.id} className="card-pixel p-3">
              {editingId === d.id ? (
                <div className="space-y-2">
                  <FormFields f={editForm} set={setEditForm} />
                  <div className="flex gap-2">
                    <PixelButton variant="gold" size="sm" className="flex-1" onClick={handleUpdate}>저장</PixelButton>
                    <PixelButton variant="ghost" size="sm" className="flex-1" onClick={() => setEditingId(null)}>취소</PixelButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{d.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-korean text-sm font-bold text-cream">{d.name}</p>
                    <p className="font-korean text-xs text-panel-sub">
                      {d.month}월 {d.day}일{d.isLunar ? ' (음력)' : ''} · {SPECIAL_DAY_TYPE_LABELS[d.type]}
                    </p>
                    <p className="font-korean text-xs text-sky">
                      {REPEAT_TYPE_LABELS[d.repeatType ?? 'yearly']}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <PixelButton variant="ghost" size="sm" onClick={() => startEdit(d)}>수정</PixelButton>
                    {isParent && (
                      <PixelButton variant="danger" size="sm" onClick={() => setDeleteTarget({ id: d.id, name: d.name })}>삭제</PixelButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
