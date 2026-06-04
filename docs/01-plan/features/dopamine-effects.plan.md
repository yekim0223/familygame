# 도파민 폭발 동적 반응 시스템 Planning Document

> **Summary**: 퀘스트·칭찬·게임·메신저 핵심 행동 순간마다 즉각적·화려한 시각/청각 피드백으로 가족 몰입도를 폭발시킨다
>
> **Project**: Family Quest (패밀리 퀘스트)
> **Version**: 3.0.0
> **Author**: youngeon
> **Date**: 2026-06-02
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 퀘스트 확인·칭찬 발송·게임 1등 등 핵심 도파민 순간에 시각/청각 피드백이 미흡해 행동 강화가 약하다. 아이들이 "내가 뭔가 해냈다"는 느낌을 충분히 받지 못하고 있다. |
| **Solution** | 7가지 핵심 순간(퀘스트 확인·GOOD 평가·칭찬 수신·게임 신기록·게임 1등 탈환·보상 수령·메신저 특수이모지)에 CSS 키프레임·Canvas 파티클·오디오 SFX를 결합한 즉각 피드백 레이어를 주입한다. |
| **Function/UX Effect** | 아이는 버튼을 누른 순간 폭죽·별·하트가 터지고, 부모는 GOOD 평가 시 골드 샤워를 보며 서로의 행동이 "의미 있다"는 감각을 강화한다. 메신저에서 🎉 전송 시 전체화면 폭죽 이펙트로 채팅 자체가 놀이가 된다. |
| **Core Value** | 행동 → 즉각 보상의 피드백 루프를 강화해 가족 참여율과 앱 재방문율을 높인다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 핵심 행동 순간의 피드백 공백 → 동기 저하 → 가족 참여율 감소 |
| **WHO** | 주요: 하윤·서윤(9세, 시각 자극에 민감한 아이들) / 보조: 엄마·아빠(발송/평가자로서 즉각 반응 확인 욕구) |
| **RISK** | 이펙트 남발로 UX 노이즈 발생, 성능 저하(저사양 모바일), 애니메이션 중복 충돌 |
| **SUCCESS** | 7개 핵심 트리거 모두 이펙트 연결, 기존 `.animate-coin-drop` / `.animate-gold-particle` 패턴 재사용, tsc 에러 0 |
| **SCOPE** | Phase 1(퀘스트·미션), Phase 2(칭찬·보상), Phase 3(게임), Phase 4(메신저) |

---

## 1. Overview

### 1.1 Purpose

사용자가 앱에서 의미 있는 행동을 할 때 "내가 해냈다"는 즉각적인 감각을 주는 시각·청각 피드백 레이어를 구축한다.  
현재 앱에는 일부 이펙트(coin-drop, gold-particle, levelUpFlash)가 존재하지만 **커버리지가 단편적**이고, 가장 중요한 순간들(아이의 퀘스트 확인, 부모의 GOOD 평가, 게임 1등)에 충분한 연출이 없다.

### 1.2 Background

- Session 39에서 `animate-coin-drop`(보상 발송), `animate-gold-particle`(GOOD 슬롯)이 추가됐으나 범위가 제한적
- Session 37에서 레벨업 `levelUpFlash`가 추가됐으나 1.5초 단순 플래시
- 메신저 리액션 이모지(Session 26)는 있지만 화면 이펙트가 없음
- 게임 ResultScreen(Session 28)은 정적인 랭킹 표시만 있음
- 지뢰찾기 Boom(Session 28)처럼 **전체화면을 활용한 연출**이 게임 외부에는 없음

### 1.3 관련 파일 (현재 이펙트 현황)

| 파일 | 현재 이펙트 | 보완 필요 |
|------|------------|---------|
| `pixel-theme.css` | coin-drop, gold-particle, levelUpFlash, beg-bounce | 폭죽·별 샤워·하트 버스트 키프레임 추가 |
| `MissionDetailPage.tsx` | gold-particle (GOOD 슬롯) | 아이 확인 버튼 폭죽, GOOD 평가 별 샤워 강화 |
| `SettingsPage.tsx` + `RewardSendPage.tsx` | coin-drop | 칭찬 스티커 발송 하트 이펙트 |
| `MessagesPage.tsx` | 리액션 이모지 카운트 | 특수 이모지 전체화면 이펙트 |
| `GamePage.tsx` + `GalagaGame.tsx` etc | 게임오버 overlay | 1등/신기록 폭죽 레이어 |
| `AppLayout.tsx` | levelUpFlash (1.5s) | 레벨업 별 샤워 + 토스트 강화 |

---

## 2. Scope

### 2.1 In Scope — 7가지 핵심 도파민 트리거

