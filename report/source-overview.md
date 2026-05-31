# Family Quest — 전체 소스코드 개요 (External AI Review용)

> 생성일: 2026-05-30  
> 버전: v1.4.0  
> 목적: 외부 AI가 전체 구조를 한눈에 파악하고 코드 리뷰/개발 지원에 활용할 수 있도록 정리  
> Firebase 프로젝트: `family-quest-8b41b` / 배포 URL: `family-quest-8b41b.web.app`

---

## 0. 프로젝트 개요

**Family Quest** — 가족 4인 전용(아빠·엄마·하윤·서윤) 미션 보상 모바일 웹 PWA.  
아이들이 미션(퀘스트)에 참여하고, 부모가 날짜별로 평가·보상을 관리한다.

### 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript + Vite |
| 라우팅 | React Router v6 |
| 상태관리 | Zustand (5개 스토어) |
| 백엔드 | Firebase (Firestore + Anonymous Auth) |
| 스타일 | Tailwind CSS v3 + CSS Modules (pixel-theme.css) |
| 폰트 | Press Start 2P (픽셀), Pretendard (한글) |
| 배포 | Firebase Hosting + PWA |
| 빌드 | Vite (tsc 체크 없음, vite build만) |

### 아키텍처: Clean Architecture 4레이어

```
Presentation → Application → Domain ← Infrastructure

Presentation  src/presentation/   React 컴포넌트, 페이지, 훅
Application   src/application/    비즈니스 유스케이스
Domain        src/domain/         엔티티 타입, 도메인 서비스
Infrastructure src/infrastructure/ Firebase, Zustand 스토어
```

### 핵심 데이터 흐름

```
Firestore onSnapshot → Zustand Store → UI 컴포넌트 (단방향)
컴포넌트는 Store만 구독, Firestore 직접 접근 절대 금지
```

### 전역 구독 구조

```typescript
// AppLayout.tsx — 로그인 상태이면 항상 활성
useMissions()        // 전역 미션 구독 → missionStore 자동 갱신
useNotifications()   // 전역 알림 구독 → notificationStore 자동 갱신

// 개별 페이지에서 useMissions()/useNotifications() 중복 호출 금지
// 대신 useMissionStore()/useNotificationStore() 직접 읽기
```

---

## 1. Firestore 데이터 모델

### 컬렉션 구조

```
families/{familyId}/
  config/settings     familyCodeHash, joinCode, resetAt
  members/{id}        name, realName, loginId(선택), role, pinHash,
                      level, exp, character{characterId,petId,equipment,worldBanner},
                      beggingLeft, beggingWeek, isActive
  missions/{id}       title, description(선택), category, type, difficulty,
                      targetMemberIds, creatorId, rewards, status, statusHistory,
                      isSpecial(선택), slot_evaluations, confirmedByChild,
                      memberStatuses(레거시-미사용), childAccepted(레거시-미사용)
  rewards/{id}        missionId(null=수동/조르기), memberId, approvedBy,
                      rewardType, amount, customLabel(선택), source(선택),
                      isPaid, approvedAt
  messages/{id}       type(CHAT|CHEER|DM), senderId, receiverId(DM), content,
                      readBy(DM읽음처리)
  notifications/{id}  type, targetMemberId, content, relatedId, isRead
  notices/{id}        title, content, authorId, authorName, createdAt
  begging/{id}        submitterId, type, content, status, dadApproved, momApproved
  special_days/{id}   name, type, month, day, isLunar, emoji, deleted
  question_answers/{id} memberId, question, answer, emotion, reward, dateKey

family_codes/{code}           familyId, active       ← 루트 레벨 (가족 찾기)
member_login_ids/{loginId}    familyId, memberId     ← 루트 레벨 (개인 ID 로그인)
```

### 역할(Role) 체계

| DB Role | 표시명 | 권한 |
|---------|--------|------|
| `DAD` | 아빠 | Master — 마스터 패널 접근, 모든 관리 |
| `MOM` | 엄마 | Parent — 부모 관리 |
| `CHILD` | 하윤/서윤 | 미션 확인, EXP/레벨 시스템 |
| `OBSERVER` | 옵저버 | 열람+응원 전용 |

---

## 2. 파일 구조 전체 목록

### 2-1. 엔트리 포인트 & 설정

