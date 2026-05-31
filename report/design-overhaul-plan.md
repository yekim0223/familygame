# Family Quest — 디자인 전면 재개편 기획서 v3.0

> 최초 작성: 2026-05-30 | **마지막 업데이트: 2026-05-31 (v2.2.0 배포 완료)**  
> 이전 기획: docs/design-overhaul-v2.md (Plan A v2.1) → 이 문서로 통합·확장  
> 목표: **프로 게임 기획자 수준의 통일된 디자인 시스템 구축**  
> **현재 상태: Phase 1~4 전체 완료 ✅ — 총 15개 페이지 다크 MC 테마 적용 완료**

---

## 0. 개편 철학 (Why)

### 현재 문제의 본질

지금까지 기능 단위로 건별 개발하면서 발생한 구조적 문제들:

| 문제 범주 | 구체적 증상 |
|-----------|-------------|
| **디자인 파편화** | 페이지마다 버튼 스타일, 카드 스타일, 색상이 제각각 |
| **코드 중복** | `getMemberName()` 3곳, `STATUS_INFO` 5곳, 팝업 패턴 3종 혼재 |
| **가독성 부족** | `text-stone/40` 같은 저채도 텍스트, 소형 폰트 잔재 |
| **컴포넌트 미활용** | `PixelButton` 대신 raw `<button>` 직접 사용 다수 |
| **이모지 혼선** | 동일 기능인데 페이지마다 다른 이모지 사용 |
| **배경 단조로움** | 풀초록(grass) 단색이라 게임 느낌 없음 |

### 재개편 원칙

```
1. 깔끔하게 다시 세운다  — 기존 코드에 덧칠하지 않고 토큰부터 재정립
2. 하나의 소스          — 컬러/폰트/아이콘/상태는 단일 파일에서 관리
3. 최소한의 컴포넌트    — PixelButton, PixelCard, PixelModal 3가지로 통일
4. 9살 아이 기준        — 모든 텍스트 최소 13px, 터치 영역 최소 44px
5. 가볍게              — 불필요한 중복 제거, 미사용 코드 전면 정리
```

---

## 1. 디자인 언어 (Design Language)

### 1-1. 컨셉: "다크 마인크래프트 인벤토리"

```
마인크래프트 인벤토리 창을 열었을 때의 느낌:
  ✦ 어두운 나무/돌 패널 → 아이템 슬롯 텍스처
  ✦ 금색 테두리·강조 → 보상·특별함
  ✦ 퍼플·핑크 포인트 → 여아 감성 유지
  ✦ 굵은 픽셀 폰트 → 게임 타이틀
  ✦ 굵은 한글 고딕 → 아이 가독성 최우선
```

### 1-2. 색상 팔레트 (Design Token 전체)

#### 배경 계층

| 토큰 | hex | 용도 |
|------|-----|------|
| `panel-darkest` | `#0F0A04` | 네비·헤더 배경, 최하단 레이어 |
| `panel-dark` | `#1A1208` | 앱 전체 배경 (`bg-minecraft` 교체) |
| `panel-mid` | `#2A1F0E` | 카드·패널 배경 |
| `panel-surface` | `#3D2800` | 탭 선택, 호버 배경 |
| `panel-border` | `#6B4E2A` | 카드 테두리, 구분선 |

#### 텍스트 계층

| 토큰 | hex | 용도 |
|------|-----|------|
| `cream` | `#FFF8F0` | 주 텍스트 (다크 배경) |
| `panel-sub` | `#C4A06A` | 보조 텍스트, 날짜, 상태 |
| `gold` | `#FFD700` | 강조, 이름, 레벨, 헤더 |
| `pixel-dark` | `#1A1A1A` | 밝은 배경 위 주 텍스트 |

#### 상태 색상 (유지)

| 토큰 | hex | 용도 |
|------|-----|------|
| `approved` | `#43A047` | GOOD, 성공, 승인 |
| `rejected` | `#E53935` | BAD, 실패, 거절, 위험 |
| `hold` | `#FB8C00` | HOLD, 대기, 경고 |
| `purple` | `#7B5EA7` | 포인트, 세컨더리 버튼 |
| `pink` | `#E8A0BF` | 여아 포인트, 장식 |
| `sky` | `#4FC3F7` | 정보, 링크 |

