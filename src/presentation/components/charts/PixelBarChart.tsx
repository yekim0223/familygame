// Design Ref: §3-15 통계 — CSS 기반 픽셀 막대 그래프 (외부 라이브러리 없음)
interface BarData {
  label: string
  value: number
  color?: string
}

interface PixelBarChartProps {
  data: BarData[]
  maxValue?: number
  unit?: string
  height?: number
  className?: string
}

export function PixelBarChart({ data, maxValue, unit = '', height = 120, className = '' }: PixelBarChartProps) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1)

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="font-pixel text-[7px] text-pixel-dark">
                {d.value > 0 ? `${d.value}` : ''}
              </span>
              <div
                className="w-full border-t-2 border-pixel-dark transition-none"
                style={{
                  height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
                  background: d.color ?? '#7B5EA7',
                }}
              />
            </div>
          )
        })}
      </div>
      {/* X축 레이블 */}
      <div className="flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="font-korean text-[9px] text-stone truncate block">{d.label}</span>
          </div>
        ))}
      </div>
      {unit && (
        <p className="font-korean text-[9px] text-stone text-right">단위: {unit}</p>
      )}
    </div>
  )
}