| # | 트리거 | 발생 위치 | 기대 이펙트 |
|---|--------|---------|-----------|
| T1 | **아이 퀘스트 확인** 버튼 클릭 | `MissionDetailPage` | 전체화면 폭죽 버스트 (3색) + SFX missionConfirm |
| T2 | **부모 GOOD 슬롯** 평가 | `MissionDetailPage` | 별 샤워 파티클 (현재 gold-particle 강화) + 슬롯 행 골드 플래시 |
| T3 | **칭찬 스티커 수신** | `HomePage` (CheerOverlay 대체) | 하트·별 버스트 전체화면 오버레이 + 사운드 |
| T4 | **게임 개인 신기록** 달성 | `GamePage` ResultScreen | 골드 폭죽 + "NEW RECORD" 픽셀 배너 스윕 |
| T5 | **게임 가족 1등 탈환** | `GamePage` ResultScreen | 무지개 폭죽 + 왕관 배지 낙하 |
| T6 | **보상 수령** (아이 화면) | `HomePage` 피드 or 알림 클릭 | 코인+별 복합 이펙트 (현재 coin-drop 확장) |
| T7 | **메신저 특수 이모지** 전송/수신 | `MessagesPage` | 🎉→폭죽, ❤️→하트, ⭐→별, 🔥→불꽃 전체화면 1.5s |

### 2.2 Out of Scope

- FCM 푸시 알림 이펙트 (서버 의존)
- Canvas WebGL 기반 파티클 (성능 리스크)
- 이펙트 설정 ON/OFF 토글 (추후 설정에서)
- 기존 게임(갤라그·너구리·지뢰찾기) 내부 이펙트 변경 (기존 유지)

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-01: 공통 이펙트 컴포넌트 (`EffectOverlay`)
- `fixed inset-0 z-[9990] pointer-events-none` — PixelModal(z-9999) 아래, 일반 UI 위
- 파티클 타입: `confetti` | `hearts` | `stars` | `coins` | `fire`
- 지속 시간: 1.2~2.0s (타입별 상이)
- 30개 이하 파티클 (성능 제한)
- `autoDestroy: true` — 애니메이션 종료 후 자동 언마운트

#### FR-02: CSS 키프레임 추가 (`pixel-theme.css`)
- `@keyframes confettiBurst` — 중앙에서 방사형 30개 파티클
- `@keyframes heartFloat` — 아래→위 하트 부유
- `@keyframes starShower` — 위→아래 대각선 별 낙하
- `@keyframes fireBurst` — 빠른 위 방향 불꽃
- `.animate-confetti-piece` / `.animate-heart-float` / `.animate-star-shower` 클래스

#### FR-03: T1 — 아이 퀘스트 확인 이펙트
- `handleConfirm` 성공 후 `EffectOverlay type="confetti"` 1.8s 트리거
- `audioManager.missionConfirm()` 기존 SFX 활용
- 버튼 텍스트 일시 변경: "확인했어요!" → "✅ 완료!"(0.8s) → 원복

#### FR-04: T2 — GOOD 슬롯 별 샤워 강화
- 기존 gold-particle 3개 → 별 8개 (`⭐`) 방사형으로 확장
- 슬롯 행에 `bg-approved/30` 골드 플래시 0.5s 추가
- `audioManager.slotApproval()` 기존 SFX 활용

#### FR-05: T3 — 칭찬 스티커 수신 하트 버스트
- `PraiseWhiteboard` 신규 스티커 수신 시 `EffectOverlay type="hearts"` 1.5s
- 스티커별 컬러 매핑: star/crown→gold, rainbow/sparkle→purple, fire→red
- 기존 CheerOverlay와 병렬 실행 가능 (z-index 분리)

#### FR-06: T4+T5 — 게임 신기록·1등 이펙트
- `GamePage` `handleGameOver` 내 판정 후 이펙트 주입
- 개인 신기록: `EffectOverlay type="stars"` + "NEW RECORD!" 픽셀 텍스트 배너
- 가족 1등 탈환: `EffectOverlay type="confetti"` 무지개 컬러 + 왕관🏆 낙하 파티클

#### FR-07: T6 — 보상 수령 이펙트 (아이 홈)
- 홈 피드에 `REWARD_RECEIVED` 알림 클릭 시 `EffectOverlay type="coins"` 0.8s
- 기존 coin-drop과 통합 (동일 키프레임, 위치만 전체화면으로 확장)

#### FR-08: T7 — 메신저 특수 이모지 이펙트
- 메시지 전송/수신 시 content에 특수 이모지 포함 여부 감지
  - 🎉 🎊 → `confetti`
  - ❤️ 💖 💕 → `hearts`  
  - ⭐ 🌟 ✨ → `stars`
  - 🔥 → `fire`