#### tailwind.config.js 추가 토큰

```javascript
colors: {
  // 기존 유지
  grass: '#5C8A1E', dirt: '#8B5E3C', stone: '#9E9E9E',
  gold: '#FFD700', sky: '#4FC3F7', purple: '#7B5EA7',
  pink: '#E8A0BF', cream: '#FFF8F0', approved: '#43A047',
  rejected: '#E53935', hold: '#FB8C00', 'pixel-dark': '#1A1A1A',
  // 신규 추가
  'panel-darkest': '#0F0A04',
  'panel-dark':    '#1A1208',
  'panel-mid':     '#2A1F0E',
  'panel-surface': '#3D2800',
  'panel-border':  '#6B4E2A',
  'panel-sub':     '#C4A06A',
}
```

---

## 2. 타이포그래피 시스템 (Typography System)

### 2-1. 폰트 위계 (확정 — 이 문서 기준 최종)

```
레이어           클래스          px     용도
──────────────────────────────────────────────────────
페이지 대제목    .t-title         22px   홈 인사, 미션 타이틀
섹션 헤더       .t-heading        19px   "최근 활동", 탭 이름
카드 본문       text-base (16px)  16px   미션 제목, 이름, 주요 내용
보조 텍스트     text-sm  (15px)   15px   설명, 날짜, 라벨
태그·배지       text-xs  (13px)   13px   상태 뱃지, 날짜 (최소값)
픽셀 배지       font-pixel 10px   10px   Lv, EXP 숫자 (font-pixel 전용)
픽셀 장식       font-pixel 8px    8px    버전, 영문 로고 링크
```

### 2-2. 폰트 사용 규칙

```typescript
// 올바른 사용
<p className="font-korean text-base text-cream">미션 제목</p>
<p className="font-korean text-sm text-panel-sub">2025-05-30</p>
<span className="font-pixel text-[10px] text-gold">Lv.5</span>

// 금지
// text-[7px], text-[8px], text-[9px] → 모두 text-xs 이상 사용
// text-stone/40~70 → text-stone 또는 text-panel-sub 사용
// text-cream/40~70 → text-cream/80 이상 사용
// font-pixel로 한글 출력 → 반드시 font-korean 사용
```

### 2-3. globals.css 유틸리티 클래스

```css
.t-title   { font-family: var(--font-korean); font-size: 22px; font-weight: 700; }
.t-heading { font-family: var(--font-korean); font-size: 19px; font-weight: 700; }
```

---

## 3. 컴포넌트 시스템 (Component System)

### 3-1. PixelButton — 완전 정의

모든 버튼은 `PixelButton`을 사용한다. raw `<button>` 직접 사용 금지.

#### Variant 정의

| Variant | 색상 | 용도 | 예시 |
|---------|------|------|------|
| `gold` (Primary) | `bg-gold text-pixel-dark border-yellow-700` | 저장, 완료, 입장, 제출 | 미션 완료, 로그인 |
| `purple` (Secondary) | `bg-purple text-white border-purple/80` | 수정, 선택, 전송 | 미션 생성, 편집 |
| `ghost` | `bg-transparent border-panel-border text-cream` | 취소, 뒤로, 닫기 | 팝업 취소 |
| `danger` | `bg-rejected text-white border-red-900` | 삭제, 강제 종료 | 미션 삭제 |
| `success` | `bg-approved text-white border-green-900` | 승인, 완료 | 조르기 승인 |
| `sky` | `bg-sky text-pixel-dark border-blue-500` | 정보, 링크 | |

#### Size 정의

| Size | padding | 한글 폰트 | 픽셀 폰트 | 터치 높이 |
|------|---------|-----------|-----------|-----------|
| `sm` | px-3 py-1.5 | text-xs | text-[8px] | ~32px |
| `md` | px-4 py-2.5 | text-sm | text-xs | ~40px |
| `lg` | px-6 py-3 | text-base | text-xs | ~48px |

#### 공통 스타일

```
border-4 + active:translate-y-0.5 + transition-all
disabled: opacity-50 cursor-not-allowed
```

### 3-2. PixelCard — 완전 정의

#### Variant 정의

