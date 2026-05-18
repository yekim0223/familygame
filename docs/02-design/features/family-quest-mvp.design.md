# Family Quest MVP — Design Document

> **Summary**: 가족 4인 미션-보상 게이미피케이션 앱 — Clean Architecture + Firebase 설계
>
> **Project**: 패밀리 퀘스트 (Family Quest)
> **Version**: 1.0.0
> **Author**: Family Quest Team
> **Date**: 2026-04-23
> **Status**: Draft
> **Planning Doc**: [family-quest-mvp.plan.md](../01-plan/features/family-quest-mvp.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 아이들의 자발적 참여와 공정한 보상 관리를 위해. 구두 약속을 앱으로 투명하게 관리. |
| **WHO** | 아빠(Master)·엄마(Parent)·CHILD_1·CHILD_2, 확장 시 옵저버(비회원 조부모 등) |
| **RISK** | Firebase 실시간 동기화 복잡도, 픽셀 애니메이션 성능 (저사양 스마트폰), 가족 코드 인증 보안 |
| **SUCCESS** | 가족 4명이 매일 앱에 접속하여 미션 진행, 첫 달 미션 승인 10회 이상, 보상 적립 정상 동작 |
| **SCOPE** | Phase 1+2 통합 — 인증·미션·보상·달력·메시지·조르기·캐릭터/레벨·옵저버 포함 |

---

## Design Anchor (픽셀 테마 토큰)

| Category | Tokens |
|----------|--------|
| **Colors** | grass: `#5C8A1E`, dirt: `#8B5E3C`, stone: `#9E9E9E`, gold: `#FFD700`, sky: `#4FC3F7`, purple: `#7B5EA7`, pink: `#E8A0BF`, cream: `#FFF8F0`, approved: `#43A047`, rejected: `#E53935`, hold: `#FB8C00` |
| **Typography** | EN/숫자: Press Start 2P, KO 본문: Nanum Gothic Coding, sizes: 10/12/14/16/18/24px |
| **Spacing** | 4px grid, card padding: 12px, section gap: 16px, tap target: min 44px |
| **Radius** | 2px (픽셀 유지), 버튼 테두리 4px solid |
| **Tone** | 마인크래프트 오마주 + 여아 감성. "마인크래프트 같은데 더 귀여워" |
| **Layout** | 모바일 세로 360~428px, 헤더 48px 고정, 하단 탭 56px 고정 |

---

## 1. Overview

### 1.1 Design Goals

- Firebase Firestore 실시간 동기화를 활용한 가족 전용 폐쇄형 앱
- Clean Architecture로 9개 기능 모듈 간 의존성 분리
- CSS Keyframe 기반 픽셀 애니메이션 — 외부 라이브러리 없이 성능 최우선
- 역할(Master/Parent/Child/Observer)별 UI 분기 명확화

### 1.2 Design Principles

- **Single Responsibility**: 각 feature 모듈은 단일 도메인만 담당
- **Firestore First**: 모든 상태는 Firestore → Zustand → UI 단방향 흐름
- **Role-based Rendering**: 역할에 따라 컴포넌트가 조건부 렌더링 (권한 분기 UI)
- **Performance Over Beauty**: 애니메이션은 CSS만, Canvas는 파티클에만 최소 사용

---

## 2. Architecture

### 2.0 선택된 아키텍처: Option B — Clean Architecture

| Criteria | Option A: Flat | **Option B: Clean** | Option C: Feature-First |
|----------|:-:|:-:|:-:|
| 복잡도 | 낮음 | **중-높음** | 중간 |
| 유지보수성 | 낮음 | **높음** | 높음 |
| 파일 수 | 적음 | **많음** | 중간 |
| 레이어 분리 | 없음 | **엄격** | 느슨 |
| 선택 | ☐ | **✅** | ☐ |

**선택 이유**: 9개 기능 모듈(auth/missions/rewards/calendar/messages/begging/characters/competition/observer)이 서로 의존하는 경우가 많음. 레이어 경계를 명확히 하여 Firebase 로직이 UI로 새어나가는 것을 방지. 장기 유지보수 우선.

### 2.1 Clean Architecture 레이어 구조

```
┌───────────────────────────────────────────────┐
│              Presentation Layer                │
│   pages/, components/, hooks/ (UI 상태만)      │
├───────────────────────────────────────────────┤
│              Application Layer                 │
│   use-cases/  (비즈니스 로직 오케스트레이션)    │
├───────────────────────────────────────────────┤
│               Domain Layer                     │
│   entities/, services/  (순수 타입/규칙)        │
├───────────────────────────────────────────────┤
│            Infrastructure Layer                │
│   firebase/, stores/  (외부 시스템 연결)        │
└───────────────────────────────────────────────┘
의존 방향: Presentation → Application → Domain ← Infrastructure
```

### 2.2 전체 폴더 구조

```
src/
├── presentation/
│   ├── pages/
│   │   ├── auth/            # Login, Register, ObserverLogin
│   │   ├── home/            # Home, ObserverHome
│   │   ├── missions/        # MissionList, MissionDetail, MissionForm, ApprovalList
│   │   ├── calendar/        # CalendarMonth, CalendarWeek, CalendarDay
│   │   ├── rewards/         # RewardStatus, History, Statistics
│   │   ├── messages/        # GroupChat, DirectChat, CheerBox
│   │   ├── begging/         # BeggingRequest, BeggingManage
│   │   ├── profile/         # Profile, CharacterSelect
│   │   └── settings/        # Settings, MasterSettings
│   ├── components/
│   │   ├── layout/          # AppLayout, Header, BottomNav, Drawer
│   │   ├── pixel/           # PixelButton, PixelCard, SpeechBubble, ExpBar
│   │   ├── character/       # CharacterSprite, PetSprite, InventoryGrid
│   │   └── animations/      # LoginAnimation, MissionCompleteAnim, LevelUpAnim
│   └── hooks/               # useAuth, useMissions, useRewards (UI 상태 훅)
│
├── application/
│   └── use-cases/
│       ├── auth/            # signUp, login, observerLogin
│       ├── missions/        # createMission, completeMission, approveMission
│       ├── rewards/         # getRewardHistory, getStatistics
│       ├── messages/        # sendMessage, sendCheer
│       ├── begging/         # submitBegging, approveBegging
│       ├── characters/      # selectCharacter, gainExp, levelUp
│       └── competition/     # calculateWeeklyWinner, awardCrown
│
├── domain/
│   ├── entities/
│   │   ├── Member.ts        # Member 타입 정의
│   │   ├── Mission.ts       # Mission 타입 정의
│   │   ├── Reward.ts        # Reward 타입 정의
│   │   ├── Message.ts       # Message/Cheer 타입 정의
│   │   └── index.ts
│   └── services/
│       ├── KoreanAge.ts     # 한국 나이 계산 순수 함수
│       ├── ExpCalc.ts       # EXP/레벨 계산 순수 함수
│       ├── MissionStatus.ts # 미션 상태 전이 규칙
│       └── Competition.ts   # 왕관 집계 규칙
│
└── infrastructure/
    ├── firebase/
    │   ├── config.ts        # Firebase 초기화
    │   ├── auth.ts          # Firebase Auth 헬퍼
    │   ├── firestore.ts     # Firestore CRUD 헬퍼 (공통)
    │   ├── collections/
    │   │   ├── members.ts   # members 컬렉션 쿼리
    │   │   ├── missions.ts  # missions 컬렉션 쿼리
    │   │   ├── rewards.ts   # rewards 컬렉션 쿼리
    │   │   └── messages.ts  # messages 컬렉션 쿼리
    │   └── security-rules.txt  # Firestore 보안 규칙 초안
    └── stores/
        ├── authStore.ts     # 현재 로그인 구성원
        ├── missionStore.ts  # 미션 목록/상태
        ├── notificationStore.ts  # 알림 뱃지
        └── uiStore.ts       # 로딩, 모달 등 UI 상태
```

### 2.3 데이터 흐름

```
Firestore (실시간)
    ↓  onSnapshot 리스너
infrastructure/stores/ (Zustand)
    ↓  useStore()
presentation/hooks/ (데이터 구독)
    ↓  props
presentation/pages/ + components/ (렌더링)
    ↓  사용자 액션
application/use-cases/ (비즈니스 로직)
    ↓  Firestore write
Firestore (업데이트 → 자동 re-render)
```

### 2.4 의존성 규칙

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| Presentation | Application use-cases, Domain entities | Infrastructure 직접 접근 금지 |
| Application | Domain entities/services, Infrastructure stores | Presentation |
| Domain | 없음 (순수 TypeScript) | 모든 외부 레이어 |
| Infrastructure | Domain entities | Application, Presentation |

---

## 3. Domain Entities (TypeScript)

```typescript
// domain/entities/Member.ts
type Role = 'DAD' | 'MOM' | 'CHILD' | 'OBSERVER'

interface Member {
  id: string
  familyId: string
  name: string
  role: Role
  birthDate: Date
  birthHour: number          // 0~23
  koreanAge: number          // 자동 계산
  pinHash: string
  level: number
  exp: number
  character: string          // 캐릭터 ID
  pet: string                // 반려동물 ID
  equipment: string[]        // 장비 아이템 ID 목록
  worldBanner: string        // 세계관 배너 ID
  beggingLeft: number        // 이번 주 조르기 남은 횟수
  isActive: boolean
  createdAt: Date
}

// domain/entities/Mission.ts
type MissionType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
type MissionStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'APPROVED' | 'ON_HOLD' | 'REJECTED' | 'EXPIRED'
type Difficulty = 1 | 2 | 3 | 4 | 5
type MissionCategory = 'STUDY' | 'TUTORING' | 'CLEANING' | 'MEAL' | 'HOMEWORK' | 'EXERCISE' | 'READING' | 'BEHAVIOR' | 'CREATIVE' | 'ETC'

interface Reward {
  type: 'MONEY' | 'GAME_TIME' | 'PHONE_TIME' | 'GIFT' | 'DINING' | 'CUSTOM'
  amount: number
  customLabel?: string
}

interface Mission {
  id: string
  familyId: string
  title: string
  description?: string
  category: MissionCategory
  type: MissionType
  difficulty: Difficulty      // EXP = difficulty * 1점
  targetMemberIds: string[]
  creatorId: string
  rewards: Reward[]
  status: MissionStatus
  completedBy?: string
  emoji?: string
  isFavorite: boolean
  repeatEnabled: boolean
  startDate: Date
  endDate: Date
  statusHistory: StatusChange[]
  createdAt: Date
}

interface StatusChange {
  from: MissionStatus
  to: MissionStatus
  changedBy: string
  changedAt: Date
  note?: string
}

// domain/entities/Reward.ts (적립 기록)
interface RewardRecord {
  id: string
  familyId: string
  missionId: string
  memberId: string
  rewardType: string
  amount: number
  approvedBy: string
  approvedAt: Date
  isPaid: boolean
  paidAt?: Date
}

// domain/entities/Message.ts
type MessageType = 'CHAT' | 'CHEER' | 'SYSTEM'

interface Message {
  id: string
  familyId: string
  type: MessageType
  senderId: string
  receiverId: string | null   // null = 전체
  content: string
  cheerEmoji?: string         // 응원 이모티콘
  targetMissionId?: string
  readBy: string[]
  createdAt: Date
}

interface Notification {
  id: string
  familyId: string
  type: 'MISSION_APPROVED' | 'MISSION_REJECTED' | 'MISSION_HOLD' | 'LEVEL_UP' | 'BEG_RESULT' | 'CHEER' | 'NEW_MISSION'
  targetMemberId: string
  content: string
  relatedId: string
  isRead: boolean
  createdAt: Date
}
```

---

## 4. Firebase / Firestore 설계

### 4.1 컬렉션 구조

```
families/{familyId}                           ← 가족 단위 루트
  ├── settings (doc)
  │     familyCode: string (SHA-256 해시)
  │     rewardTypes: RewardType[]
  │     specialDays: SpecialDay[]             ← 생일/결혼기념일
  │     createdAt: Timestamp
  │
  ├── members/{memberId} (col)
  ├── missions/{missionId} (col)
  ├── rewards/{rewardId} (col)
  ├── messages/{messageId} (col)
  ├── notifications/{notifId} (col)
  └── competition/{yearWeek} (col)            ← 예: "2026-W17"
        scores: { [memberId]: number }
        weekWinner: string | null
        monthWinner: string | null
        crownExchanged: boolean
```

### 4.2 Firestore 보안 규칙 (핵심)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 가족 코드로 familyId 확인
    function isFamilyMember(familyId) {
      return request.auth != null &&
             get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.isActive == true;
    }

    function getRole(familyId) {
      return get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role;
    }

    function isParent(familyId) {
      return getRole(familyId) in ['DAD', 'MOM'];
    }

    function isDad(familyId) {
      return getRole(familyId) == 'DAD';
    }

    match /families/{familyId} {
      // settings: 읽기는 전체, 쓰기는 부모
      match /settings {
        allow read: if isFamilyMember(familyId);
        allow write: if isParent(familyId);
      }

      // members: 자신의 정보는 누구나 수정, 역할 변경은 아빠만
      match /members/{memberId} {
        allow read: if isFamilyMember(familyId);
        allow create: if true;  // 회원가입 시 자기 자신 생성
        allow update: if request.auth.uid == memberId
                      || (isDad(familyId) && request.resource.data.keys().hasAny(['role', 'isActive']));
      }

      // missions: 생성/수정은 부모, 완료신청은 아이
      match /missions/{missionId} {
        allow read: if isFamilyMember(familyId);
        allow create: if isParent(familyId);
        allow update: if isParent(familyId)
                      || (getRole(familyId) == 'CHILD'
                          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'completedBy']));
      }

      // rewards: 부모만 생성, 전체 읽기 (아이는 본인 것만 — 클라이언트 필터)
      match /rewards/{rewardId} {
        allow read: if isFamilyMember(familyId);
        allow write: if isParent(familyId);
      }

      // messages: 모두 읽기, 옵저버는 응원만 write
      match /messages/{messageId} {
        allow read: if isFamilyMember(familyId);
        allow create: if isFamilyMember(familyId)
                      && (getRole(familyId) != 'OBSERVER'
                          || request.resource.data.type == 'CHEER');
      }

      // notifications: 대상 본인만 수정(읽음 처리)
      match /notifications/{notifId} {
        allow read: if isFamilyMember(familyId);
        allow update: if request.auth.uid == resource.data.targetMemberId;
        allow create: if isFamilyMember(familyId);
      }
    }
  }
}
```

### 4.3 Cloud Functions (스케줄 작업)

| Function | 트리거 | 동작 |
|----------|--------|------|
| `monthlySettlement` | 매월 1일 00:00 KST | 전월 보상 집계, 정산 레코드 생성 |
| `resetDailyMissions` | 매일 자정 00:00 KST | 일일 미션 ACTIVE 리셋 |
| `resetWeeklyMissions` | 매주 월요일 자정 | 주간 미션 리셋 + beggingLeft 초기화 |
| `resetMonthlyMissions` | 매월 1일 자정 | 월간 미션 리셋 |
| `calculateWeeklyWinner` | 매주 일요일 23:55 | 주간 왕관 수여자 결정 |
| `calculateMonthlyWinner` | 매월 말일 23:55 | 월간 왕관 수여자 결정 |
| `expireOldMissions` | 매일 00:05 | ACTIVE 미션 중 endDate 지난 것 EXPIRED 처리 |

---

## 5. UI/UX 설계

### 5.1 라우팅 구조

```typescript
// React Router v6
const routes = [
  // 인증 전
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/observer-login', element: <ObserverLoginPage /> },

  // 인증 후 (AppLayout 감싸기)
  { path: '/', element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/home" /> },
      { path: 'home', element: <HomePage /> },
      { path: 'missions', element: <MissionListPage /> },
      { path: 'missions/new', element: <MissionFormPage /> },
      { path: 'missions/:id', element: <MissionDetailPage /> },
      { path: 'missions/:id/edit', element: <MissionFormPage /> },
      { path: 'approval', element: <ApprovalListPage /> },
      { path: 'calendar', element: <CalendarPage /> },         // 탭 전환
      { path: 'messages', element: <MessagesPage /> },         // 서브탭
      { path: 'rewards', element: <RewardStatusPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'statistics', element: <StatisticsPage /> },
      { path: 'begging', element: <BeggingPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
    ]
  }
]
```

### 5.2 공통 컴포넌트 명세

#### Layout 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `AppLayout` | layout/AppLayout.tsx | 헤더+콘텐츠+하단탭 래퍼 |
| `Header` | layout/Header.tsx | 로고, 캐릭터 아이콘, 알림 뱃지 |
| `BottomNav` | layout/BottomNav.tsx | 5탭 고정 네비게이션 |
| `ProtectedRoute` | layout/ProtectedRoute.tsx | 미인증 시 /login 리다이렉트 |

#### Pixel UI 컴포넌트

| 컴포넌트 | Props | 설명 |
|---------|-------|------|
| `PixelButton` | `variant: 'primary'\|'gold'\|'danger'\|'ghost'`, `size`, `onClick` | 픽셀 테두리 버튼, 클릭 시 translateY(2px) |
| `PixelCard` | `children`, `className` | 돌 블록 스타일 카드 |
| `SpeechBubble` | `text`, `direction: 'bottom'\|'left'`, `color` | RPG 말풍선 |
| `ExpBar` | `current`, `max`, `label` | 픽셀 블록 경험치 바 |
| `StatusBadge` | `status: MissionStatus` | 상태 색상 블록 뱃지 |
| `KoreanAgeName` | `name`, `birthDate` | "유나 · 9살" 형태 표시 |
| `NotifBadge` | `count` | 빨간 픽셀 뱃지 |

#### Character 컴포넌트

| 컴포넌트 | 설명 |
|---------|------|
| `CharacterSprite` | 역할+캐릭터 ID로 픽셀 이미지 렌더링 |
| `PetSprite` | 반려동물 픽셀 이미지 |
| `InventoryGrid` | 캐릭터/동물 선택 인벤토리 그리드 (해금/잠금 표시) |
| `LoginAnimation` | 홈 진입 시 역할별 CSS Keyframe 애니메이션 (2~3초) |

### 5.3 화면별 상세 컴포넌트

#### SCR-02 LoginPage
- `CharacterSelector`: 가족 구성원 캐릭터 나열 (등록된 members 구독)
- `PinInputBubble`: 선택된 구성원 이름 + PIN 입력 말풍선
- 낮/밤 배경: `new Date().getHours()` 기준 CSS class 전환

#### SCR-03 RegisterPage (4단계 스텝)
- Step 1: 이름 입력
- Step 2: 가족 코드 입력 (서버 검증)
- Step 3: 생년월일 + 시간 스크롤 피커
- Step 4: 역할 선택 + 캐릭터 선택 (`InventoryGrid`)

#### SCR-04 HomePage
- `LoginAnimation`: 홈 진입 1회 재생
- `ProfileBanner`: 캐릭터+동물, 이름·나이, 레벨·EXP
- `ActivityFeed`: notifications 컬렉션 최근 5개 구독
- `FamilyNoticeBoard`: settings.notice 필드
- `TodayQuestList`: 오늘 일일 미션 (최대 5개)
- `WeekProgressBar`: 이번 주 미션 달성율
- `RewardSummary`: 이번 달 적립 요약 (CHILD만)
- `ApprovalBadge`: 승인 대기 수 (부모만)
- `BeggingFab`: 플로팅 조르기 버튼 (CHILD만)

#### SCR-05 MissionListPage
- `StatusFilterTab`: 전체/진행중/완료신청/승인됨/소멸
- `TypeFilter`: 일일/주간/월간/기간
- `CategoryFilter`: 10종 카테고리
- `TargetFilter`: (부모) 전체/CHILD_1/CHILD_2
- `MissionCard`: 난이도 블록, 제목, 보상, 기간, 상태, 즐겨찾기
- `CreateFab`: + 버튼 (부모만)

#### SCR-06 MissionDetailPage
- `MissionHeader`: 제목, 카테고리, 유형
- `MissionInfo`: 난이도·중요도·기간·대상·보상 상세
- `MissionCompleteButton`: (CHILD, ACTIVE 상태만) 완료! 버튼 + 검 애니메이션
- `StatusMessage`: 상태별 말풍선 메시지
- `ApprovalButtons`: (부모, PENDING_APPROVAL) 승인/보류/미승인
- `StatusTimeline`: 상태 변경 히스토리

#### SCR-07 MissionFormPage
- `MissionTitleInput`
- `CategorySelect`: 10종 칩 선택
- `TypeSelect`: 일일/주간/월간/기간
- `DifficultySelect`: 5단계 픽셀 블록
- `TargetSelect`: CHILD_1/CHILD_2 복수 선택
- `RewardBuilder`: 보상 종류+금액/시간 추가 빌더
- `DateRangePicker`: 기간 미션용
- `EmojiPicker`: 미션 이모지
- `RepeatToggle`

#### SCR-08 ApprovalListPage
- `ApprovalCard`: 구성원 이름, 미션명, 신청 시간, 승인/보류/미승인 버튼

#### SCR-09 CalendarPage (월간)
- `MonthGrid`: 7×5 날짜 그리드
- `DayCell`: 날짜 + 감정 이모지 (missions 집계)
- `SpecialDayIcon`: 생일🎂 / 기념일💍
- `MissionBottomSheet`: 날짜 탭 시 슬라이드업 미션 목록
- 뷰 전환 탭: [월간][주간][일간]

#### SCR-12/13 RewardStatus + History
- `YearTab` + `MonthTab`: 연도·월 필터
- `RewardSummaryCards`: 💰게임시간🎮 합계 카드
- `RewardList`: 날짜/미션명/보상/승인자 목록
- `KoreanAgeLabel`: "9살 때(2026년) 기록"

#### SCR-15 GroupChat + SCR-16 DirectChat
- `MessageBubble`: 본인 오른쪽, 상대 왼쪽, RPG 말풍선 스타일
- `CheerButton`: 응원 이모티콘 8종 팝업
- `MessageInput`: 텍스트 + 이모지 입력

#### SCR-17 BeggingPage (CHILD)
- `BeggingTypeSelector`: 4종 선택
- `BeggingTextarea`: 최대 200자
- `BeggingCounter`: 이번 주 남은 횟수 표시
- `BeggingHistory`: 이전 요청 목록 (상태)

#### SCR-19 ProfilePage
- `CharacterDisplay`: 크게 표시된 캐릭터+동물
- `CharacterChangeButton` → `InventoryGrid`
- `PetChangeButton` → 반려동물 선택
- `WorldBannerSelect`: 10종 배경 선택
- `LevelDisplay`: 레벨, EXP, 다음 레벨까지

---

### 5.4 Page UI Checklist (Gap Detector용)

#### LoginPage (SCR-02)
- [ ] 배경: 마인크래프트 마을 픽셀 배경 (낮/밤 자동 전환)
- [ ] 타이틀: "⛏ FAMILY QUEST" + "패밀리 퀘스트" 부제
- [ ] 캐릭터 나열: 등록된 구성원 캐릭터 아이콘 (최대 5개)
- [ ] PIN 입력 말풍선: 캐릭터 탭 시 이름 + 입력창 등장
- [ ] PIN 오입력 3회: 30초 잠금 메시지
- [ ] 버튼: "우리 가족 인증하기" (신규 가입)
- [ ] 버튼: "Guest 접속" (옵저버)

#### RegisterPage (SCR-03)
- [ ] 진행 표시: Step N/4 + 픽셀 프로그레스 바
- [ ] Step 1: 이름 입력 (필수)
- [ ] Step 2: 가족 코드 입력 + 오류 메시지
- [ ] Step 3: 생년월일 3단 피커 + 시간 피커 (0~23시)
- [ ] Step 4: 역할 선택 (아빠/엄마/딸) + 캐릭터 그리드 + 반려동물 선택
- [ ] 뒤로가기 버튼 (각 스텝)

#### HomePage (SCR-04)
- [ ] 캐릭터 애니메이션: 홈 진입 시 1회 (2~3초) CSS 재생
- [ ] 프로필 배너: 캐릭터+동물, 이름·나이, Lv. EXP바
- [ ] AI 활동 피드: 최근 활동 최대 5개, 각 항목 탭 시 이동
- [ ] 가족 공지판: 부모 메모 표시 (없으면 숨김)
- [ ] 오늘의 퀘스트: 일일 미션 리스트 (최대 5개 + "더보기")
- [ ] 이번 주 진행률: 픽셀 프로그레스 바 + 퍼센트
- [ ] 이번 달 보상 요약: 💰 금액 🎮 시간 (CHILD만)
- [ ] 승인 대기 뱃지: 숫자 + 바로가기 (부모만)
- [ ] 조르기 플로팅 버튼 (CHILD만, 우하단)

#### MissionListPage (SCR-05)
- [ ] 상태 필터 탭: 전체/진행중/완료신청/승인됨/소멸
- [ ] 유형 필터: 전체/일일/주간/월간/기간
- [ ] 카테고리 필터: 10종 드롭다운
- [ ] 대상 필터: (부모만) 전체/CHILD_1/CHILD_2
- [ ] 미션 카드: 난이도 블록 색상, 제목, 보상, 잔여 기간, 상태
- [ ] 즐겨찾기 아이콘 (별)
- [ ] 성취도 바 (30/50/80% 마일스톤)
- [ ] 플러스 버튼 (부모만)

#### MissionDetailPage (SCR-06)
- [ ] 미션 제목, 카테고리, 유형, 난이도 배지
- [ ] 기간, 대상, 보상 상세
- [ ] 미션 설명 (있을 경우)
- [ ] "미션 완료!" 버튼 (CHILD, ACTIVE 상태만)
- [ ] 상태 말풍선 메시지 (상태에 따라 자동)
- [ ] 승인/보류/미승인 버튼 (부모, PENDING_APPROVAL만)
- [ ] 수정/삭제 버튼 (부모 + 생성자)
- [ ] 상태 변경 타임라인

#### MissionFormPage (SCR-07)
- [ ] 미션 제목 입력 (필수)
- [ ] 카테고리 칩 선택 (10종, 단일 선택)
- [ ] 미션 유형 선택 (4종)
- [ ] 난이도 5단계 선택 (픽셀 블록 색상)
- [ ] 대상 구성원 복수 선택
- [ ] 보상 추가 빌더 (종류 선택 + 수량)
- [ ] 날짜 범위 (기간 미션만)
- [ ] 이모지 선택 (선택)
- [ ] 반복 토글 (선택)

#### CalendarPage - 월간 (SCR-09)
- [ ] 월 이동 < > 버튼
- [ ] 뷰 전환 탭: [월간][주간][일간]
- [ ] 날짜 그리드 (7×5)
- [ ] 감정 이모지: 달성률 기준 자동 표시
- [ ] 생일🎂 / 기념일💍 특별일 아이콘
- [ ] 날짜 탭: 하단 시트로 미션 목록 슬라이드업
- [ ] 오늘 날짜 강조 표시
- [ ] 토/일 연한 핑크 배경

#### GroupChatPage (SCR-15)
- [ ] 메시지 탭 내 서브탭: [그룹채팅][1:1][응원함]
- [ ] 메시지 버블: 본인 오른쪽, 상대 왼쪽
- [ ] 발신자 이름+캐릭터 아이콘 (그룹에서)
- [ ] 읽음/안읽음 표시
- [ ] 응원 이모티콘 버튼 (메시지마다)
- [ ] 텍스트 입력창 + 전송 버튼
- [ ] 옵저버: 읽기만 가능 (입력창 비활성)

#### BeggingPage (SCR-17)
- [ ] 이번 주 남은 횟수 표시 (예: "1회 / 2회")
- [ ] 요청 유형 4종 선택 칩
- [ ] 내용 입력창 (최대 200자, 글자수 표시)
- [ ] 전송 버튼 ("조르기 전송!" + 아이 손 흔들기 애니메이션)
- [ ] 이전 요청 목록 (상태별 아이콘)

#### ProfilePage (SCR-19)
- [ ] 현재 캐릭터 + 반려동물 크게 표시
- [ ] 이름, 한국 나이, 역할
- [ ] 레벨, EXP, 다음 레벨까지 남은 점수
- [ ] "캐릭터 변경" 버튼 → 인벤토리 그리드 (해금/잠금)
- [ ] "반려동물 변경" 버튼
- [ ] "세계관 배너 변경" 버튼 (10종 그리드)

---

## 6. Error Handling

### 6.1 에러 코드

| 코드 | 상황 | 사용자 메시지 | 처리 |
|------|------|------------|------|
| `AUTH_INVALID_CODE` | 가족 코드 불일치 | "가족 코드가 맞지 않아요 🔒" | 재입력 유도 |
| `AUTH_LOCKED` | PIN 3회 실패 | "잠시 기다려줘요! (30초) ⏳" | 30초 후 해제 |
| `MISSION_EXPIRED` | 소멸된 미션 접근 | "이 미션은 기간이 끝났어요 😢" | 읽기 전용 표시 |
| `PERMISSION_DENIED` | 권한 없는 액션 | "이 기능은 [역할]만 사용할 수 있어요" | 버튼 숨김 우선 |
| `NETWORK_ERROR` | Firebase 연결 실패 | "인터넷 연결을 확인해봐요 📡" | 재시도 버튼 |
| `BEG_LIMIT_REACHED` | 조르기 횟수 소진 | "이번 주 조르기를 다 썼어요! 다음 주에 도전하세요 🙏" | 버튼 비활성 |

### 6.2 에러 처리 패턴

```typescript
// infrastructure/firebase/firestore.ts
export async function firestoreWrite<T>(
  operation: () => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await operation()
    return { data, error: null }
  } catch (e: any) {
    const message = mapFirebaseError(e.code)
    return { data: null, error: message }
  }
}
```

---

## 7. Security Considerations

- [ ] 가족 코드는 SHA-256 해시 후 Firestore 저장
- [ ] PIN은 클라이언트 측에서 해시 후 비교 (Firebase Auth anonymous + custom claims)
- [ ] Firestore 보안 규칙으로 역할별 read/write 강제
- [ ] 옵저버 세션: 24시간 후 자동 만료 (Cloud Functions로 처리)
- [ ] 아이 데이터: 다른 가족 구성원의 familyId 범위 내에서만 접근
- [ ] HTTPS 강제 (Firebase Hosting 기본 제공)
- [ ] 민감 정보(PIN) 로컬 스토리지 저장 금지, sessionStorage + Zustand만 사용

---

## 8. Test Plan

### 8.1 테스트 스코프

| Type | 대상 | 도구 |
|------|------|------|
| L1: Domain Unit | KoreanAge, ExpCalc, MissionStatus 순수 함수 | Vitest |
| L2: Firebase 통합 | Firestore CRUD, 보안 규칙 | Firebase Emulator + Vitest |
| L3: UI 컴포넌트 | PixelButton, MissionCard, ExpBar | Vitest + Testing Library |
| L4: E2E 주요 플로우 | 회원가입→로그인→미션생성→승인→보상 | Playwright |

### 8.2 L1: 도메인 단위 테스트

| # | 대상 | 테스트 케이스 |
|---|------|------------|
| 1 | `KoreanAge.calc(birthDate)` | 2018년생 → 2026년 = 9살 |
| 2 | `ExpCalc.getLevelFromExp(exp)` | 0→Lv.1, 100→Lv.2, 1000→Lv.10 |
| 3 | `MissionStatus.canComplete(role, status)` | CHILD+ACTIVE=true, CHILD+EXPIRED=false |
| 4 | `MissionStatus.canApprove(role, creatorId, memberId)` | 생성자 부모만 승인 가능 |

### 8.3 L4: E2E 시나리오

| # | 시나리오 | 단계 | 성공 기준 |
|---|---------|------|---------|
| 1 | 가족 가입 전체 | 아빠 가입→가족 코드 확인→엄마 가입→CHILD 가입 | 4명 모두 홈 접속 |
| 2 | 미션 승인 플로우 | 부모 미션 생성→CHILD 완료 신청→부모 승인→보상 확인 | rewards 컬렉션에 레코드 생성 |
| 3 | 조르기 플로우 | CHILD 요청→아빠 수락→엄마 수락→아이 알림 확인 | 양쪽 수락 후 APPROVED |
| 4 | 달력 이모지 | 미션 100% 승인 날→😄 표시 확인 | 달력 해당 날짜에 이모지 |

### 8.4 Seed Data

| Entity | 최소 수 | 필수 필드 |
|--------|--------|---------|
| families | 1 | familyCode, settings |
| members | 4 | 아빠(DAD)/엄마(MOM)/CHILD_1/CHILD_2 각 1명 |
| missions | 5 | 일일 2개, 주간 2개, 월간 1개 (다양한 상태) |
| rewards | 3 | APPROVED 상태 미션 기반 |

---

## 9. Clean Architecture 레이어 배정

| Component | Layer | 위치 |
|-----------|-------|------|
| `LoginPage`, `MissionCard` | Presentation | `src/presentation/pages/`, `src/presentation/components/` |
| `signUp`, `approveMission`, `gainExp` | Application | `src/application/use-cases/` |
| `Member`, `Mission`, `KoreanAge` | Domain | `src/domain/entities/`, `src/domain/services/` |
| `firestore.ts`, `authStore.ts` | Infrastructure | `src/infrastructure/firebase/`, `src/infrastructure/stores/` |

---

## 10. Coding Conventions

### 10.1 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `MissionCard`, `PixelButton` |
| 훅 | camelCase, use 접두사 | `useAuth`, `useMissions` |
| use-case 함수 | camelCase | `createMission`, `approveMission` |
| Firestore 헬퍼 | camelCase | `getMissions`, `updateMissionStatus` |
| 상수 | UPPER_SNAKE_CASE | `MAX_BEGGING_PER_WEEK`, `EXP_PER_LEVEL` |
| 파일 (컴포넌트) | PascalCase.tsx | `MissionCard.tsx` |
| 파일 (유틸/서비스) | camelCase.ts | `koreanAge.ts` |
| 폴더 | kebab-case | `use-cases/`, `pixel/` |

### 10.2 상태 관리 패턴

```typescript
// infrastructure/stores/missionStore.ts
interface MissionStore {
  missions: Mission[]
  loading: boolean
  setMissions: (missions: Mission[]) => void
  // Firestore 리스너는 use-case에서 주입
}

