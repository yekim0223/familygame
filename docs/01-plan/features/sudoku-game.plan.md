# 언도쿠 (Undoku) — 패밀리 두뇌 퍼즐 Planning Document

> **Summary**: 9살 아이도 즐길 수 있는 5단계 스도쿠 퍼즐. 내 캐릭터+펫 반응, 슈웅 연출, 시간 기반 점수, 가족 랭킹으로 두뇌와 재미를 동시에 잡는다.
>
> **Project**: Family Quest (패밀리 퀘스트)
> **Feature**: sudoku-game (게임명: 언도쿠)
> **Version**: 1.1.0 (슈웅 연출 · 게임오버 플래시 · 캐릭터 배치 추가)
> **Author**: youngeon
> **Date**: 2026-06-04
> **Status**: Plan Confirmed

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 기존 게임이 반사신경 기반 → 두뇌 훈련 장르 없음. 9살 아이에게 집중력+성취감을 주는 퍼즐이 없다. |
| **Solution** | 세계적으로 검증된 스도쿠를 "언도쿠"로 브랜딩. 아빠 슈웅·엄마 축하·내 캐릭터+펫 반응 연출로 패밀리 퀘스트만의 몰입 퍼즐로 차별화한다. |
| **Function/UX Effect** | 게임 시작 시 아빠가 FIGHTING 외치며 슈웅 통과, 정답/오답 시 캐릭터+펫 반응, 완성 시 폭죽, 오버 시 오답 5초 플래시, 1위 달성 시 엄마 Congratulation 슈웅. |
| **Core Value** | 두뇌 훈련 + 가족 캐릭터 연출 + 랭킹 경쟁. 기존 SVG·CSS 애니메이션·EffectOverlay 100% 재활용. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 반사신경 게임만 있는 현재 → 두뇌 퍼즐 추가 → 다양한 연령층 커버 |
| **WHO** | 하윤·서윤 (9살, 성취감·캐릭터 반응에 민감) / 부모 (함께 풀며 랭킹 경쟁) |
| **RISK** | 백트래킹 생성 속도, 모바일 숫자 입력 UX, 슈웅 타이밍 겹침 |
| **SUCCESS** | 5단계 플레이·슈웅 2종·게임오버 플래시·캐릭터+펫 반응·랭킹 저장 모두 작동, tsc 에러 0 |
| **SCOPE** | 신규 SudokuGame.tsx 1개 + GamePage 수정 + CSS keyframe 2개 추가 |

---

## 1. 게임 개요

### 1.1 핵심 룰 (표준 스도쿠)

- **9×9 그리드**, 3×3 블록 9개
- 각 행·열·3×3 블록에 1~9 숫자가 하나씩만
- 힌트(고정) 외 빈 칸을 모두 채우면 클리어
- 오답 입력 → 즉시 빨간색 강조 (자동 수정 없음, 직접 지워야 함)

### 1.2 승패 조건

| 조건 | 결과 |
|------|------|
| 모든 칸 정확히 완성 | ✅ 클리어 → 점수 계산 → 결과 화면 |
| 타이머 0초 | ❌ 타임오버 → **게임오버 플래시 5초** → 결과 화면 |
| **오답 2회 누적** | ❌ **생명 소진 → 즉시 게임오버 플래시 → 5초 → 결과** |
| 뒤로가기 | ❌ 포기 → 0점 |

### 1.3 생명 시스템 ♥♥ (신규)

```
시작: 생명 2개 부여 (♥♥)
오답 1회: ♥♡ — playerHit() SFX + 캐릭터 흔들기 + 화면 빨간 테두리 플래시
오답 2회: 💀 — 즉시 게임오버 플래시 5초 → 결과화면 (0점)

HUD 우측: ♥♥ / ♥♡ / 💀 표시
오답 입력 시: errors[r][c] = true && lives-- 동시 처리
lives === 0 → phase = 'timeout' (동일 게임오버 흐름 재활용)
```

---

## 2. 난이도 시스템

### 2.1 5단계 스펙

| Lv | 이름 | 힌트 수 | 빈 칸 | 제한시간 | 기본점수 | 최대점수 |
|----|------|---------|------|---------|---------|---------|
| 1 | 입문 ⭐ | 50개 | 31개 | 15분 | 500 | 1,000 |
| 2 | 쉬움 ⭐⭐ | 40개 | 41개 | 13분 | 1,000 | 2,000 |
| 3 | 보통 ⭐⭐⭐ | 32개 | 49개 | 10분 | 2,000 | 4,000 |
| 4 | 어려움 ⭐⭐⭐⭐ | 27개 | 54개 | 8분 | 3,500 | 7,000 |
| 5 | 최고난도 ⭐⭐⭐⭐⭐ | 22개 | 59개 | **가변↓** | 5,000 | 10,000 |