| Variant | 배경 | 테두리 | 용도 |
|---------|------|--------|------|
| `dark` (default) | `bg-panel-mid` | `border-panel-border border-4` | 일반 카드 |
| `special` | `bg-[#D4A843]` | `border-gold border-4` | 특별 퀘스트 |
| `highlight` | `bg-panel-surface` | `border-gold/40 border-2` | 홈 섹션 강조 |
| `light` | `bg-cream` | `border-pixel-dark border-4` | 밝은 배경 필요 시 |

#### Padding 정의

| Padding | 값 |
|---------|-----|
| `none` | p-0 |
| `sm` | p-3 |
| `md` | p-4 (default) |
| `lg` | p-5 |

### 3-3. PixelModal — 신규 공통 컴포넌트

현재 팝업 패턴 3종(각자 z-index, dimming 색상 다름) → 하나로 통일.

```typescript
// 위치: src/presentation/components/pixel/PixelModal.tsx
interface PixelModalProps {
  open: boolean
  onClose?: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

// 고정 스타일:
// - fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6
// - 내부: bg-panel-mid border-4 border-panel-border shadow-pixel-dark
// - 타이틀: font-pixel text-gold (장식) + font-korean text-heading (내용)
```

### 3-4. StatusBadge — 상태 배지 단일 소스

현재 상태 표시 코드 5곳 중복 → `StatusBadge.tsx` + `Mission.ts` 단일 소스.

```typescript
// src/presentation/components/missions/StatusBadge.tsx
// src/domain/entities/Mission.ts STATUS_INFO 단일 정의 후 임포트
```

### 3-5. 아이콘 이모지 통일 가이드

동일 기능에 항상 동일한 이모지 사용. 이 표가 단일 소스.

| 기능 | 이모지 | 사용 위치 |
|------|--------|-----------|
| 미션/퀘스트 | ⚔️ | 하단탭, 미션 관련 모든 곳 |
| 홈/대시보드 | ⛏️ | 하단탭 |
| 달력/일정 | 📅 | 하단탭 |
| 메시지 | 💌 | 하단탭 |
| 보상/트로피 | 🏆 | 하단탭, 보상 관련 |
| 알림 | 🔔 | 헤더, 알림 페이지 |
| 설정 | ⚙️ | 헤더 |
| 뒤로가기 | ⬅️ | 헤더 뒤로가기 버튼 |
| 프로필/멤버 | 👤 | 설정 메뉴 |
| 삭제 | 🗑️ | 삭제 버튼 |
| 수정/편집 | ✏️ | 수정 버튼 |
| 완료/확인 | ✅ | 완료 상태 |
| 거절/실패 | ❌ | 실패/거절 상태 |
| 대기/홀드 | ⏳ | HOLD 상태 |
| 별/특별 | ✨ | 특별 퀘스트 |
| 조르기 | 🙏 | 조르기 페이지 |
| 경험치 | ⭐ | EXP, 레벨업 |
| 로그아웃 | 🚪 | 로그아웃 버튼 |
| 아빠 | 👑 | DAD 역할 |
| 엄마 | 💜 | MOM 역할 |
| 아이 | 🌟 | CHILD 역할 |

---

## 4. 레이아웃 시스템

### 4-1. 앱 구조 (변경)

```
┌─────────────────────────────────┐
│ Header (52px) — bg-panel-darkest │  ← 최다크 + gold 로고
├─────────────────────────────────┤
│                                 │
│  Main Content                   │  ← bg-panel-dark 앱 배경
│  (pt-[52px] pb-[60px])         │
│                                 │
├─────────────────────────────────┤
│ BottomNav (60px) — bg-panel-    │  ← 최다크 + gold 아이콘
│ darkest                         │
└─────────────────────────────────┘
```

### 4-2. Header (변경 내용)

```
현재: bg-mc-brick (벽돌 텍스처 이미지)
변경: bg-panel-darkest (#0F0A04) + border-b-[3px] border-gold/30

로고: font-pixel text-gold — 유지 (LOGO_VARIANTS 유지)
뒤로가기: ⬅️ 아이콘 — 유지
알림: 🔔 + 빨간 콩 — 유지
설정 드롭다운: bg-panel-mid border-4 border-panel-border 로 다크화
```

### 4-3. BottomNav (변경 내용)