| 파일 | 역할 |
|------|------|
| `src/main.tsx` | React root render, 글로벌 스타일 임포트 |
| `src/App.tsx` | React Router 설정, 25개 라우트, SplashScreen, SessionRestorer |
| `src/types/index.ts` | 글로벌 타입 재내보내기 |
| `src/config/version.ts` | 앱 버전 상수 (`APP_VERSION`, `APP_VERSION_SHORT`) |
| `tailwind.config.js` | 커스텀 컬러(grass/dirt/gold/purple/pink 등), 폰트, 타이포 스케일, 박스 쉐도우 |
| `src/styles/globals.css` | Tailwind directives, 컴포넌트 레이어(.t-title/.t-heading/.btn-pixel/.card-pixel 등) |
| `src/styles/pixel-theme.css` | 픽셀 폰트 임포트(Press Start 2P, DotGothic16, Pretendard), 키프레임 애니메이션 |
| `vite.config.ts` | Vite + React 플러그인, PWA 설정 |
| `firestore.rules` | Firestore 보안 규칙 |
| `firestore.indexes.json` | Firestore 복합 인덱스 (DM 쿼리용) |

---

### 2-2. Domain Layer

#### `src/domain/entities/`

| 파일 | 주요 타입/상수 |
|------|---------------|
| `Member.ts` | `Member`, `Role`, `CharacterInfo`, `CHARACTER_UNLOCKS`, `PET_UNLOCKS`, `BANNER_UNLOCKS`, `DIFFICULTY_INFO` |
| `Mission.ts` | `Mission`, `MissionStatus`, `DaySlot`, `STATUS_LABEL`, `DIFFICULTY_INFO` |
| `Reward.ts` | `Reward`, `RewardType`, `REWARD_TYPE_LABELS` |
| `Message.ts` | `Message`, `Notification`, `NotificationType`, `NOTIF_ICONS` |
| `index.ts` | 배럴 내보내기 |

#### `src/domain/services/`

| 파일 | 역할 |
|------|------|
| `ExpCalc.ts` | EXP 임계값 테이블, 레벨 계산, 레벨업 감지 |
| `KoreanAge.ts` | 한국 나이 계산 (현재년도 - 출생년도 + 1), 생일 빌더 |

---

### 2-3. Infrastructure Layer

#### `src/infrastructure/firebase/`

| 파일 | 역할 |
|------|------|
| `config.ts` | Firebase 초기화, Firestore/Auth 인스턴스, 에뮬레이터 설정 |
| `auth.ts` | SHA-256 PIN 해시(crypto.subtle + JS 폴백), Anonymous Auth 세션 |
| `firestore.ts` | 범용 CRUD 래퍼 (`fsGet`, `fsAdd`, `fsUpdate`, `fsDelete`, `fsSet`), 에러 매핑, 타임아웃 처리 |

#### `src/infrastructure/firebase/collections/`

| 파일 | 역할 | 주요 함수 |
|------|------|-----------|
| `members.ts` | 멤버 CRUD, 구독 | `subscribeMembers`, `getMember`, `updateMember`, `saveCharacter` |
| `missions.ts` | 미션 CRUD, 구독 | `subscribeMissions`, `createMission`, `updateDaySlot`, `removeDaySlot`, `confirmQuestByChild`, `deleteMission` |
| `rewards.ts` | 보상 기록 | `sendManualReward`, `subscribeRewards` |
| `messages.ts` | 그룹채팅, DM | `subscribeGroupChat`, `subscribeDirectChat`, `sendDirectMessage`, `deleteMessage`, `markDMRead` |
| `notifications.ts` | 알림 생성·구독 | `subscribeNotifications`, `createNotification`, `markAllRead` |
| `begging.ts` | 조르기 요청 | `submitBegging`, `approveBegging`, `rejectBegging` |
| `familyCodes.ts` | 가족 코드 조회 | `findFamilyByCode` |
| `notices.ts` | 공지사항 | `subscribeNotices`, `createNotice`, `deleteNotice` |
| `questionAnswers.ts` | 두근두근 질문함 | `submitQuestionAnswer`, `subscribeQuestionAnswers` |
| `specialDays.ts` | 기념일·생일 | `subscribeSpecialDays`, `createSpecialDay`, `deleteSpecialDay` |

#### `src/infrastructure/stores/` (Zustand)

