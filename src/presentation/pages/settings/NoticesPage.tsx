// 공지사항 관리 — 엄마/아빠 공통
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeNotices, addNotice, deleteNotice, type Notice } from '@/infrastructure/firebase/collections/notices'
import { PixelButton } from '@/presentation/components/pixel/PixelButton'
import { PixelModal } from '@/presentation/components/pixel/PixelModal'

const INPUT_CLS =
  'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub min-h-[44px] px-3 py-2.5 focus:outline-none focus:border-gold'
const TEXTAREA_CLS =
  'w-full input-pixel font-korean text-sm text-gold placeholder:text-panel-sub resize-none px-3 py-2.5 focus:outline-none focus:border-gold'

export default function NoticesPage() {
  const { currentMember, familyId } = useAuthStore()
  const [notices,       setNotices]       = useState<Notice[]>([])
  const [title,         setTitle]         = useState('')
  const [content,       setContent]       = useState('')
  const [saving,        setSaving]        = useState(false)
  const [msg,           setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  if (!isParent) return null

  const handleAdd = async () => {
    if (!familyId || !title.trim() || !content.trim()) return
    setSaving(true)
    setMsg(null)
    const { error } = await addNotice(
      familyId, title.trim(), content.trim(),
      currentMember?.id ?? '', currentMember?.name ?? '관리자'
    )
    setSaving(false)
    if (error) { setMsg({ type: 'err', text: '등록 실패: ' + error }); return }
    setMsg({ type: 'ok', text: '공지가 등록됐어요!' })
    setTitle(''); setContent('')
    setTimeout(() => setMsg(null), 3000)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !familyId) return
    await deleteNotice(familyId, deleteConfirm.id)
    if (expandedId === deleteConfirm.id) setExpandedId(null)
    setDeleteConfirm(null)
  }

  const toggleExpand = (id: string) =>
    setExpandedId(prev => (prev === id ? null : id))

  return (
    <div className="p-3 pb-8 space-y-4">

      {/* ── 헤더 ──────────────────────────────────────────── */}
      <h1 className="t-heading t-pixel-shadow">📢 공지사항 관리</h1>

      {/* ── 새 공지 작성 ────────────────────────────────── */}
      <div className="card-pixel p-4 space-y-3">
        <p className="t-sub font-bold text-gold">✏️ 새 공지 등록</p>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          maxLength={30}
          className={INPUT_CLS}
        />

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="내용을 입력하세요 (홈 화면에 최대 5줄 표시)"
          rows={4}
          maxLength={300}
          className={TEXTAREA_CLS}
        />

        {msg && (
          <p className={`font-korean text-sm font-bold ${msg.type === 'ok' ? 'text-approved' : 'text-rejected'}`}>
            {msg.type === 'ok' ? '✅ ' : '❌ '}{msg.text}
          </p>
        )}

        <PixelButton
          variant="gold"
          size="md"
          fullWidth
          disabled={saving || !title.trim() || !content.trim()}
          onClick={handleAdd}
        >
          {saving ? '등록 중...' : '공지 등록'}
        </PixelButton>
      </div>

      {/* ── 공지 목록 ────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="t-sub font-bold text-panel-sub px-1">
          등록된 공지{notices.length > 0 ? ` (${notices.length}개)` : ' 없음'}
        </p>

        {notices.length === 0 ? (
          <div className="card-pixel p-6 text-center">
            <p className="t-body text-panel-sub">📭 등록된 공지가 없어요</p>
            <p className="t-micro mt-1">위에서 첫 공지를 작성해보세요!</p>
          </div>
        ) : (
          notices.map(n => {
            const isExpanded = expandedId === n.id
            const dateStr = n.createdAt.toLocaleDateString('ko-KR', {
              month: 'long', day: 'numeric',
            })
            return (
              <div key={n.id} className="card-pixel overflow-hidden">

                {/* ── 목록 행 ──────────────────────────── */}
                <button
                  type="button"
                  onClick={() => toggleExpand(n.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left
                             hover:bg-gold/10 active:bg-gold/20 transition-colors min-h-[56px]"
                >
                  <span className="text-xl flex-shrink-0">{isExpanded ? '📖' : '📄'}</span>

                  <div className="flex-1 min-w-0">
                    <p className="t-heading t-pixel-shadow truncate">{n.title}</p>
                    {!isExpanded && (
                      <p className="t-micro mt-0.5 truncate">{n.content}</p>
                    )}
                    <p className="t-sub mt-0.5">{dateStr} · {n.authorName}</p>
                  </div>

                  <span
                    className={`font-pixel text-cream/50 text-xs flex-shrink-0
                                transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  >
                    ›
                  </span>
                </button>

                {/* ── 상세 본문 (아코디언) ─────────────── */}
                {isExpanded && (
                  <div className="border-t-2 border-black/40 mx-3">
                    <div className="speech-bubble m-3 border-panel-border">
                      <p className="t-body whitespace-pre-wrap">{n.content}</p>
                    </div>
                    <div className="flex justify-end px-3 pb-3">
                      <PixelButton
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteConfirm({ id: n.id, title: n.title })}
                      >
                        삭제
                      </PixelButton>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── 삭제 확인 팝업 (규칙 3: PixelModal) ──────────── */}
      <PixelModal
        open={!!deleteConfirm}
        title="공지 삭제"
        onClose={() => setDeleteConfirm(null)}
        size="sm"
      >
        <p className="font-korean text-sm text-cream text-center mb-1">
          이 공지를 삭제할까요?
        </p>
        <p className="font-korean text-xs text-panel-sub text-center mb-5 px-2 truncate">
          "{deleteConfirm?.title}"
        </p>
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