// presentation/hooks/useMissions.ts
// Firestore onSnapshot → store 업데이트 → UI 구독
export function useMissions(familyId: string) {
  const { missions, setMissions } = useMissionStore()
  useEffect(() => {
    const unsubscribe = subscribeToMissions(familyId, setMissions)
    return unsubscribe
  }, [familyId])
  return missions
}
```

### 10.3 환경변수

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## 11. Implementation Guide

### 11.1 패키지 목록

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0",
    "firebase": "^10.10.0",
    "react-hook-form": "^7.51.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0",
    "vite-plugin-pwa": "^0.19.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.4.0",
    "@playwright/test": "^1.43.0",
    "@testing-library/react": "^15.0.0"
  }
}
```

### 11.2 초기 설정 순서

```bash
# 1. 프로젝트 생성
npm create vite@latest family-quest -- --template react-ts
cd family-quest

# 2. 패키지 설치
npm install react-router-dom zustand firebase react-hook-form
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa vitest @playwright/test

# 3. Tailwind 초기화
npx tailwindcss init -p

# 4. Firebase 프로젝트 연결
npm install -g firebase-tools
firebase login
firebase init  # Hosting + Firestore + Functions + Emulator

# 5. 환경변수 설정
cp .env.example .env.local
```

### 11.3 Session Guide (Module Map)