| 스토어 | 상태 | 주요 메서드 |
|--------|------|------------|
| `authStore.ts` | currentMember, familyId, pinLock | setCurrentMember, clearSession, isPinLocked, incrementPinFail |
| `missionStore.ts` | missions[], loading | setMissions, getMissionById |
| `messageStore.ts` | messages[], unreadGroupCount | setMessages, setUnreadGroupCount |
| `notificationStore.ts` | notifications[], unreadCount | setNotifications, markRead |
| `rewardStore.ts` | rewards[] | setRewards |
| `uiStore.ts` | modal 상태, 필터 | (UI 상태 관리) |

---

### 2-4. Application Layer

#### `src/application/use-cases/auth/`

| 파일 | 역할 |
|------|------|
| `login.ts` | PIN 검증 (SHA-256 해시 비교), 멤버 조회, 로그인 처리 |
| `signUp.ts` | 역할 기반 가입 (DAD가 familyId 생성, 나머지는 기존 family에 참여), 4인 제한 |
| `observerLogin.ts` | 비회원 게스트 접근, 전화번호 기반 임시 세션 |

#### `src/application/use-cases/missions/`

| 파일 | 역할 |
|------|------|
| `createMission.ts` | 미션 생성, 대상 아이들+부모 전원에게 NEW_MISSION 알림 발송 |
| `completeMission.ts` | 아이 완료 요청 → MISSION_CONFIRMED 알림 발송 |
| `approveMission.ts` | 부모 승인/거절/보류 처리, EXP 부여, 레벨업 감지 |
| `respondMission.ts` | 아이 미션 수락/거절 |

#### `src/application/use-cases/characters/`

| 파일 | 역할 |
|------|------|
| `selectCharacter.ts` | 캐릭터(직업 50종) 해금 시스템 (레벨 게이트), 펫 50종, 배너, 장비, `CHARACTER_LABELS` 상수 |

#### `src/application/use-cases/rewards/`

| 파일 | 역할 |
|------|------|
| `grantReward.ts` | 보상 생성, EXP 계산, 레벨업 감지 |

#### `src/application/use-cases/begging/`

| 파일 | 역할 |
|------|------|
| `submitBegging.ts` | 주간 조르기 요청, 레벨별 횟수 제한 (3 + level - 1) |

---

### 2-5. Presentation Layer — Hooks

| 파일 | 역할 |
|------|------|
| `hooks/useAuth.ts` | currentMember, familyId, isLoggedIn, logout 래퍼 |
| `hooks/useMissions.ts` | 전역 Firestore 미션 구독 + autoExpire() (기간 만료 자동 처리) |
| `hooks/useNotifications.ts` | 전역 알림 구독, unreadCount 관리 |
| `hooks/useMessages.ts` | 그룹채팅 구독 |
| `hooks/useRewards.ts` | 보상 목록 구독 |

---

### 2-6. Presentation Layer — Components

#### `src/presentation/components/layout/`

| 파일 | 역할 |
|------|------|
| `AppLayout.tsx` | 앱 래퍼, 30분 자동 로그아웃, `useMissions()`+`useNotifications()` 전역 구독 |
| `Header.tsx` | 고정 상단 헤더(52px), LOGO_VARIANTS 5분 변환, 알림/설정 드롭다운 |
| `BottomNav.tsx` | 고정 하단 탭(60px), 5탭(⛏️⚔️📅💌🏆), gold glow 활성, 빨간 콩 배지 |
| `ProtectedRoute.tsx` | 로그인 체크, SessionRestorer, 비로그인 시 /login 리다이렉트 |

#### `src/presentation/components/pixel/`

| 파일 | 역할 | variants/props |
|------|------|----------------|
| `PixelButton.tsx` | 범용 버튼 | primary/gold/danger/ghost/success/sky × sm/md/lg × korean/pixel |
| `PixelCard.tsx` | 카드 컨테이너 | padding: none/sm/md/lg |
| `ExpBar.tsx` | EXP 프로그레스 바 | level, currentExp, maxExp |
| `SpeechBubble.tsx` | 말풍선 다이얼로그 | direction, children |

#### `src/presentation/components/character/`