### 2.2 선택 방식
- **모든 레벨 처음부터 자유 선택** (잠금 없음)
- 선택 화면: 레벨별 최고기록 + 클리어 횟수 표시

### 2.3 Lv5 점진적 타이머

```
제한시간 = MAX(3분, 10분 − 누적클리어횟수 × 1분)

1회차: 10분
2회차:  9분
...
7회차:  4분
8회+:   3분 (최소 고정)

저장: localStorage('fq_sudoku_lv5_clears')
표시: 게임 시작 시 "이번 제한: X분" 안내
```

---

## 3. 점수 공식

```
점수 = 기본점수 × (1 + 잔여시간 / 전체시간) − (오답횟수 × 50)
최소 점수 = 기본점수 × 0.2  (마이너스 방지)
```

| Lv | 기본점수 | 10% 남음 | 50% 남음 | 100% 남음 |
|----|---------|---------|---------|---------|
| 1 | 500 | 550 | 750 | 1,000 |
| 3 | 2,000 | 2,200 | 3,000 | 4,000 |
| 5 | 5,000 | 5,500 | 7,500 | 10,000 |

---

## 4. 슈웅 연출 시스템 ✨ (신규)

> **기존 `@keyframes logoGloss` 재활용**: `translateX(-220%) skewX(-18deg) → translateX(420%) skewX(-18deg)` 패턴 동일

### 4.1 시작 슈웅 — 아빠 FIGHTING!!! (1회)

```
발동: 게임 마운트 시 1회 (useEffect [], 0.5초 딜레이)
연출:
  ① base-dad.svg (64px) + "FIGHTING!!!" 텍스트 박스가
  ② 화면 왼쪽 밖에서 → 화면 오른쪽 밖으로 슈웅 통과
  ③ 1.2초 동안 translateX(-150vw → 150vw) ease-in
  ④ skewX(-12deg) 기울어짐 (속도감 표현)
  ⑤ 텍스트: font-pixel text-gold "FIGHTING!!!" + drop-shadow

CSS keyframe (신규 추가):
@keyframes swoosh-lr {
  0%   { transform: translateX(-150%) skewX(-12deg); opacity: 0 }
  15%  { opacity: 1 }
  85%  { opacity: 1 }
  100% { transform: translateX(150vw)  skewX(-12deg); opacity: 0 }
}
```

### 4.2 1위 달성 슈웅 — 엄마 Congratulation ❤️

```
발동: ResultScreen에서 myRank === 1 확인 시 (0.8초 딜레이)
연출:
  ① base-mom.svg (64px) + "Congratulation ❤️" 텍스트가
  ② 화면 오른쪽 밖에서 → 화면 왼쪽 밖으로 슈웅 통과 (반대 방향)
  ③ 1.4초 동안 translateX(150vw → -150%) ease-in
  ④ skewX(12deg) (반대 기울기)
  ⑤ 텍스트: font-korean text-pink "Congratulation ❤️"

CSS keyframe (신규 추가):
@keyframes swoosh-rl {
  0%   { transform: translateX(150%)  skewX(12deg); opacity: 0 }
  15%  { opacity: 1 }
  85%  { opacity: 1 }
  100% { transform: translateX(-150vw) skewX(12deg); opacity: 0 }
}
```

### 4.3 구현 위치

```tsx
// SudokuGame.tsx — 슈웅 오버레이 (z-50, pointer-events-none)
{showFightingBanner && (
  <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
    <div style={{ animation: 'swoosh-lr 1.2s ease-in forwards', position: 'absolute', top: '40%' }}>
      <img src="/assets/characters/base-dad.svg" width={64} height={64} />
      <span className="font-pixel text-gold text-xl ml-2"
            style={{ textShadow: '2px 2px 0 #000' }}>FIGHTING!!!</span>
    </div>
  </div>
)}

// ResultScreen — 1위 슈웅
{myRank === 1 && showCongratsBanner && (
  <div style={{ animation: 'swoosh-rl 1.4s ease-in forwards', ... }}>
    <span>Congratulation ❤️</span>
    <img src="/assets/characters/base-mom.svg" width={64} height={64} />
  </div>
)}
```

---

## 5. 게임오버 플래시 ✨ (신규)

```
발동: 타이머 0초 도달 시
연출:
  ① 그리드 위 반투명 검정 오버레이 (bg-black/60)
  ② 오답으로 입력된 모든 셀: animate-pulse + bg-rejected/50 (빨간 깜빡임)
  ③ 중앙 텍스트: font-pixel "TIME OVER" text-rejected (3D 그림자)
  ④ 하단: "오답 N개" + 정확히 맞힌 칸 수 표시
  ⑤ 카운트다운 바 (5 → 0초, 빨간 progress bar)
  ⑥ 5초 후 자동으로 결과 화면으로 이동

코드 패턴 (PonpokoGame setTimeout 동일):
  g.phase = 'timeout'
  audioManager.gameOver()
  setTimeout(() => cbRef.current(0), 5000)
```

