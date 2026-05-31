# Family Quest — 디자인 전면 개편 기획서 v2.1

> 작성일: 2026-05-30 (Session 15-16)  
> 버전: v1.4.0 배포 완료 → 다음 단계: Plan A 구현  
> 상태: **폰트 시스템 완료 → Plan A 레이아웃 작업 승인 대기**

---

## 0. 이번 세션 완료 사항 (v1.4.0)

| 항목 | 내용 |
|------|------|
| 폰트 전역 상향 | tailwind.config `xs`→13px, `sm`→15px / body 16px 기준으로 변경 |
| 극소 폰트 제거 | `text-[7px]`→10px, `text-[8px]`→10px, `text-[9px]`→xs, `text-[10px]`→xs (101개 대상) |
| 회색 저채도 제거 | `text-stone/40~70` → `text-stone` 전부 가시성 개선 |
| 로그인 심플화 | 신규 기기 자동 가족 탐지 (kye loginId 기준) |
| 마스터 패널 | SETTING → kye / 1111 |
| 특별 퀘스트 카드 | `bg-gold/5` 투명 문제 → `#D4A843` 황금탄 고정 |
| 메신저 | 읽음 숫자 감소, 메시지 삭제, UI 텍스트 흰색/확대 |

---

## 1. 폰트 정책 확정 (v1.4.0 적용 완료)

### 1-1. 타이포그래피 위계 (9살 아이 기준)

```
레이어        클래스            실제 크기    용도
────────────────────────────────────────────────────────
페이지 제목   .t-title          22px bold   홈 인사, 섹션 대제목
섹션 헤더     .t-heading        19px bold   "최근 활동", 탭 이름
카드 본문     text-base         16px        미션 제목, 이름
보조 텍스트   text-sm           15px        카테고리, 설명
라벨·태그     text-xs           13px        날짜, 상태 뱃지
픽셀 배지     font-pixel 10px   10px        Lv, EXP 숫자 전용
픽셀 장식     font-pixel 8px    10px        버전, 로그인 링크
```

### 1-2. 색상 가독성 규칙

```
배경이 밝을 때(cream/white):
  주 텍스트 → text-pixel-dark (#1A1A1A)
  보조 텍스트 → text-stone (#9E9E9E)  ← /60, /70 사용 금지
  비활성 → text-stone (불투명)

배경이 어두울 때(grass/pixel-dark):
  주 텍스트 → text-cream (#FFF8F0) 또는 text-white
  보조 텍스트 → text-cream/90 또는 text-white/70
  비활성 → text-cream/80 이상
```

---

## 2. 현재 문제 진단 (남은 작업)

### 2-1. 레이아웃·컴포넌트 불일치 (Plan A 대상)

| 문제 | 현상 | 우선순위 |
|------|------|---------|
| 배경 `bg-grass` 단조로움 | 풀초록 단색 배경, 생동감 없음 | 높음 |
| 카드 `bg-cream` 평범함 | 모든 카드가 동일한 크림색 → 게임 느낌 없음 | 높음 |
| 헤더/네비 일관성 부재 | 페이지마다 다른 헤더 스타일 | 높음 |
| `PixelButton` 미사용 | 절반의 페이지가 raw `<button>` 직접 사용 | 중간 |
| 팝업 패턴 3종 혼재 | 각자 다른 z-index, 다른 dimming 색상 | 중간 |

### 2-2. 코드 중복·품질 문제 (정리 대상)

| 문제 | 파일/위치 | 해결안 |
|------|-----------|-------|
| `getMemberName()` 3곳 중복 | HomePage, MessagesPage, NotificationsPage | 공통 헬퍼 함수로 이동 |
| `formatRewards()` MissionCard에만 | MissionDetailPage도 자체 구현 | `domain/entities/Mission.ts`로 이동 |
| `STATUS_INFO/LABEL` 5곳 중복 | 5개 파일 각자 다른 형태로 정의 | `Mission.ts` 단일 소스 |
| `getMemberInfo()` localStorage 직접 읽기 | MessagesPage, 기타 | 규칙 위반 (캐시 직접 읽기) → `subscribeMembers` 사용 |
| 미사용 import TS6133 경고 30+ 개 | 전 파일 | 일괄 정리 |
| `useMembers()` 훅 없음 | 각 페이지에서 `subscribeMembers` 중복 구독 | 공통 훅 신설 |

---

## 3. Plan A "다크 마인크래프트 인벤토리" — 구체화된 기획

### 3-1. 핵심 디자인 언어

```
"마인크래프트 인벤토리 창을 열면 보이는 느낌"

✦ 어두운 돌/나무 재질 패널 → 아이템 슬롯 느낌
✦ 금색 테두리·텍스트 → 특별함·보상 강조  
✦ 퍼플·핑크 포인트 유지 → 여아 감성
✦ 이모지·픽셀 폰트 → 게임 분위기
✦ 굵은 한글 텍스트 → 아이 가독성
```

### 3-2. 새 컬러 팔레트