```
현재: bg-mc-brick
변경: bg-panel-darkest + border-t-[3px] border-gold/30

탭 아이콘:
  비활성: opacity-0.6 (유지)
  활성:   gold glow + 아이콘 크기 30px (유지)
  활성 인디케이터: border-t-2 border-gold 추가 (상단 gold 라인)
```

### 4-4. 페이지 기본 구조 (모든 페이지 통일)

```typescript
// 모든 페이지 최상위 컨테이너
<div className="min-h-screen bg-panel-dark px-4 py-5">
  {/* 페이지 타이틀 (선택) */}
  <h1 className="t-title text-gold mb-4">페이지 제목</h1>
  
  {/* 콘텐츠 */}
  <PixelCard>...</PixelCard>
</div>

// 패딩: px-4 (좌우 16px 통일)
// 최상단: py-5 (상하 20px)
// 카드 간격: space-y-3 또는 gap-3
```

---

## 5. 페이지별 재개편 사양

### 5-1. LoginPage (/login)

```
Landing 뷰:
  배경: bg-panel-dark (#1A1208) — 현재 bg-minecraft 유지 가능
  FAMILY QUEST 로고: 현재 애니메이션 유지 (잘 만들어짐)
  FAMILY LOGIN 버튼: PixelButton gold lg
  하단 링크: VERIFY ACCOUNT / GUEST / SETTING — 유지

Master 패널 (수정 완료):
  인라인 JSX로 변경 — 키보드 사라짐 버그 수정 ✓
```

### 5-2. HomePage (/home)

```
현재 문제:
  - bg-cream 카드가 어두운 배경과 대비 강렬 → 눈 피로
  - getMemberName() localStorage 직접 접근 (규칙 위반)

변경:
  전체 배경: bg-panel-dark
  캐릭터 영역: PixelCard variant="highlight" (panel-surface 배경)
  레벨/EXP: gold 강조 확대
  "최근 활동" 섹션: PixelCard variant="dark" + 헤더 t-heading text-gold
  알림 아이템: border-b border-panel-border, 텍스트 text-cream
  공지사항: PixelCard variant="dark"

getMemberName 제거:
  subscribeMembers() 훅으로 교체 또는 공통 헬퍼 useMembers() 훅 사용
```

### 5-3. MissionListPage (/missions)

```
현재 문제:
  - 탭(전체/공동/개별) 스타일 제각각
  - 미션 카드 색상 일관성 없음
  - 난이도 이모지 너무 작음

변경:
  탭 바: bg-panel-darkest + 활성 탭 bg-panel-surface + gold 하단 라인
  미션 카드: PixelCard variant="dark"
    - 제목: font-korean text-base font-bold text-cream
    - 카테고리·날짜: text-panel-sub text-sm
    - 난이도 이모지: text-2xl (크게)
    - 상태 배지: StatusBadge 컴포넌트 통일
  특별 퀘스트: PixelCard variant="special" (gold 배경) 유지
  즐겨찾기 ⭐: gold 강조
  EXPIRED: text-rejected font-bold (유지)
```

### 5-4. MissionDetailPage (/missions/:id)

```
변경:
  배경: bg-panel-dark
  상단 정보 카드: PixelCard variant="highlight"
  Daily Slot 탭: bg-panel-darkest + 활성 gold 라인
  G/B/H 버튼:
    G(GOOD): PixelButton success
    B(BAD):  PixelButton danger  
    H(HOLD): PixelButton variant="hold" (신규) → bg-hold text-white
  멤버 탭: 아이 이름 + 아이콘 (현재 유지)
```

### 5-5. MissionFormPage (/missions/new, /missions/:id/edit)

```
변경:
  form 배경: bg-panel-dark
  입력 필드: bg-panel-darkest border-4 border-panel-border text-cream
  라벨: font-korean text-sm font-bold text-panel-sub
  focus: border-gold
  특별 퀘스트 토글: 현재 빨간 버튼 → PixelButton danger (선택) / ghost (미선택)
```

### 5-6. MessagesPage (/messages)

```
현재 문제:
  - 채팅 버블 스타일 일관성 없음
  - 회원 목록 스타일 제각각

변경:
  배경: bg-panel-darkest (채팅방 분위기)
  내 버블: bg-panel-surface border-2 border-gold/40 text-cream
  상대 버블: bg-panel-mid border-2 border-panel-border text-cream
  날짜 구분선: text-panel-sub text-sm (현재 흰색 → panel-sub)
  회원 목록: PixelCard variant="dark" 아이콘 크게
```