| 파일 | 역할 |
|------|------|
| `CharacterSprite.tsx` | 캐릭터 이모지 렌더러, 역할 배경색, 직업 배지. `PetSprite`도 포함. `PET_EMOJI`는 `PET_UNLOCKS`에서 자동 생성(하드코딩 금지) |
| `InventoryGrid.tsx` | 캐릭터 해금 목록 그리드(직업/펫/배너/장비) |

#### `src/presentation/components/missions/`

| 파일 | 역할 |
|------|------|
| `MissionCard.tsx` | 미션 카드(STATUS_INFO, 특별퀘스트 금테두리, description 2줄 표시) |
| `StatusBadge.tsx` | 상태 배지 칩 |

#### `src/presentation/components/animations/`

| 파일 | 역할 |
|------|------|
| `SplashScreen.tsx` | 앱 최초 로딩 화면 |
| `LoginAnimation.tsx` | 로그인 화면 장식 애니메이션 |

#### `src/presentation/components/charts/`

| 파일 | 역할 |
|------|------|
| `PixelBarChart.tsx` | 가로/세로 막대 차트 (통계 페이지용) |

#### `src/presentation/components/calendar/`

| 파일 | 역할 |
|------|------|
| `CalendarEmoji.ts` | 달력 날짜 슬롯 이모지 매퍼 (GOOD/BAD/HOLD) |

---

### 2-7. Presentation Layer — Pages

#### 인증 (`src/presentation/pages/auth/`)

| 파일 | 라우트 | 역할 | 주요 로직 |
|------|--------|------|-----------|
| `LoginPage.tsx` | `/login` | 로그인 (landing→characters, 신규기기→family-id-input) | PIN 검증, MasterPanel(SETTING), MASTER_LOGIN_ID='kye', PIN잠금 카운트다운 |
| `RegisterPage.tsx` | `/register` | 가입 | 역할 선택 → 캐릭터 선택 → PIN 설정, DAD=familyId 생성 |
| `ObserverLoginPage.tsx` | `/observer-login` | 비회원 접근 | 전화번호 → 임시 세션 |

**LoginPage 중요 상수:**
```typescript
const MASTER_ID = 'kye'       // 마스터 패널 ID
const MASTER_PW = '1111'      // 마스터 패널 PW
const MASTER_LOGIN_ID = 'kye' // 신규 기기 자동 familyId 탐지 앵커
```

#### 홈 (`src/presentation/pages/home/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `HomePage.tsx` | `/home` | 역할별 대시보드 (캐릭터/EXP/레벨/최근 활동 10개/공지사항) |
| `QuestionBalloon.tsx` | (인라인) | 아이 홈 📝 풍선 (일 1회 두근두근 질문) |

**알림 필터 규칙 (홈 피드):**
- NEW_MESSAGE 제외
- 아이는 BEGGING_REQUEST 제외
- 최대 10개, relatedId+type 중복 제거

#### 미션 (`src/presentation/pages/missions/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `MissionListPage.tsx` | `/missions` | 탭(전체/공동/개별), 즐겨찾기 우선 정렬, 개별탭→아이별 서브탭 |
| `MissionDetailPage.tsx` | `/missions/:id` | Daily Slot G/B/H 평가, 아이별 날짜 탭, `useMissionStore(state => state.missions.find(m => m.id === id))` 셀렉터 |
| `MissionFormPage.tsx` | `/missions/new`, `/missions/:id/edit` | 미션 생성/수정, isSpecial 토글(빨간), description textarea |
| `ApprovalListPage.tsx` | `/missions/approvals` | 부모 승인 대기 목록 |

#### 달력 (`src/presentation/pages/calendar/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `CalendarPage.tsx` | `/calendar` | 월간/주간/일간 뷰, **기념일·생일만 표시** (미션 표시 없음) |

#### 메시지 (`src/presentation/pages/messages/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `MessagesPage.tsx` | `/messages` | 그룹채팅 + 1:1 DM, 읽음 처리(✓✓), 메시지 삭제, 스크롤: `containerRef.scrollTop = scrollHeight` (scrollIntoView 금지) |

#### 보상 (`src/presentation/pages/rewards/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `RewardStatusPage.tsx` | `/rewards` | 당월 총합 + 종류별 합계 + 출처 배지(미션/수동/조르기) |
| `StatisticsPage.tsx` | `/rewards/statistics` | 가족 통계, PixelBarChart |

