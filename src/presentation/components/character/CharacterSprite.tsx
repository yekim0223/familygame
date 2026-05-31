// Design Ref: §5.2 Character — 역할별 통일된 사람 모양 베이스 캐릭터
// 모든 역할은 동일한 사람 실루엣으로 표시, 직업은 우상단 배지로 구분
import type { Role } from '@/domain/entities/Member'
import { CHARACTER_EMOJI, CHARACTER_LABELS, PET_UNLOCKS } from '@/application/use-cases/characters/selectCharacter'

interface CharacterSpriteProps {
  characterId: string
  role: Role
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: 'bob' | 'none'
  // 'job': 직업 도구 이모지를 메인으로 (프로필/홈/헤더)
  // 'person': 역할별 사람 이모지를 메인으로 (로그인 캐릭터 선택)
  variant?: 'job' | 'person'
  className?: string
}

// 역할별 배경 색상 (픽셀 테마)
const ROLE_BG: Record<Role, string> = {
  DAD:      'bg-sky',
  MOM:      'bg-pink',
  CHILD:    'bg-purple',
  OBSERVER: 'bg-stone',
}

// 역할별 테두리 색상
const ROLE_BORDER: Record<Role, string> = {
  DAD:      'border-sky',
  MOM:      'border-pink',
  CHILD:    'border-purple',
  OBSERVER: 'border-stone',
}

// 역할별 베이스 사람 이모지 (통일된 사람 모양)
const ROLE_PERSON: Record<Role, string> = {
  DAD:      '👨',
  MOM:      '👩',
  CHILD:    '👧',
  OBSERVER: '🧑',
}

const SIZE: Record<string, {
  box: string; text: string; badge: string; badgePos: string
}> = {
  sm: {
    box:      'w-10 h-10 text-2xl',
    text:     'text-[7px]',
    badge:    'text-[8px] w-4 h-4',
    badgePos: '-top-1 -right-1',
  },
  md: {
    box:      'w-14 h-14 text-4xl',
    text:     'text-[8px]',
    badge:    'text-xs w-5 h-5',
    badgePos: '-top-1.5 -right-1.5',
  },
  lg: {
    box:      'w-20 h-20 text-5xl',
    text:     'text-xs',
    badge:    'text-sm w-7 h-7',
    badgePos: '-top-2 -right-2',
  },
  xl: {
    box:      'w-28 h-28 text-7xl',
    text:     'text-xs',
    badge:    'text-base w-9 h-9',
    badgePos: '-top-2 -right-2',
  },
}

export function CharacterSprite({
  characterId, role, size = 'md', animate = 'none', variant = 'job', className = '',
}: CharacterSpriteProps) {
  const s        = SIZE[size] ?? SIZE.md
  const bg       = ROLE_BG[role]     ?? 'bg-stone'
  const person   = ROLE_PERSON[role] ?? '👤'
  const jobEmoji = CHARACTER_EMOJI[characterId]
  const jobLabel = CHARACTER_LABELS[characterId]

  // ── job variant: 직업 도구 이모지를 메인으로 (프로필/홈/헤더) ──
  if (variant === 'job') {
    return (
      <div className={`relative inline-flex flex-col items-center ${className}`}>
        <div className={[
          'flex items-center justify-center',
          'border-4 border-pixel-dark',
          bg,
          s.box,
          animate === 'bob' ? 'animate-character-bob' : '',
        ].join(' ')}>
          <span role="img" className="leading-none select-none">
            {jobEmoji ?? person}
          </span>
        </div>
        {jobLabel && size !== 'sm' && (
          <span className={`font-korean text-stone mt-0.5 truncate max-w-full text-center ${s.text}`}>
            {jobLabel}
          </span>
        )}
      </div>
    )
  }

  // ── person variant: 역할별 사람 이모지를 메인으로 (로그인 화면) ──
  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div className={[
        'flex items-center justify-center',
        'border-4 border-pixel-dark',
        bg,
        s.box,
        animate === 'bob' ? 'animate-character-bob' : '',
      ].join(' ')}>
        <span role="img" className="leading-none select-none">{person}</span>
      </div>
      {jobEmoji && (
        <div className={[
          'absolute flex items-center justify-center',
          'bg-gold border-2 border-pixel-dark',
          s.badge, s.badgePos,
        ].join(' ')}>
          <span className="leading-none select-none">{jobEmoji}</span>
        </div>
      )}
      {jobLabel && size !== 'sm' && (
        <span className={`font-korean text-stone mt-0.5 truncate max-w-full text-center ${s.text}`}>
          {jobLabel}
        </span>
      )}
    </div>
  )
}

// ── 반려동물 스프라이트 (PET_UNLOCKS 전체 50종 매핑) ────────────
const PET_EMOJI: Record<string, string> = Object.fromEntries(
  PET_UNLOCKS.map(p => [p.id, p.emoji])
)

interface PetSpriteProps {
  petId: string
  size?: 'sm' | 'md'
  className?: string
}

export function PetSprite({ petId, size = 'sm', className = '' }: PetSpriteProps) {
  const emoji = PET_EMOJI[petId] ?? '🐕'
  const s = size === 'sm' ? 'w-8 h-8 text-lg' : 'w-12 h-12 text-2xl'
  return (
    <div className={`flex items-center justify-center bg-stone border-2 border-pixel-dark ${s} ${className}`}>
      {emoji}
    </div>
  )
}
