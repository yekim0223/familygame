// 공지사항 관리 — 엄마/아빠 공통
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { subscribeNotices, addNotice, deleteNotice, type Notice } from '@/infrastructure/firebase/collections/notices'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'

export default function NoticesPage() {
  const { currentMember, familyId } = useAuthStore()
  const [notices,  setNotices]  = useState<Notice[]>([])
  const [title,    setTitle]    = useState('')
  const [content,  setContent]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    if (!familyId) return
    return subscribeNotices(familyId, setNotices)
  }, [familyId])

  const isParent = currentMember?.role === 'DAD' || currentMember?.role === 'MOM'
  if (!isParent) return null

  const handleAdd = async () => {
    if (!familyId || !title.trim() || !content.trim()) return
    setSaving(true)
    setMsg('')
    const { error } = await addNotice(
      familyId, title.trim(), content.trim(),
      currentMember?.id ?? '', currentMember?.name ?? '관리자'
    )
    setSaving(false)
    if (error) { setMsg('❌ 등록 실패: ' + error); return }
    setMsg('✅ 공지가 등록됐어요!')
    setTitle(''); setContent('')
    setTimeout(() => setMsg(''), 3000)
  }

  const handleDelete = async (noticeId: string, noticeTitle: string) => {
    if (!familyId || !window.confirm(`"${noticeTitle}" 공지를 삭제할까요?`)) return
    await deleteNotice(familyId, noticeId)
  }

  return (
    <div className="p-3 pb-4 space-y-3">
      <h1 className="font-korean text-base font-bold text-gold">📢 공지사항 관리</h1>

      {/* 작성 */}
      <PixelCard padding="sm">
        <p className="font-korean text-sm font-bold text-purple mb-3">새 공지 등록</p>
        <div className="space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="제목" maxLength={30}
            className="w-full bg-pixel-dark text-gold font-korean text-sm
                       border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold" />
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="내용 (홈 화면에 최대 5줄 표시)" rows={3} maxLength={300}
            className="w-full bg-pixel-dark text-gold font-korean text-sm resize-none
                       border-4 border-pixel-dark px-3 py-2 focus:outline-none focus:border-gold" />
          {msg && (
            <p className={`font-korean text-xs font-bold ${msg.startsWith('✅') ? 'text-approved' : 'text-rejected'}`}>
              {msg}
            </p>
          )}
          <button type="button" onClick={handleAdd}
            disabled={saving || !title.trim() || !content.trim()}
            className="w-full py-2.5 bg-purple border-4 border-pixel-dark font-korean text-sm font-bold
                       text-white hover:bg-purple/90 active:translate-y-0.5 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? '등록 중...' : '공지 등록'}
          </button>
        </div>
      </PixelCard>

      {/* 목록 */}
      {notices.length > 0 && (
        <PixelCard padding="sm">
          <p className="font-korean text-xs font-bold text-stone mb-2">등록된 공지 ({notices.length}개)</p>
          <div className="space-y-2">
            {notices.map(n => (
              <div key={n.id} className="flex items-center gap-2 py-1.5 border-b border-stone/20 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-korean text-xs font-bold text-pixel-dark truncate">{n.title}</p>
                  <p className="font-korean text-[10px] text-stone">
                    {n.createdAt.toLocaleDateString()} · {n.authorName}
                  </p>
                </div>
                <button type="button" onClick={() => handleDelete(n.id, n.title)}
                  className="px-2 py-1 font-korean text-xs font-bold text-white bg-rejected
                             border-2 border-red-800 hover:bg-red-600 active:translate-y-0.5 flex-shrink-0">
                  삭제
                </button>
              </div>
            ))}
          </div>
        </PixelCard>
      )}

      {notices.length === 0 && (
        <p className="font-korean text-xs text-stone text-center py-4">등록된 공지가 없어요</p>
      )}
    </div>
  )
}