### 5-7. RewardStatusPage (/rewards)

```
변경:
  요약 카드: PixelCard variant="highlight" + 총액 text-gold t-title
  출처 배지: bg-panel-surface + 아이콘 이모지 + text-panel-sub
  상세 목록: PixelCard variant="dark" 각 항목
```

### 5-8. CalendarPage (/calendar)

```
변경:
  배경: bg-panel-dark
  달력 그리드: bg-panel-mid border-panel-border
  오늘 날짜: bg-gold/30 border-gold
  기념일 이모지: 크게 표시
  뷰 전환(월/주/일) 탭: bg-panel-darkest + gold 활성 라인
```

### 5-9. ProfilePage (/profile)

```
변경:
  배경: bg-panel-dark
  캐릭터 영역: PixelCard variant="highlight"
  펫/배너 선택 그리드: PixelCard variant="dark"
  선택된 아이템: border-4 border-gold
  PIN 변경: PixelCard variant="dark"
```

### 5-10. Settings 군

```
변경:
  SettingsPage: PixelCard variant="dark" 각 섹션
  메뉴 아이템: border-b border-panel-border
  MasterSettingsPage: PixelCard variant="dark"
  RewardSendPage: PixelButton gold (발송)
  NoticesPage: 목록 PixelCard variant="dark"
  SpecialDaysPage: 달력 연동 이모지 설정
```

### 5-11. BeggingPage / BeggingManagePage

```
변경:
  조르기 폼: PixelCard variant="dark"
  상태 표시: StatusBadge 통일
  승인/거절 버튼: PixelButton success / danger
```

---

## 6. 공통 패턴 통일

### 6-1. 팝업/모달 (PixelModal 통일)

```typescript
// 현재: 각 페이지마다 자체 팝업 구현 (z-index 제각각)
// 변경: 모두 PixelModal 사용

// 고정 규격:
// fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6
// 내부 패널: bg-panel-mid border-4 border-panel-border max-w-sm w-full
```

### 6-2. 로딩 상태

```typescript
// 현재: 각자 다른 로딩 표현
// 변경: 통일된 로딩 패턴

// 인라인 로딩:
<p className="font-korean text-sm text-panel-sub text-center animate-pulse">
  불러오는 중...
</p>

// 페이지 로딩:
<div className="flex items-center justify-center h-48">
  <p className="font-korean text-base text-panel-sub animate-pulse">⏳ 로딩 중...</p>
</div>
```

### 6-3. 빈 상태 (Empty State)

```typescript
// 통일된 빈 상태 패턴
<div className="flex flex-col items-center justify-center h-48 gap-3">
  <span className="text-5xl opacity-40">{emptyEmoji}</span>
  <p className="font-korean text-sm text-panel-sub text-center">{emptyMessage}</p>
</div>
```

### 6-4. 폼 입력 필드

```typescript
// 모든 입력 필드 통일 스타일
className="w-full bg-panel-darkest text-cream font-korean text-base
           border-4 border-panel-border px-3 py-3
           focus:outline-none focus:border-gold
           placeholder:text-panel-sub"
```

---

## 7. 코드 정리 항목 (Code Cleanup)

### 7-1. 공통 헬퍼 신설

```typescript
// src/presentation/hooks/useMembers.ts (신규)
// - subscribeMembers 구독 훅 (각 페이지에서 반복 구현 → 통일)
// - getMemberName(memberId) 헬퍼 (현재 3곳 중복 → 여기서만)

// src/domain/entities/Mission.ts 에 이동
// - STATUS_INFO (현재 5곳 중복)
// - formatRewards() (MissionCard, MissionDetailPage 중복)
// - DIFFICULTY_INFO (현재 MissionFormPage에만)
```

### 7-2. 미사용 import 정리

```
TS6133 경고 30+ 개 — 전면 정리
대상 파일: 거의 모든 페이지 컴포넌트
방법: VSCode "Remove All Unused Imports" 또는 파일별 수동 정리
```

### 7-3. 레거시 필드 정리