---

## 6. 내 캐릭터 + 마이펫 배치 ✨ (신규)

### 6.1 위치

```
┌────────────────────────────────────┐
│ ⏱ 08:32  │  SCORE ---  │ ❌×2     │  HUD
├────────────────────────────────────┤
│  ┌──────────────────────────┐      │
│  │                          │      │
│  │    9 × 9  그리드          │      │
│  │                          │      │
│  └──────────────────────────┘      │
│                       [펫][캐릭터]  │  ← 그리드 아래 우측
├────────────────────────────────────┤
│  [1][2][3][4][5][6][7][8][9][✕]   │  숫자패드
└────────────────────────────────────┘
         ↑
    그리드와 숫자패드 사이 좁은 여백 (약 36px)
    캐릭터 sm(40px) + 펫 작게 배치
```

### 6.2 반응 애니메이션 (CSS 기존 재활용)

| 상황 | 캐릭터 반응 | 펫 반응 | SFX |
|------|-----------|---------|-----|
| 숫자 입력 (정답) | `characterBob` 1회 빠르게 | 펫 hop | `keyClick()` |
| 숫자 입력 (오답) | `characterSword` (흔들기) | 펫 숨기 (opacity 0.3) | `playerHit()` |
| 행/열/블록 완성 | scale 1.2 → 1.0 팡 | 펫 bounce 3회 | `coinCollect()` |
| 남은 시간 60초 | 빠른 `characterBob` loop | 펫 불안 흔들기 | (없음) |
| 퍼즐 완성 🎉 | 크게 점프 + 회전 CSS | 펫 신나게 bounce | `loginFanfare()` |
| 타임오버 💀 | `rotate(90deg)` 쓰러짐 | 펫 슬픔 (scale 0.8) | `gameOver()` |

### 6.3 구현 방법

```tsx
// CharacterSprite 재활용 (sm size, petAnimate)
<div className="flex items-end gap-1 absolute bottom-1 right-2">
  <CharacterSprite
    characterId={member.character.characterId}
    role={member.role}
    size="sm"
    petId={member.character.petId}
    petAnimate={true}
    weapon={null}
    style={{ animation: charAnim }}  // 상황별 교체
  />
</div>
```

---

## 7. 시각 피드백 시스템 (9살 어린이 친화)

### 7.1 그리드 셀 색상

| 상황 | 스타일 |
|------|--------|
| 선택된 셀 | `bg-gold/20 border-2 border-gold` |
| 같은 숫자 강조 | `bg-purple/15` |
| 오답 입력 | `text-rejected bg-rejected/20 animate-pulse` |
| 정답 입력 후 0.5초 | `text-approved` → `text-cream` |
| 행/열/블록 완성 플래시 | `bg-approved/30` 0.6초 |
| 게임오버 오답 셀 | `bg-rejected/50 animate-pulse` (5초 유지) |

### 7.2 배경 (내 땅 SVG 활용)

```
member.character.worldBanner → /assets/backgrounds/{id}.svg
+ 어두운 오버레이 bg-black/70 (숫자 가독성 확보)
+ 그리드 배경: bg-panel-darkest/90 (반투명)
```

### 7.3 완성 이펙트

```
EffectOverlay type='confetti' count=30  ← T1 트리거 재활용
→ 1초 후 "CLEAR!" 텍스트 팝업
→ 2초 후 점수 카운트업 애니메이션
→ 3초 후 자동 결과 화면 이동
```

---

## 8. 난이도 선택 화면 디자인

```
각 레벨 카드 (card-pixel):
  - 레벨 대표 캐릭터 SVG (48px)
  - 난이도 ⭐ 표시
  - 힌트 수 / 시간 / 최고점수

레벨별 대표 캐릭터:
  Lv1: base-child-1.svg     (친근한 아이)
  Lv2: child-warrior.svg    (초보 전사)
  Lv3: child-knight.svg     (기사)
  Lv4: child-dark-knight.svg (흑기사)
  Lv5: child-divine-warrior.svg (신계전사)
```

---

## 9. 데이터 모델

### 9.1 런타임 상태

```typescript
interface SudokuGS {
  board:       (number | null)[][]  // 9×9
  solution:    number[][]
  given:       boolean[][]          // 힌트 고정 칸
  errors:      boolean[][]          // 오답 여부
  selectedCell: [number, number] | null
  errorCount:  number
  timeLeft:    number               // 초
  phase: 'playing' | 'clear' | 'timeout'
  charAnim: string                  // 현재 캐릭터 CSS 애니메이션
}
```

