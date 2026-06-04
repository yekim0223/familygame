// Design Ref: §5.2 Character Animations — 역할별 CSS Keyframe 로그인 애니메이션
import { useEffect, useState } from 'react'
import type { Role } from '@/domain/entities/Member'

interface LoginAnimationProps {
  role: Role
  characterId: string
  onComplete?: () => void
}

// 역할별 픽셀 씬 (이모지 + CSS 애니메이션 조합)
const ROLE_SCENES: Record<Role, { main: string; action: string; animClass: string }> = {
  DAD:      { main: '⛏️', action: '🪨', animClass: 'animate-character-mine' },
  MOM:      { main: '📣', action: '❓', animClass: 'animate-character-bob' },
  CHILD:    { main: '⚔️', action: '👾', animClass: 'animate-character-sword' },
  OBSERVER: { main: '📖', action: '👀', animClass: 'animate-character-bob' },
}

export function LoginAnimation({ role, onComplete }: LoginAnimationProps) {
  const [visible, setVisible] = useState(true)
  const scene = ROLE_SCENES[role]

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onComplete?.() }, 2000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-slide-up">
      <div className="flex flex-col items-center gap-3">
        {/* 메인 캐릭터 */}
        <div className={`text-8xl ${scene.animClass}`}>
          {scene.main}
        </div>
        {/* 액션 오브젝트 */}
        <div className="text-4xl animate-pixel-bounce">
          {scene.action}
        </div>
        <p className="font-pixel text-2xl tracking-wide text-gold t-pixel-shadow scale-110">
          START! 🎮
        </p>
        {/* 스킵 안내 */}
        <p className="font-pixel text-xs text-cream/70 animate-pulse">tap to skip</p>
      </div>
    </div>
  )
}