- 전송자·수신자 **양쪽** 화면에 이펙트 (Firestore 메시지 구독 트리거)
- 최근 메시지에만 적용 (3초 이내 수신된 메시지)
- 같은 메시지 이펙트 중복 방지 (`triggeredMessageIds` Set)

### 3.2 Non-Functional Requirements

- **성능**: 파티클 30개 이하, `will-change: transform` 사용, RAF 없이 CSS animation만
- **모바일**: `prefers-reduced-motion` media query 존재 시 이펙트 스킵
- **충돌 방지**: PixelModal 표시 중에는 이펙트 억제 (z-index 9990 < 9999)
- **TS 에러**: `tsc --noEmit` 에러 0개 유지

---

## 4. Architecture Overview

### 4.1 공통 컴포넌트 구조

```
src/presentation/components/effects/
  EffectOverlay.tsx      ← 메인 오버레이 컴포넌트
  useEffectTrigger.ts    ← 전역 이펙트 트리거 훅
  
src/styles/pixel-theme.css  ← 키프레임 추가 (기존 파일)
```

### 4.2 EffectOverlay 설계

```typescript
type EffectType = 'confetti' | 'hearts' | 'stars' | 'coins' | 'fire'

interface EffectOverlayProps {
  type: EffectType
  duration?: number        // ms (기본: 1500)
  count?: number           // 파티클 수 (기본: 24, 최대: 30)
  onEnd?: () => void
}

// 파티클: CSS custom property로 랜덤 위치/딜레이 주입
// style={{ '--px': `${randomX}px`, '--delay': `${randomDelay}s` } as CSSProperties}
```

### 4.3 useEffectTrigger — 전역 트리거 훅

```typescript
// AppLayout 또는 개별 페이지에서 사용
const { triggerEffect } = useEffectTrigger()

triggerEffect('confetti')  // 어디서나 호출 가능
triggerEffect('hearts', { duration: 2000 })
```

### 4.4 메신저 이펙트 감지 흐름

```
MessagesPage onSnapshot 수신
  → getNewMessages(since 3s)
  → detectSpecialEmoji(content)
  → triggerEffect(type) if not in triggeredSet
  → triggeredSet.add(messageId)
```

---

## 5. Implementation Plan

### Phase 1 — 공통 인프라 + 퀘스트 (T1·T2)
1. `pixel-theme.css` — 4종 키프레임 추가
2. `EffectOverlay.tsx` 컴포넌트 생성
3. `MissionDetailPage.tsx` — T1(확인 버튼), T2(GOOD 슬롯) 연결

### Phase 2 — 칭찬·보상 (T3·T6)
4. `HomePage.tsx` / `PraiseWhiteboard.tsx` — T3(칭찬 수신) 연결
5. `HomePage.tsx` 알림 클릭 — T6(보상 수령) 연결

### Phase 3 — 게임 (T4·T5)
6. `GamePage.tsx` — T4(신기록), T5(1등 탈환) 연결

### Phase 4 — 메신저 (T7)
7. `MessagesPage.tsx` — T7(특수 이모지) 감지 + 이펙트 연결

---

## 6. Success Criteria

- [ ] **SC-01**: 7개 트리거 모두 이펙트 발동 (기능 테스트)
- [ ] **SC-02**: 파티클 최대 30개, 60fps 유지 (Chrome DevTools 확인)
- [ ] **SC-03**: 기존 `.animate-coin-drop` / `.animate-gold-particle` 정상 동작 유지
- [ ] **SC-04**: PixelModal 열린 상태에서 이펙트 미표시 (z-index 검증)
- [ ] **SC-05**: `tsc --noEmit` 에러 0개
- [ ] **SC-06**: 메신저 동일 메시지 이펙트 중복 발동 없음

---

## 7. Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| 저사양 모바일 성능 저하 | 중간 | 중간 | 파티클 30개 상한, CSS only (no Canvas) |
| 이펙트 중복 충돌 (여러 트리거 동시) | 낮음 | 낮음 | 큐 방식 또는 마지막 이펙트 우선 |
| 메신저 이펙트 모든 메시지 재발동 | 높음 | 높음 | triggeredMessageIds Set으로 방지 |
| 기존 CheerOverlay와 z-index 충돌 | 낮음 | 중간 | EffectOverlay z-9990, CheerOverlay z-9995 분리 |

---

## 8. Timeline

| Phase | 내용 | 예상 시간 |
|-------|------|---------|
| Phase 1 | CSS + EffectOverlay + 퀘스트 이펙트 | 1~1.5h |
| Phase 2 | 칭찬·보상 이펙트 | 0.5h |
| Phase 3 | 게임 이펙트 | 0.5h |
| Phase 4 | 메신저 특수이모지 이펙트 | 0.5h |
| **Total** | | **2.5~3h** |
