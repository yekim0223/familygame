import { useState, useCallback } from 'react'
import type { EffectType } from './EffectOverlay'

interface TriggerOptions {
  count?: number
  duration?: number
}

/**
 * 이펙트 트리거 훅 — 컴포넌트에서 EffectOverlay를 제어하는 표준 인터페이스
 * 사용: const { activeEffect, triggerEffect, clearEffect } = useEffectTrigger()
 */
export function useEffectTrigger() {
  const [activeEffect, setActiveEffect] = useState<{
    type: EffectType
    count: number
    duration: number
  } | null>(null)

  const triggerEffect = useCallback((type: EffectType, opts: TriggerOptions = {}) => {
    setActiveEffect({
      type,
      count: opts.count ?? 24,
      duration: opts.duration ?? 1800,
    })
  }, [])

  const clearEffect = useCallback(() => setActiveEffect(null), [])

  return { activeEffect, triggerEffect, clearEffect }
}
