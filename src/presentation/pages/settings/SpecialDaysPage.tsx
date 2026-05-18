// 기념일·생일·특별일 관리 페이지 (부모 전용)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import {
  subscribeSpecialDays, addSpecialDay, removeSpecialDay,
  SPECIAL_DAY_TYPE_LABELS, SPECIAL_DAY_EMOJIS,
  type SpecialDayDoc, type SpecialDayType,
} from '@/infrastructure/firebase/collections/specialDays'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'

const TYPES: SpecialDayType[] = ['birthday', 'anniversary', 'holiday', 'other']
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 p-6">
      <div className={`w-full max-w-xs px-5 py-4 border-4 border-pixel-dark font-korean text-sm text-center
                       animate-fade-slide-up
                       ${ok ? 'bg-approved text-white' : 'bg-rejected text-white'}`}>
        {ok ? '✅ ' : '❌ '}{msg}
      </div>
    </div>
  )
}

export default function SpecialDaysPage() {
  const navigate = useNavigate()
  const { familyId, currentMember } = useAuthStore()

  const [days, setDays]     = useState<SpecialDayDoc[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  // 입력 폼 상태
  const [name,    setName]    = useState('')
  const [type,    setType]    = useState<SpecialDayType>('birthday')
  const [month,   setMonth]   = useState(1)
  const [day,     setDay]     = useState(1)
  const [isLunar, setIsLunar] = useState(false)
  const [emoji,   setEmoji]   = useState('🎂')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

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

  const handleRemove = async (id: string, label: string) => {
    if (!familyId) return
    if (!window.confirm(`"${label}" 을(를) 삭제할까요?`)) return
    const { error } = await removeSpecialDay(familyId, id)
    if (error) showToast('삭제 실패', false)
    else showToast('삭제됐어요', true)
  }

  if (!isParent) {
    return <div className="p-4"><p className="font-korean text-stone">부모만 볼 수 있어요</p></div>
  }

  return (
    <div className="p-3 pb-8 space-y-3">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div className="flex items-center gap-3 mb-1">
        <button type="button" onClick={() => navigate(-1)}
          className="font-korean text-sm font-bold text-pixel-dark">◀ 뒤로</button>
        <h1 className="font-korean text-base font-bold text-purple">📅 기념일·생일 관리</h1>
      </div>

      {/* ── 추가 폼 ── */}
      <PixelCard padding="sm">
        <p className="font-korean text-sm font-bold text-purple mb-3">새 특별일 등록</p>

        {/* 이름 */}
        <input
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder="예: 하윤 생일, 결혼기념일"
          maxLength={20}
          className="w-full bg-pixel-dark text-gold font-korean text-sm border-4 border-pixel-dark
                     px-3 py-2 focus:outline-none focus:border-gold mb-2"
        />

        {/* 유형 선택 */}
        <div className="grid grid-cols-2 gap-1 mb-2">
          {TYPES.map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={[
                'py-1.5 font-korean text-xs border-4 transition-all active:translate-y-0.5',
                type === t ? 'bg-purple text-white border-purple/80' : 'bg-cream text-pixel-dark border-pixel-dark',
              ].join(' ')}>
              {SPECIAL_DAY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 날짜 (월/일) */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <p className="font-korean text-xs text-stone mb-1">월</p>
            <select value={month} onChange={e => setMonth(+e.target.value)}
              className="w-full bg-pixel-dark text-gold font-korean text-sm border-4 border-pixel-dark
                         px-2 py-2 focus:outline-none focus:border-gold">
              {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>
          <div className="flex-1">
            <p className="font-korean text-xs text-stone mb-1">일</p>
            <select value={day} onChange={e => setDay(+e.target.value)}
              className="w-full bg-pixel-dark text-gold font-korean text-sm border-4 border-pixel-dark
                         px-2 py-2 focus:outline-none focus:border-gold">
              {DAYS.map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
          </div>
          <div className="flex-shrink-0 flex flex-col">
            <p className="font-korean text-xs text-stone mb-1">음력</p>
            <button type="button" onClick={() => setIsLunar(p => !p)}
              className={[
                'h-10 px-3 border-4 font-korean text-xs font-bold transition-all',
                isLunar ? 'bg-sky text-white border-blue-700' : 'bg-cream text-stone border-pixel-dark',
              ].join(' ')}>
              {isLunar ? '음력' : '양력'}
            </button>
          </div>
        </div>

        {/* 이모지 선택 — 2행 8열 그리드 */}
        <div className="mb-3">
          <p className="font-korean text-xs text-stone mb-1">이모지</p>
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => setShowEmojiPicker(p => !p)}
              className="text-2xl w-12 h-12 border-4 border-pixel-dark bg-cream
                         hover:border-gold flex items-center justify-center flex-shrink-0">
              {emoji}
            </button>
            <div className="grid grid-cols-8 gap-1 flex-1">
              {SPECIAL_DAY_EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => setEmoji(e)}
                  className={[
                    'text-xl aspect-square flex items-center justify-center border-2 transition-all',
                    emoji === e
                      ? 'border-gold bg-gold/20 scale-110'
                      : 'border-pixel-dark bg-cream hover:bg-gold/10 active:scale-95',
                  ].join(' ')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" onClick={handleAdd} disabled={saving || !name.trim()}
          className="w-full py-2.5 bg-gold border-4 border-yellow-600 font-korean text-base font-bold
                     text-pixel-dark hover:bg-yellow-400 active:translate-y-0.5 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? '등록 중...' : '+ 등록하기'}
        </button>
      </PixelCard>

      {/* ── 등록된 목록 ── */}
      <div>
        <p className="font-korean text-sm font-bold text-gold mb-2">등록된 특별일 ({days.length})</p>
        {days.length === 0 ? (
          <PixelCard padding="sm">
            <p className="font-korean text-xs text-stone text-center py-3">
              아직 등록된 특별일이 없어요 📅
            </p>
          </PixelCard>
        ) : (
          <div className="space-y-2">
            {days.map(d => (
              <PixelCard key={d.id} padding="sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{d.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-korean text-sm font-bold text-pixel-dark">{d.name}</p>
                    <p className="font-korean text-xs text-stone">
                      {d.month}월 {d.day}일{d.isLunar ? ' (음력)' : ''} · {SPECIAL_DAY_TYPE_LABELS[d.type]}
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => handleRemove(d.id, d.name)}
                    className="px-3 py-1.5 bg-rejected border-2 border-red-800 font-korean text-xs
                               font-bold text-white hover:bg-red-600 active:translate-y-0.5 transition-all flex-shrink-0">
                    삭제
                  </button>
                </div>
              </PixelCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