### 9.2 localStorage 키

| 키 | 내용 |
|----|------|
| `fq_sudoku_lv5_clears` | Lv5 누적 클리어 횟수 |
| `fq_sudoku_best_lv[1-5]` | 레벨별 최고 점수 |

### 9.3 Firebase

```typescript
type GameId = '...' | 'sudoku'  // 기존 타입에 추가만
// saveGameScore({ gameId: 'sudoku', score, ... }) — 기존 함수 그대로
```

---

## 10. 퍼즐 생성 전략

```
Lv1-2: 프리셋 10개 배열 내장 (검증된 퍼즐)
Lv3-5: 백트래킹 런타임 생성 (다양성 보장)

generateSudoku(level):
  1. fillSolution()  — 완전한 해답 백트래킹 생성
  2. removeNumbers() — 난이도별 칸 제거
  3. 유일해 검증     — 단일 정답 보장
```

---

## 11. 검증 결과 (Validation Report)

| 요소 | 검증 | 근거 | 복잡도 |
|------|------|------|--------|
| **생명 2회 시스템** | ✅ | PonpokoGame `lives--` 패턴 동일, `lives===0 → phase='timeout'` 재활용 | 낮음 |
| **게임오버 플래시 5초** | ✅ | `setTimeout(5000)` + `animate-pulse` — PonpokoGame 패턴 동일 | 낮음 |
| **아빠 슈웅 (FIGHTING)** | ✅ | `@keyframes logoGloss` 이미 존재 (translateX 슈웅) → 새 keyframe 2개 추가 | 낮음 |
| **엄마 슈웅 (Congratulation)** | ✅ | `myRank === 1` 로직 ResultScreen에 기존 존재, 반대 방향 keyframe 추가 | 낮음 |
| **base-dad/mom SVG** | ✅ | `/assets/characters/` 파일 2개 모두 존재 확인 | 없음 |
| **캐릭터+펫 반응** | ✅ | `CharacterSprite sm` + 기존 CSS 애니메이션 6종 재활용 | 낮음 |
| **언도쿠 제목** | ✅ | GAME_META 문자열 변경만 | 없음 |
| **내 땅 SVG 배경** | ✅ | BANNER_SVG_SET 50종 + 기존 img 로드 패턴 | 없음 |
| **EffectOverlay 폭죽** | ✅ | 기존 T1 트리거 컴포넌트 재활용 | 없음 |
| **game_scores 랭킹** | ✅ | GameId 타입 1줄 추가 + `saveGameScore()` 그대로 호출 | 없음 |

**전체 신규 코드 예상**: SudokuGame.tsx ~380줄 + CSS keyframe 2개 추가 + GamePage 수정 10줄

---

## 12. 리스크

| 리스크 | 대응 |
|--------|------|
| 백트래킹 생성 UI 블로킹 | `setTimeout 0` 비동기 처리 또는 로딩 스피너 |
| 슈웅 타이밍 충돌 (시작+완성 겹침) | 상태 플래그로 동시 발동 방지 |
| 9살이 Lv3+ 어려워서 흥미 잃음 | Lv1-2 프리셋으로 쉬운 첫 경험 보장, 캐릭터 격려 메시지 |

---

## 13. 성공 기준

| 기준 | 확인 방법 |
|------|---------|
| 5단계 모두 플레이 가능 | 직접 플레이 |
| 아빠 슈웅 게임 시작 시 1회 등장 | 눈으로 확인 |
| 엄마 슈웅 1위 달성 시 등장 | 랭킹 1위 상태에서 확인 |
| 타임오버 → 오답 플래시 5초 | 타이머 소진 후 확인 |
| 캐릭터 반응 3종 (정답/오답/완성) | 각 입력 후 확인 |
| game_scores Firebase 저장 | Firestore 콘솔 |
| tsc --noEmit 에러 0 | 빌드 확인 |
| Lv5 클리어마다 1분 감소 | localStorage 확인 |

---

## 14. 구현 범위 (Do Phase)

```
신규 파일 1개:
  src/presentation/pages/game/SudokuGame.tsx  (~380줄)

수정 파일 2개:
  src/presentation/pages/game/GamePage.tsx    (GameId + GAME_META + ResultScreen 슈웅)
  src/infrastructure/firebase/collections/gameScores.ts (GameId 타입)

CSS 추가 (pixel-theme.css):
  @keyframes swoosh-lr   (아빠 슈웅)
  @keyframes swoosh-rl   (엄마 슈웅)

에셋 추가 없음 — 기존 SVG 100% 재활용
예상: 1세션 완성
```
