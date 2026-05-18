// Design Ref: 보상 종류 관리 — 전체 목록
import { useNavigate } from 'react-router-dom'
import { PixelCard } from '@/presentation/components/pixel/PixelCard'

const DEFAULT_REWARDS = [
  { emoji: '💰', label: '용돈',      unit: '100원 단위', active: true },
  { emoji: '🎮', label: '게임시간',  unit: '10분 단위',  active: true },
  { emoji: '📱', label: '핸드폰시간',unit: '10분 단위',  active: true },
  { emoji: '🎁', label: '선물',      unit: '텍스트 입력', active: true },
  { emoji: '🍕', label: '외식',      unit: '텍스트 입력', active: true },
  { emoji: '⭐', label: 'EXP 보너스',unit: '1점 단위',   active: true },
  { emoji: '🎪', label: '놀이공원',  unit: '특별 이벤트', active: false },
  { emoji: '📚', label: '책 선물',   unit: '텍스트 입력', active: false },
  { emoji: '🎬', label: '영화 관람', unit: '특별 이벤트', active: false },
  { emoji: '🏖️', label: '여행',      unit: '특별 이벤트', active: false },
]

export default function RewardTypesPage() {
  const navigate = useNavigate()

  return (
    <div className="p-3 pb-8 space-y-3">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" onClick={() => navigate(-1)}
          className="font-korean text-sm font-bold text-pixel-dark">◀ 뒤로</button>
        <h1 className="font-korean text-base font-bold text-purple">💰 보상 종류 관리</h1>
      </div>
      <p className="font-korean text-xs text-stone">
        커스텀 보상은 최대 10종까지 등록 가능해요. (사용중 {DEFAULT_REWARDS.filter(r=>r.active).length}종)
      </p>
      <div className="space-y-2">
        {DEFAULT_REWARDS.map((item, i) => (
          <PixelCard key={i} padding="sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-korean text-sm font-bold text-pixel-dark">{item.label}</p>
                <p className="font-korean text-[10px] text-stone">{item.unit}</p>
              </div>
              <span className={`font-korean text-xs font-bold px-2 py-1 border-2 flex-shrink-0
                ${item.active
                  ? 'bg-approved text-white border-green-800'
                  : 'bg-cream text-stone border-stone'}`}>
                {item.active ? '사용중' : '대기'}
              </span>
            </div>
          </PixelCard>
        ))}
      </div>
      <button type="button"
        className="w-full py-3 font-korean text-sm font-bold text-pixel-dark
                   bg-gold border-4 border-yellow-600 hover:bg-yellow-400
                   active:translate-y-0.5 transition-all">
        + 커스텀 보상 추가
      </button>
    </div>
  )
}