```typescript
// Mission 엔티티의 레거시 필드:
memberStatuses    — 사용 안 함, 쿼리에서 제외
childAccepted     — 사용 안 함, 쿼리에서 제외
```

### 7-4. 중복 컴포넌트 정리

```
현재:
  PixelCard.tsx — 있음
  InventoryGrid.tsx — 별도 존재 (InvetoryGrid 단위)

정리:
  InventoryGrid → PixelCard variant="dark" + grid로 대체 가능한지 검토
```

---

## 8. 구현 로드맵 (Implementation Roadmap)

### Phase 0 — 버그 수정 ✅ 완료
- [x] MasterPanel 키보드 사라짐 버그 수정 (인라인 JSX 변환)

### Phase 1 — 디자인 토큰 기반 작업 ✅ 완료
```
1. [x] tailwind.config.js — panel-* 색상 토큰 추가
2. [x] globals.css / index.css — bg-panel-dark 앱 기본 배경 적용
3. [x] PixelButton.tsx — hold variant 추가, size md 터치 높이 40px → py-2.5
4. [x] PixelCard.tsx — dark(default), special, highlight, light variant 재정의
5. [x] PixelModal.tsx — 신규 공통 모달 컴포넌트 생성 (open: boolean 필수 prop)
```

### Phase 2 — 레이아웃 공통 ✅ 완료
```
6.  [x] AppLayout.tsx — bg-panel-dark 적용 + BGM 자동재생 startAfterLogin()
7.  [x] Header.tsx — bg-panel-darkest + border-gold/30 + 미니 오디오 플레이어 UI
8.  [x] BottomNav.tsx — bg-panel-darkest + border-t-gold/30 + 활성 상단 라인 + 🎮 탭
9.  [x] useMembers.ts 훅 신설 — getMemberName 공통화
10. [x] Mission.ts — STATUS_INFO 단일 소스화
```

### Phase 3 — 핵심 페이지 ✅ 완료
```
11. [x] HomePage — 다크 카드, subscribeMembers 적용, 패밀리 늬우스, CheerOverlay, PraiseWhiteboard
12. [x] MissionListPage — 탭 다크화, MissionCard 다크 패널
13. [x] MissionDetailPage — Daily Slot G/B/H 버튼 PixelButton화
14. [x] MissionFormPage — 다크 입력 필드 (INPUT_CLS/TEXTAREA_CLS/SELECT_CLS 상수 통일)
15. [x] StatusBadge — CHILD_REJECTED 추가, Tailwind 직접 클래스
```

### Phase 4 — 보조 페이지 ✅ 완료 (A~N 14단계)
```
16. [x] MessagesPage — speech-bubble + getBubbleBorderCls + 역할별 border, ReactionPicker
17. [x] RewardStatusPage — card-highlight 총합 + PixelButton 탭 + 슬림화
18. [x] CalendarPage — inventory-slot 그리드 + PixelModal 바텀시트 교체 + 타임라인
19. [x] ProfilePage — 다크 패널 + PIN 변경 + XP 상점 4탭 슬롯 + handleEquip 전역 세션 동기화
20. [x] SettingsPage — PixelButton 전면 교체 + 응원·칭찬 스티커 발송 패널
21. [x] BeggingPage 군 — PixelModal + PixelButton 전면 교체
22. [x] MasterSettingsPage — PixelModal 교체 + 대회 제어판 + 엔진 새로고침 버튼
23. [x] NotificationsPage — 다크 텍스트 토큰 전환
24. [x] LoginPage — PixelButton gold + input-pixel + 대형 캐릭터 카드 PIN 뷰
25. [x] MessagesPage 2차 — 픽셀 입체감 인셋 섀도우 + DM 파트너 앵커 헤더
26. [x] NoticesPage — card-pixel 아코디언 + PixelModal 삭제 확인
27. [x] InventoryGrid — SLOT_SELECTED/UNLOCKED/LOCKED 상수 + inventory-slot CSS 연계
28. [x] RewardSendPage — input-pixel + PixelButton gold
```