#### 조르기 (`src/presentation/pages/begging/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `BeggingPage.tsx` | `/begging` | 아이 조르기 제출 |
| `BeggingManagePage.tsx` | `/begging/manage` | 부모 승인/거절, 양쪽 승인 시 rewards 컬렉션 자동 기록 |

#### 프로필 (`src/presentation/pages/profile/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `ProfilePage.tsx` | `/profile` | PIN 변경, 캐릭터/펫/배너 선택, `location.state.panel`로 탭 자동 오픈 |

#### 알림 (`src/presentation/pages/notifications/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `NotificationsPage.tsx` | `/notifications` | 전체 알림 목록, 클릭 네비게이션, NOTIF_ICONS 매핑 |

#### 설정 (`src/presentation/pages/settings/`)

| 파일 | 라우트 | 권한 |
|------|--------|------|
| `SettingsPage.tsx` | `/settings` | 부모 공통 설정 허브 |
| `MasterSettingsPage.tsx` | `/settings/master` | DAD 전용 마스터 패널 (loginId 설정, 앱 초기화) |
| `RewardSendPage.tsx` | `/settings/rewards-send` | 부모 수동 보상 발송 |
| `NoticesPage.tsx` | `/settings/notices` | 공지사항 관리 |
| `SpecialDaysPage.tsx` | `/settings/special-days` | 기념일·생일 관리 |
| `QuestionAnswersPage.tsx` | `/settings/question-answers` | 두근두근 답변 목록 (부모 전용) |
| `QuestionBoxPage.tsx` | `/settings/questions` | 질문 전체 목록 |
| `RewardTypesPage.tsx` | `/settings/reward-types` | 보상 종류 관리 |

---

## 3. 핵심 규칙 & 패턴

### 3-1. 코딩 규칙 (반드시 준수)

```typescript
// 1. Firestore 접근은 반드시 infrastructure/firebase/ 헬퍼 경유
// 2. petId 저장: updateMember(..., { 'character.petId': petId }) — dot notation 직접
//    characterId / worldBanner: saveCharacter(newChar) — 전체 객체 교체
// 3. 팝업: fixed inset-0 z-[9999] flex items-center justify-center
// 4. 버튼: type="button" 명시
// 5. 새 MissionStatus 추가 시 5개 파일 STATUS 맵 동시 업데이트
// 6. 새 Notification 타입 추가 시 Message.ts + NOTIF_ICONS + 홈 피드 필터 모두 업데이트
// 7. PetSprite 이모지는 PET_UNLOCKS에서 자동 생성 — 하드코딩 금지
// 8. 채팅 스크롤: containerRef.scrollTop = scrollHeight (scrollIntoView 금지)
// 9. 앱 초기화: deleteAllFamilyData() → signOut() → clearAllLocalData() 순서 필수
// 10. MissionDetailPage: useMissionStore(state => state.missions.find(m => m.id === id)) 셀렉터 사용
// 11. 멤버 이름: subscribeMembers()로 실시간 구독 — localStorage 캐시 직접 읽기 금지
// 12. 날짜 슬롯: slot_evaluations.{memberId}.{dateKey} 형태로 Firestore 저장
// 13. loginId 저장: fsSet() 사용 — fsUpdate()는 문서 없으면 실패
// 14. 페이지 컴포넌트에서 useMissions()/useNotifications() 직접 호출 금지
// 15. 보상 기록 생성: sendManualReward() 사용. missionId=null이면 수동/조르기로 분류
// 16. 달력에서 미션 데이터 사용 금지 — 기념일/생일(special_days)만 표시
// 17. 1:1 DM 전송: sendDirectMessage() 사용 (sendMessage receiverId=null은 그룹전용)
// 18. subscribeDirectChat: 양방향 병합 — sent/received 두 구독 후 createdAt 정렬
```

### 3-2. localStorage 키

| 키 | 내용 |
|----|------|
| `familyId` | 현재 가족 ID |
| `fq_last_login` | 마지막 로그인 멤버 ID |
| `fq_login_at` | 로그인 타임스탬프 (ms) |
| `fq_member_cache` | 멤버 목록 JSON 캐시 |
| `fq_snapshots` | 롤백 스냅샷 (최대 5) |
| `fq_fav_order` | 미션 즐겨찾기 순서 |
| `fq_weekly_comp` | 주간 경쟁 ON/OFF |
| `fq_monthly_comp` | 월간 경쟁 ON/OFF |

