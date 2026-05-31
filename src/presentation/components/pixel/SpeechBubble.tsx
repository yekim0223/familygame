// Design Ref: §5.2 Pixel UI — RPG 2D 말풍선 컴포넌트
interface SpeechBubbleProps {
  text: string
  direction?: 'bottom' | 'top' | 'left'
  className?: string
  size?: 'sm' | 'md'
}

export function SpeechBubble({ text, direction = 'bottom', className = '', size = 'md' }: SpeechBubbleProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs'

  return (
    <div className={`relative ${className}`}>
      <div className={`speech-bubble px-3 py-2 font-korean ${textSize} text-pixel-dark max-w-xs`}>
        {text}
      </div>
      {direction === 'bottom' && (
        <div
          className="absolute left-4 bottom-0 translate-y-full w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #1A1A1A',
          }}
        />
      )}
    </div>
  )
}