| 역할 | 토큰 | hex | 현재 |
|------|------|-----|------|
| **앱 배경** | `bg-panel-bg` | `#1A1208` | bg-grass #5C8A1E |
| **카드/패널** | `bg-panel` | `#2A1F0E` | bg-cream #FFF8F0 |
| **카드 테두리** | `border-panel` | `#6B4E2A` | border-dirt #8B5E3C |
| **기본 텍스트** | `text-cream` | `#FFF8F0` | text-pixel-dark |
| **보조 텍스트** | `text-panel-sub` | `#C4A06A` | text-stone |
| **골드 강조** | `text-gold` | `#FFD700` | 유지 |
| **퍼플 포인트** | `bg-purple` | `#7B5EA7` | 유지 |
| **핑크 포인트** | `bg-pink` | `#E8A0BF` | 유지 |
| **승인 초록** | `bg-approved` | `#43A047` | 유지 |
| **거절 빨강** | `bg-rejected` | `#E53935` | 유지 |
| **네비 배경** | `bg-nav` | `#0F0A04` | (없음) |
| **구분선** | `border-gold/30` | gold 30% | border-dirt |

### 3-3. 버튼 3종 통일

```
Primary  : bg-gold text-pixel-dark border-yellow-700      ← 저장, 완료, 입장
Secondary: bg-purple text-white border-purple/80           ← 수정, 선택, 전송  
Ghost    : bg-transparent border-[#6B4E2A] text-cream      ← 취소, 뒤로, 닫기
Danger   : bg-rejected text-white border-red-900           ← 삭제, 경고
```

모든 버튼: `border-4` + `active:translate-y-0.5` + `font-korean text-base font-bold`

### 3-4. 카드 스타일

```
일반 카드: bg-[#2A1F0E] border-4 border-[#6B4E2A] shadow-pixel-dark
           내부 텍스트: text-cream (제목), text-panel-sub (보조)

특별 카드: bg-[#D4A843] border-4 border-gold (이미 적용)

강조 카드(홈 섹션): bg-[#1E160A] border-2 border-gold/40
```

### 3-5. 네비게이션 바

```
현재: bg-cream (밝은 배경) — 게임 느낌 없음
변경: bg-[#0F0A04] 최다크 + border-top gold/30 1px
     아이콘: text-cream/60 기본 / 선택: text-gold + border-b-2 border-gold
     배지: bg-rejected, font-pixel 10px
```

### 3-6. 헤더 (AppLayout)

```
현재: bg-dirt 브라운 + 픽셀 폰트 타이틀
변경: bg-[#0F0A04] 최다크 + text-gold 타이틀 (F4MILY QU3ST 스타일 유지)
     오른쪽 알림/설정: text-cream
     하단: border-b-2 border-gold/30
```

### 3-7. 생동감 요소 (9살 아이 타겟)

```
- 미션 카드: 난이도별 이모지 아이콘 크게 (현재 text-sm → text-xl)
- 보상 태그: 금색 뱃지에 이모지 강조
- 홈 캐릭터: 더 크게, 레벨 배지 gold 강조
- 탭 선택: gold underline + bg-[#3D2800] 강조
- 버튼 hover: border-gold 전환
- 상태 배지: 색상 더 진하게, 크기 text-xs → text-sm
```

---

## 4. 구현 로드맵

### Phase 1 — 기반 토큰 추가 (tailwind.config + globals.css)
```
소요: 30분 추정
작업:
  - panel-bg, panel, panel-sub 토큰 추가 (tailwind.config colors)
  - .card-pixel 다크 패널로 전환
  - body bg-grass → bg-[#1A1208]
```

### Phase 2 — 레이아웃 공통
```
소요: 1시간 추정
파일:
  - AppLayout.tsx  — 헤더 + 네비 다크화
  - PixelCard.tsx  — 다크 패널 기본값
  - PixelButton.tsx — 4 variant 정리
```

### Phase 3 — 페이지 (중요도 순)
```
1순위: HomePage, MissionListPage, MissionDetailPage
2순위: MessagesPage, CalendarPage, RewardStatusPage  
3순위: SettingsPage 군, ProfilePage, BeggingPage 군
```

### Phase 4 — 코드 정리 (병행)
```
- 미사용 import 제거 (TS6133 30+개)
- getMemberName() 공통 헬퍼화
- STATUS_INFO 단일 소스 (Mission.ts)
- ConfirmModal 공통 컴포넌트
```

---

## 5. Before / After 시각 요약

```
BEFORE (현재 v1.4.0):           AFTER (Plan A 목표):
─────────────────────            ─────────────────────
배경: 풀초록(grass) 단색          배경: 어두운 나무색(#1A1208)
카드: 크림 흰색 네모               카드: 다크 패널 + 골드 테두리
텍스트: 어두운 글자               텍스트: 밝은 크림/골드
버튼: 제각각 스타일               버튼: gold/purple/ghost 3종
네비: 밝은 크림 배경              네비: 최다크 + 골드 아이콘
글씨: 14px 중심(읽기 힘듦)        글씨: 16px 중심(9살 가독성 ✓)
                                  생동감: 이모지 확대, 색상 진하게
```

---

*Family Quest Design Overhaul v2.1 — 2026-05-30 Session 16*  
*다음 세션: Phase 1 (기반 토큰) → Phase 2 (레이아웃) 순서로 진행*