### 3-3. 알림 타입 & 발송 정책

| 타입 | 발송 조건 | 대상 |
|------|---------|------|
| `NEW_MISSION` | 퀘스트 생성 | 대상 아이들 + 부모 전원 |
| `MISSION_CONFIRMED` | 아이 확인 버튼 누름 | 부모 전원 |
| `BEGGING_REQUEST` | 조르기 제출 | 부모 전원 |
| `BEG_RESULT` | 조르기 결과 | 신청 아이 |
| `NEW_MESSAGE` | DM 수신 | 수신자 |

### 3-4. 알림 클릭 네비게이션

```typescript
BEGGING_REQUEST/BEG_RESULT → /begging/manage (부모) / /begging (아이)
MISSION 관련 → /missions/{relatedId} (없으면 /missions)
CHEER/NEW_MESSAGE → /messages
```

---

## 4. 현재 알려진 기술 부채 (Tech Debt)

### 4-1. 코드 중복 (중요도 높음)

| 항목 | 현재 상태 | 개선안 |
|------|-----------|-------|
| `getMemberName()` | HomePage, MessagesPage, NotificationsPage 3곳 중복 구현 | `useMembers()` 훅으로 통합 |
| `STATUS_INFO/LABEL` | 5개 파일 각자 정의 | `Mission.ts` 단일 소스 |
| `formatRewards()` | MissionCard, MissionDetailPage 각자 구현 | `Mission.ts`로 이동 |
| 팝업 패턴 | 3종 혼재 (z-index 제각각) | PixelModal 단일 컴포넌트 |
| 입력 필드 스타일 | 파일마다 다른 className | globals.css `.input-pixel` 통일 |

### 4-2. TS6133 미사용 import 경고

전체 30+ 개. 빌드는 통과하나(vite build, tsc 체크 없음) 코드 품질 저하.

### 4-3. 레거시 Firestore 필드

```typescript
// missions 컬렉션에 잔재하는 미사용 필드
memberStatuses: Record<string, string>   // 레거시 — 쿼리에서 제외해야 함
childAccepted: boolean                   // 레거시 — 쿼리에서 제외해야 함
```

### 4-4. 규칙 위반 (localStorage 직접 접근)

```typescript
// HomePage.tsx getMemberName() — localStorage 직접 읽기 (규칙 11 위반)
// subscribeMembers() 훅으로 교체 필요
const raw = localStorage.getItem('fq_member_cache')  // 이렇게 직접 접근 중
```

### 4-5. PixelButton 미사용

절반 이상의 페이지가 PixelButton 대신 raw `<button className="...">` 직접 사용.  
스타일이 일관성 없어지는 주요 원인.

### 4-6. `InventoryGrid.tsx`

CharacterSprite 내부에 인라인으로도 처리할 수 있는 로직이 별도 파일로 분리되어 있음.  
ProfilePage에서만 사용 — 통합 검토 대상.

---

## 5. 배포 & 빌드

### 명령어

```bash
npm run dev          # 개발 서버 (로컬망 전체 허용, 0.0.0.0)
npm run build        # vite build만 실행 (tsc 체크 없음)
npm run deploy       # scripts/bump-version.mjs → 버전 0.1 증가 → build → firebase deploy
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
```

### 버전 관리

`src/config/version.ts` → `scripts/bump-version.mjs`가 자동으로 0.1씩 증가  
(1.2 → 1.3 → ... → 1.9 → 2.0)

---

## 6. 통계 요약

| 항목 | 수량 |
|------|------|
| 총 소스 파일 | ~85개 |
| 페이지 컴포넌트 | 25개 |
| UI 컴포넌트 | 16개 |
| 유스케이스 | 10개 |
| 도메인 엔티티 | 5개 |
| Firebase 컬렉션 헬퍼 | 11개 |
| Zustand 스토어 | 6개 |
| Presentation 훅 | 5개 |
| 도메인 서비스 | 2개 |
| Firestore 컬렉션 | 11개 |
| 라우트 | 25개 |

---

*Family Quest Source Overview v1.4.0 — 2026-05-30*  
*외부 AI 코드 리뷰 및 개발 지원용 전체 소스 인벤토리*
