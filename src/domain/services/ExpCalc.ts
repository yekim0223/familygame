// Design Ref: §3 Domain — 레벨 EXP 계산 (Lv.21~30 확정: 500점/레벨)

const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds: number[] = [0] // Lv.1 = 0 EXP
  let total = 0
  for (let lv = 1; lv <= 100; lv++) {
    let needed: number
    if (lv <= 10)       needed = 100
    else if (lv <= 30)  needed = 500
    else if (lv <= 50)  needed = 1000
    else if (lv <= 70)  needed = 2000
    else if (lv <= 90)  needed = 3000
    else                needed = 5000
    total += needed
    thresholds.push(total)
  }
  return thresholds
})()

export function getLevelFromExp(exp: number): number {
  for (let lv = 100; lv >= 1; lv--) {
    if (exp >= LEVEL_THRESHOLDS[lv - 1]) return lv
  }
  return 1
}

export function getExpForNextLevel(level: number): number {
  if (level >= 100) return 0
  return LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level - 1]
}

export function getExpInCurrentLevel(exp: number, level: number): number {
  return exp - LEVEL_THRESHOLDS[level - 1]
}

export function getLevelProgress(exp: number): { level: number; current: number; needed: number } {
  const level = getLevelFromExp(exp)
  const current = getExpInCurrentLevel(exp, level)
  const needed = getExpForNextLevel(level)
  return { level, current, needed }
}