| Module | Scope Key | 내용 | 예상 세션 |
|--------|-----------|------|----------|
| 프로젝트 세팅 | `module-0` | Vite+React+TS 초기화, Tailwind 픽셀 테마, Firebase 연결, Clean Architecture 폴더 구조 | 1세션 |
| 인증 시스템 | `module-1` | 회원가입(4단계), 로그인(캐릭터+PIN), 옵저버 로그인, 보안 규칙 초안 | 1~2세션 |
| 미션 코어 | `module-2` | 미션 생성·목록·상세, 완료신청·승인 워크플로우, 보상 적립 | 2세션 |
| 홈 + 달력 | `module-3` | 홈 대시보드(AI피드·캐릭터 애니메이션), 달력 월간/주간/일간, 감정 이모지 | 1~2세션 |
| 메시지 + 알림 | `module-4` | 단체채팅·1:1채팅, 응원 이모티콘, 알림 뱃지, 알림 목록 | 1세션 |
| 조르기 시스템 | `module-5` | 아이 요청, 부모 관리, 주 1회 제한, 횟수 리셋 | 1세션 |
| 캐릭터 + 레벨 | `module-6` | 인벤토리 UI, EXP 적립, 레벨업, 장비 해금, 세계관 배너 | 1~2세션 |
| 보상 + 통계 | `module-7` | 보상 히스토리(연도·월), 정산, 통계 차트, 경쟁 시스템 | 1~2세션 |
| 옵저버 + 배포 | `module-8` | 옵저버 시스템(11종), Cloud Functions, PWA manifest, Firebase Hosting 배포 | 1~2세션 |

#### Recommended Session Plan

| Session | Phase | Scope | 예상 대화 턴 |
|---------|-------|-------|:-----------:|
| Session 1 (지금) | Plan + Design | 전체 | ~35 ✅ |
| Session 2 | Do | `--scope module-0,module-1` | 40~50 |
| Session 3 | Do | `--scope module-2` | 40~50 |
| Session 4 | Do | `--scope module-3,module-4` | 40~50 |
| Session 5 | Do | `--scope module-5,module-6` | 40~50 |
| Session 6 | Do | `--scope module-7,module-8` | 40~50 |
| Session 7 | Check + Report | 전체 | 30~40 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-23 | 초안 작성 — Clean Architecture B 선택 | Family Quest Team |