### Phase 5 — 코드 정리 (일부 진행 중)
```
29. [ ] TS6133 미사용 import 전면 정리 (ProfilePage 내 saving 변수 해결 완료)
30. [ ] TetrisGame.tsx, SnakeGame.tsx 파일 자체 삭제 (import만 제거된 상태)
31. [ ] RewardStatusPage.tsx PixelModal open prop 주입 (TS2741 잔존)
32. [ ] NotificationsPage MISSION_EXPIRED / MOM_CHEER 타입 추가 (TS2739 잔존)
33. [x] ProfilePage TS2741 (PixelModal open prop) 완전 해소 — Session 29
34. [x] ProfilePage TS6133 (saving 변수) 완전 해소 — Session 29
```

### 마일스톤 추가 완료 항목 (Phase 개편 이후)
```
[마일스톤 2-1] Web Audio 8비트 레트로 사운드 시스템 ✅ (v1.9.0)
[마일스톤 2-2] 게임 개편 + userInventoryStore + 주간 대회 ✅
[마일스톤 2-3] 로그인 개편 + 메신저 강화 + 레거시 숙청 ✅
[마일스톤 3-1] 메인화면 + 응원 시스템 + 패밀리 늬우스 + 달력 타임라인 ✅
[대개정판 Session 28] 게임 대개편(지뢰찾기 신규·뱀·테트리스 삭제) + 오디오 파이프라인 ✅ (v2.0.0)
[마일스톤 2-3 종착지 Session 29] XP 재화 단일화 + 인벤토리 슬롯 상점 + 특퀘 UX + 이모지 안전장치 ✅ (v2.1.0→2.2.0)
```

---

## 9. Before / After 비교

### 전체 시각 비교

```
BEFORE (현재 v1.4.0):              AFTER (v2.0 목표):
─────────────────────────          ─────────────────────────
배경: bg-grass 풀초록 단색          배경: #1A1208 다크 나무색
헤더: bg-mc-brick 벽돌 이미지       헤더: #0F0A04 최다크 + gold 라인
카드: bg-cream 흰/크림              카드: #2A1F0E 다크 패널 + brown 테두리
텍스트: text-pixel-dark 검정        텍스트: text-cream 밝은 크림
버튼: 스타일 제각각                  버튼: PixelButton 3종으로 통일
탭바: bg-mc-brick 밝음              탭바: #0F0A04 최다크 + gold 아이콘
팝업: z-index 제각각                팝업: PixelModal 단일 패턴
이모지: 페이지마다 다름             이모지: 이모지 통일 가이드 준수
```

### 구체적 UX 개선

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| 미션 카드 가독성 | 초록 배경에 흰 카드 → 대비 강렬 | 다크 배경 + 다크 카드 → 눈 편안 |
| 버튼 찾기 | 페이지마다 위치·색상 다름 | gold/purple/ghost 3종 패턴화 |
| 상태 확인 | StatusBadge 크기·색상 제각각 | 단일 StatusBadge 컴포넌트 |
| 팝업 경험 | z-index 충돌 가능성 | z-[9999] 단일화 |
| 폼 입력 | 각자 다른 테두리·색상 | 다크 입력 필드 통일 |

---

## 10. 품질 기준 (완료 기준)

### 디자인 체크리스트

- [ ] 모든 페이지 배경 `bg-panel-dark` 적용
- [ ] 헤더·탭바 `bg-panel-darkest` 적용
- [ ] 모든 카드 `PixelCard` 컴포넌트 사용
- [ ] 모든 버튼 `PixelButton` 사용 (인라인 스타일 raw button 제거)
- [ ] 모든 팝업 `PixelModal` 사용
- [ ] 텍스트 최소 크기 13px (text-xs) 이상 준수
- [ ] `text-stone/40~70` 사용 없음
- [ ] `text-cream/40~70` 사용 없음
- [ ] 이모지 통일 가이드 준수

### 코드 체크리스트

- [ ] TS6133 경고 0개
- [ ] `getMemberName()` 중복 제거 → useMembers 훅 통일
- [ ] `STATUS_INFO` 단일 소스 (Mission.ts)
- [ ] `formatRewards()` 단일 소스 (Mission.ts)
- [ ] 레거시 필드 (`memberStatuses`, `childAccepted`) 쿼리 제외
- [ ] 각 페이지에서 `useMissions()` / `useNotifications()` 직접 호출 없음

---

*Family Quest Design Overhaul v3.0*  
*최초 작성: 2026-05-30 | 마지막 업데이트: 2026-05-31 | 현재 배포 버전: v2.2.0*
