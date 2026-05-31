# Family Quest — 전체 소스코드 개요 (External AI Review용)

> 최초 작성: 2026-05-30 | **마지막 업데이트: 2026-05-31 (Session 29 완료)**  
> **현재 버전: v2.2.0** (이전: v2.1.0 → Session 29 수술 후 2.2.0 자동 증가)  
> 목적: 외부 AI가 전체 구조를 한눈에 파악하고 코드 리뷰/개발 지원에 활용  
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
| 상태관리 | Zustand (6개 스토어 + userInventoryStore) |
| 백엔드 | Firebase (Firestore + Anonymous Auth) |
| 스타일 | Tailwind CSS v3 + globals.css (MC Dark 컴포넌트 레이어) |
| 폰트 | Press Start 2P (픽셀), Pretendard (한글), DotGothic16 (로그인 타이틀) |
| 오디오 | Web Audio API 전용 — 외부 MP3 없음, OscillatorNode 합성 |
| 배포 | Firebase Hosting + PWA (Workbox) |
| 빌드 | Vite (tsc 체크 없음, vite build만) |

### 아키텍처: Clean Architecture 4레이어

```
Presentation → Application → Domain ← Infrastructure

Presentation   src/presentation/    React 컴포넌트, 페이지, 훅
Application    src/application/     비즈니스 유스케이스
Domain         src/domain/          엔티티 타입, 도메인 서비스
Infrastructure src/infrastructure/  Firebase, Zustand 스토어, 오디오
```

### 핵심 데이터 흐름

```
Firestore onSnapshot → Zustand Store → UI 컴포넌트 (단방향)
컴포넌트는 Store만 구독, Firestore 직접 접근 절대 금지

예외: userInventoryStore — localStorage 영속 (Firestore 비사용)
      audioManager — Web Audio API 싱글톤 (Firestore 비사용)
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
                      readBy(DM읽음처리), reactions(Record<emoji, memberIds[]>)
  notifications/{id}  type, targetMemberId, content, relatedId, isRead
  notices/{id}        title, content, authorId, authorName, createdAt
  begging/{id}        submitterId, type, content, status, dadApproved, momApproved
  special_days/{id}   name, type, month, day, isLunar, emoji, deleted
  question_answers/{id} memberId, question, answer, emotion, reward, dateKey
  game_scores/{id}    memberId, memberName, gameId('galaga'|'ponpoko'|'minesweeper'),
                      score, playedAt
  tournament_scores/{id} roundNumber, memberId, memberName, gameId, score, playedAt
  praise_stickers/{id}  senderId, senderName, targetMemberId, sticker(8종), memo, createdAt
  cheer_messages/{id}   senderId, senderName, targetMemberId, content, isRead, createdAt
  config/tournament   active, title, roundNumber, startDate, endDate, difficulty(1-5)

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
| `src/config/version.ts` | `APP_VERSION='2.2.0'`, `APP_VERSION_SHORT='VER2.2'` |
| `tailwind.config.js` | 커스텀 컬러(panel-darkest/dark/mid/surface/border/sub + grass/gold/purple/pink 등) |
| `src/styles/globals.css` | MC Dark 컴포넌트 레이어 (.t-title/.t-heading/.btn-pixel/.card-pixel/.speech-bubble/.inventory-slot 등) |
| `src/styles/pixel-theme.css` | 픽셀 폰트 임포트, 키프레임 애니메이션 (card-special 황금 네온 펄스 포함) |
| `vite.config.ts` | Vite + React 플러그인, PWA 설정 |
| `firestore.rules` | Firestore 보안 규칙 (member_login_ids 포함) |
| `firestore.indexes.json` | DM 쿼리용 복합 인덱스 |

---

### 2-2. Domain Layer

#### `src/domain/entities/`

| 파일 | 주요 타입/상수 |
|------|---------------|
| `Member.ts` | `Member`, `Role`, `CharacterInfo`, `CHARACTER_UNLOCKS`, `PET_UNLOCKS`, `BANNER_UNLOCKS`, `DIFFICULTY_INFO` |
| `Mission.ts` | `Mission`, `MissionStatus`(ACTIVE/EXPIRED/CHILD_REJECTED), `DaySlot`(GOOD/BAD/HOLD), `STATUS_LABEL`, `DIFFICULTY_INFO` |
| `Reward.ts` | `Reward`, `RewardType`, `REWARD_TYPE_LABELS` |
| `Message.ts` | `Message`, `Notification`, `NotificationType`(NEW_MISSION/MISSION_CONFIRMED/MISSION_EXPIRED/MOM_CHEER/BEGGING_REQUEST/BEG_RESULT/NEW_MESSAGE), `reactions?: Record<string, string[]>` |
| `index.ts` | 배럴 내보내기 |

#### `src/domain/services/`

| 파일 | 역할 |
|------|------|
| `ExpCalc.ts` | EXP 임계값 테이블, 레벨 계산, 레벨업 감지 |
| `KoreanAge.ts` | 한국 나이 계산, 생일 빌더 |

---

### 2-3. Infrastructure Layer

#### `src/infrastructure/firebase/`

| 파일 | 역할 |
|------|------|
| `config.ts` | Firebase 초기화, Firestore/Auth 인스턴스 |
| `auth.ts` | SHA-256 PIN 해시(crypto.subtle + JS 폴백), Anonymous Auth 세션 |
| `firestore.ts` | 범용 CRUD 래퍼 (`fsGet`, `fsAdd`, `fsUpdate`, `fsDelete`, `fsSet`), 에러 매핑 |

#### `src/infrastructure/firebase/collections/`

| 파일 | 역할 | 주요 함수 |
|------|------|-----------|
| `members.ts` | 멤버 CRUD, 구독 | `subscribeMembers`, `getMember`, `updateMember`, `saveCharacter` |
| `missions.ts` | 미션 CRUD, 구독 | `subscribeMissions`, `createMission`, `updateDaySlot`, `removeDaySlot`, `confirmQuestByChild`, `deleteMission` |
| `rewards.ts` | 보상 기록 | `sendManualReward`, `subscribeRewards` |
| `messages.ts` | 그룹채팅, DM | `subscribeGroupChat`, `subscribeDirectChat`, `sendDirectMessage`, `deleteMessage`, `markDMRead`, `toggleReaction` |
| `notifications.ts` | 알림 생성·구독 | `subscribeNotifications`, `createNotification`, `markAllRead` |
| `begging.ts` | 조르기 요청 | `submitBegging`, `approveBegging`, `rejectBegging` |
| `familyCodes.ts` | 가족 코드 조회 | `findFamilyByCode` |
| `notices.ts` | 공지사항 | `subscribeNotices`, `createNotice`, `deleteNotice` |
| `questionAnswers.ts` | 두근두근 질문함 | `submitQuestionAnswer`, `subscribeQuestionAnswers` |
| `specialDays.ts` | 기념일·생일 | `subscribeSpecialDays`, `createSpecialDay`, `deleteSpecialDay` |
| `gameScores.ts` | 게임 점수 | `saveGameScore`, `subscribeAllGameScores` (GameId: 'galaga'\|'ponpoko'\|'minesweeper') |
| `tournament.ts` | 주간 대회 | `subscribeTournamentSettings`, `saveTournamentScore`, `subscribeTournamentScores` |
| `cheerMessages.ts` | 격려 팝업 | `sendCheerMessage`, `subscribeUnreadCheers`, `markCheerRead` |
| `praiseStickers.ts` | 칭찬 스티커 | `sendPraiseSticker`, `subscribePraiseStickers` (StickerType 8종) |

#### `src/infrastructure/stores/` (Zustand)

| 스토어 | 상태 | 주요 메서드 |
|--------|------|------------|
| `authStore.ts` | currentMember, familyId, pinLock | `setCurrentMember`, `clearSession`, `isPinLocked`, `incrementPinFail` |
| `missionStore.ts` | missions[], loading | `setMissions`, `getMissionById` |
| `messageStore.ts` | messages[], unreadGroupCount | `setMessages`, `setUnreadGroupCount` |
| `notificationStore.ts` | notifications[], unreadCount | `setNotifications`, `markRead` |
| `rewardStore.ts` | rewards[] | `setRewards` |
| `userInventoryStore.ts` | currentSkin/Weapon/Bg/Pet, gameXP, totalEarnedXP, owned배열 | `setSkin`, `setWeapon`, `setBg`, `setPet`, `addGameXP`, `spendXP`, `unlockItem`, `getXPLevel` |

**userInventoryStore 특이사항:**
- localStorage 영속 (Firestore 비사용), 키: `fq_inv_*`
- `SKIN_CATALOG`(8종) / `BG_CATALOG`(8종) / `PET_SHOP_CATALOG`(8종) / `WEAPON_CATALOG`(3종) 카탈로그 상수 내장
- `getXPLevel(totalEarnedXP)`: 1000 XP = Lv.1 스케일
- `addGameXP(score)`: 100점당 1 XP 적립
- RAF 루프 내 동기 접근: `useInventoryStore.getState().currentWeapon`

#### `src/infrastructure/audio/`

| 파일 | 역할 |
|------|------|
| `audioManager.ts` | 싱글톤 Web Audio BGM+SFX 엔진. BGM 4테마(DEFAULT/JOYFUL/CALM/MUTE), SFX 12종. `localStorage.fq_bgm_theme` 영속 |

**BGM 테마:**
- `DEFAULT`: C 장조 120BPM square wave 아르페지오
- `JOYFUL`: G 장조 160BPM square wave 세가 감성
- `CALM`: A 단조 68BPM triangle wave 야간 플러크
- `MUTE`: 전체 음소거

**SFX 함수:** `shoot`, `explosion`, `playerHit`, `rotate`, `hardDrop`, `lineClear(n)`, `jump`, `coinCollect`, `gameOver`, `missionConfirm`, `slotApproval`, `rewardPayout`, `loginIntro`, `keyClick`, `loginFanfare`, `startAfterLogin`, `mineOpen`, `mineFlag`, `mineBoom`, `mineWin`

---

### 2-4. Application Layer

#### `src/application/use-cases/auth/`

| 파일 | 역할 |
|------|------|
| `login.ts` | PIN 검증 (SHA-256 해시 비교), 멤버 조회, 로그인 처리 |
| `signUp.ts` | 역할 기반 가입 (DAD가 familyId 생성), 4인 제한 |
| `observerLogin.ts` | 비회원 게스트 접근 |

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
| `selectCharacter.ts` | 캐릭터(직업 50종) 해금 시스템, 펫 50종, 배너, `CHARACTER_LABELS`, `CHARACTER_EMOJI`, `BANNER_BG` 매핑 |

#### `src/application/use-cases/rewards/`

| 파일 | 역할 |
|------|------|
| `grantReward.ts` | 보상 생성, EXP 계산, 레벨업 감지 |

#### `src/application/use-cases/begging/`

| 파일 | 역할 |
|------|------|
| `submitBegging.ts` | 주간 조르기, 레벨별 횟수 제한 (3 + level - 1) |

---

### 2-5. Presentation Layer — Hooks

| 파일 | 역할 |
|------|------|
| `hooks/useAuth.ts` | currentMember, familyId, isLoggedIn, logout 래퍼 |
| `hooks/useMissions.ts` | 전역 Firestore 미션 구독 + `autoExpire()` (기간 만료 → EXPIRED + 부모 MISSION_EXPIRED 알림) |
| `hooks/useNotifications.ts` | 전역 알림 구독, unreadCount 관리 |
| `hooks/useMessages.ts` | 그룹채팅 구독 |
| `hooks/useRewards.ts` | 보상 목록 구독 |
| `hooks/useMembers.ts` | `subscribeMembers` + `getMemberName` 단일 소스 훅 (localStorage 직접 접근 금지) |

---

### 2-6. Presentation Layer — Components

#### `src/presentation/components/layout/`

| 파일 | 역할 |
|------|------|
| `AppLayout.tsx` | bg-panel-dark 앱 래퍼, 30분 자동 로그아웃, `useMissions()`+`useNotifications()` 전역 구독, currentMember 변경 시 `startAfterLogin()` BGM 자동 재생 |
| `Header.tsx` | bg-panel-darkest 고정 헤더(52px), 미니 오디오 플레이어(▶/⏸ + 무드 순환 + 셀렉터 팝업), 알림/설정 드롭다운 |
| `BottomNav.tsx` | bg-panel-darkest 고정 하단(60px), 6탭(⛏️⚔️📅💌🏆🎮), gold glow 활성, 빨간 콩 배지 |
| `ProtectedRoute.tsx` | 로그인 체크, SessionRestorer, /login 리다이렉트 |

#### `src/presentation/components/pixel/`

| 파일 | 역할 | variants/props |
|------|------|----------------|
| `PixelButton.tsx` | 범용 버튼 | gold/purple/ghost/danger/success/sky/hold × sm/md/lg × korean/pixel, `disabled={saving}` 지원 |
| `PixelCard.tsx` | 카드 컨테이너 | variant: dark/special/highlight/light, padding: none/sm/md/lg |
| `PixelModal.tsx` | 공통 팝업 | **`open: boolean` 필수**, onClose, title, size(sm/md/lg). `fixed inset-0 z-[9999]` 내장 |
| `ExpBar.tsx` | EXP 프로그레스 바 | level, currentExp, maxExp |
| `SpeechBubble.tsx` | 말풍선 다이얼로그 | direction, children |

#### `src/presentation/components/character/`

| 파일 | 역할 |
|------|------|
| `CharacterSprite.tsx` | 캐릭터 이모지 렌더러(직업/역할 배경/무기 레이어 오버레이). `PetSprite`(bounce prop)도 포함. `LEGACY_EMOJI_TO_*` 역방향 딕셔너리 + `normalizeCharId/Weapon/PetId` 안전장치 내장 |
| `InventoryGrid.tsx` | 캐릭터 해금 목록 그리드. `SLOT_SELECTED/UNLOCKED/LOCKED` 상수 사용 (inventory-slot CSS 연계) |

#### `src/presentation/components/missions/`

| 파일 | 역할 |
|------|------|
| `MissionCard.tsx` | PixelCard variant="special"(특별퀘스트 황금 네온 펄스) / "dark"(일반). text-cream/panel-sub 텍스트 |
| `StatusBadge.tsx` | 상태 배지 단일 컴포넌트 (ACTIVE/EXPIRED/CHILD_REJECTED 등) |

#### `src/presentation/components/home/` (Session 27 신규)

| 파일 | 역할 |
|------|------|
| `CheerOverlay.tsx` | 부모 격려 전체 오버레이 팝업 (자녀 홈에서만 마운트). `cheer_messages` 실시간 구독, 읽음 처리 후 소멸 |
| `PraiseWhiteboard.tsx` | 칭찬 스티커 화이트보드. 8종 스티커 포스트잇 배치, 9개 초과 → PixelModal 더보기 |

#### `src/presentation/components/animations/`

| 파일 | 역할 |
|------|------|
| `SplashScreen.tsx` | 앱 최초 로딩 화면 |
| `LoginAnimation.tsx` | 로그인 화면 장식 애니메이션 |

---

### 2-7. Presentation Layer — Pages

#### 인증 (`src/presentation/pages/auth/`)

| 파일 | 라우트 | 핵심 로직 |
|------|--------|-----------|
| `LoginPage.tsx` | `/login` | 대형 캐릭터 카드(2×2) → 탭 시 PIN 뷰 전환. NumPad 컴포넌트. 오디오: FAMILY LOGIN→intro, 카드탭→keyClick, PIN성공→fanfare+BGM. `MASTER_ID='kye'`, `MASTER_PW='1111'` |
| `RegisterPage.tsx` | `/register` | 역할 선택 → 캐릭터 선택 → PIN 설정 |
| `ObserverLoginPage.tsx` | `/observer-login` | 비회원 임시 세션 |

#### 홈 (`src/presentation/pages/home/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `HomePage.tsx` | `/home` | 역할별 대시보드. 프로필 카드(장착 무기 배지 포함). "📰 패밀리 늬우스"(최대 10개, 알림 타입별 아이콘). 공지사항 아코디언. CheerOverlay(자녀만). PraiseWhiteboard. 가족 랜덤 응원 말풍선(자녀 화면, 35초 간격) |

#### 미션 (`src/presentation/pages/missions/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `MissionListPage.tsx` | `/missions` | 탭(전체/공동/개별), 즐겨찾기 우선 정렬, 개별탭→아이별 서브탭 |
| `MissionDetailPage.tsx` | `/missions/:id` | Daily Slot G/B/H 평가, 아이별 날짜 탭, `useMissionStore(state => state.missions.find(m => m.id === id))` 셀렉터 |
| `MissionFormPage.tsx` | `/missions/new`, `/missions/:id/edit` | isSpecial 빨간 토글, description textarea, INPUT_CLS/TEXTAREA_CLS/SELECT_CLS 상수 |
| `ApprovalListPage.tsx` | `/missions/approvals` | 부모 승인 대기 목록 |

#### 달력 (`src/presentation/pages/calendar/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `CalendarPage.tsx` | `/calendar` | 월간/주간/일간 뷰. **기념일·생일(special_days)만 표시 — 미션 데이터 사용 금지**. 하단 하이브리드 타임라인(D-Day 카운터 + 더보기 PixelModal). inventory-slot !w-full aspect-square 패턴 |

#### 메시지 (`src/presentation/pages/messages/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `MessagesPage.tsx` | `/messages` | 그룹채팅(bg-sky 탭) + 1:1 DM(bg-pink 탭). speech-bubble + `getBubbleBorderCls(role,id)` 역할별 border. ReactionPicker(롱프레스 480ms, 5종 이모지) + ReactionChips. DM 파트너 앵커 헤더. `containerRef.scrollTop = scrollHeight` |

#### 보상 (`src/presentation/pages/rewards/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `RewardStatusPage.tsx` | `/rewards` | 상단 아이탭[전체/하윤/서윤] + 연도/월 화살표 패널 + 당월 총합 card-highlight + 출처 배지(미션/수동/조르기) |
| `StatisticsPage.tsx` | `/rewards/statistics` | 가족 통계, PixelBarChart |

#### 조르기 (`src/presentation/pages/begging/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `BeggingPage.tsx` | `/begging` | 아이 조르기 제출. PixelModal 전송 완료 팝업 |
| `BeggingManagePage.tsx` | `/begging/manage` | 부모 승인/거절, 양쪽 승인 시 rewards 컬렉션 자동 기록 |

#### 프로필 (`src/presentation/pages/profile/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `ProfilePage.tsx` | `/profile` | PIN 변경 패널. **XP 상점 4탭(👕직업·🖼️배경·🐱펫·⚔️무기) 인벤토리 슬롯 그리드**. 좌측 실시간 아바타 프리뷰(CharacterSprite + weapon). 구매 확인 PixelModal(`open={!!buyTarget}`). `handleEquip`: 스토어→updatedCharacter 4필드 교차머지→Firebase→`setCurrentMember` 4단 파이프라인. `location.state.panel`로 캐릭터/펫/배너 탭 자동 오픈 |

#### 알림 (`src/presentation/pages/notifications/`)

| 파일 | 라우트 | 역할 |
|------|--------|------|
| `NotificationsPage.tsx` | `/notifications` | 전체 알림 목록, NOTIF_ICONS 매핑, 클릭 네비게이션 |

#### 설정 (`src/presentation/pages/settings/`)

| 파일 | 라우트 | 권한 |
|------|--------|------|
| `SettingsPage.tsx` | `/settings` | 부모 공통. 📌 칭찬 스티커 발송 패널 + 💖 원터치 응원 발송 패널 |
| `MasterSettingsPage.tsx` | `/settings/master` | DAD 전용. loginId 설정, 앱 초기화, 🏆 주간 대회 제어판(토글/제목/날짜/난이도슬라이더/회차), ⚡ 엔진 새로고침 버튼 |
| `RewardSendPage.tsx` | `/settings/rewards-send` | 부모 수동 보상 발송 |
| `NoticesPage.tsx` | `/settings/notices` | 공지사항 관리 (card-pixel 아코디언) |
| `SpecialDaysPage.tsx` | `/settings/special-days` | 기념일·생일 관리 |
| `QuestionAnswersPage.tsx` | `/settings/question-answers` | 두근두근 답변 목록 (부모 전용) |
| `QuestionBoxPage.tsx` | `/settings/questions` | 질문 전체 목록 |
| `RewardTypesPage.tsx` | `/settings/reward-types` | 보상 종류 관리 |

#### 게임 (`src/presentation/pages/game/`)

| 파일 | 역할 |
|------|------|
| `GamePage.tsx` | 선택→플레이→결과 3단계 상태 머신. GAME_META 3종. 대회 활성 시 상단 HUD. `addGameXP(score)` XP 적립. `saveTournamentScore()` 대회 점수. `TournamentRankWidget` |
| `GalagaGame.tsx` | HTML5 Canvas 우주 슈터. 자동 연사. 무기별 투영(WEAPON_CFG: basic/laser/double). `Math.pow(1.25, wave-1)` 누적 난이도 |
| `PonpokoGame.tsx` | 너구리 엔들리스러너. 목숨 3개, 무적 60프레임. `Math.pow(1.25, stage-1)` 누적 난이도. 코인 스테이지 루프 |
| `MinesweeperGame.tsx` | DOM Grid 지뢰찾기. ⛏/🚩 모드 토글, BFS 연쇄 오픈, 스테이지 무한 루프 |
| `GamePad.tsx` | 공통 터치 패드. `DPad`(좌우+액션) / `JumpPad` — w-12 h-12 피스톤 모션 |

> **게임 코딩 패턴:** 게임 상태는 `useRef<GameState>` (RAF stale closure 방지). React state는 score/lives/phase UI 전용. keysRef 패턴으로 touch+keyboard 동일 ref 처리. `onGameOver` 콜백은 `cbRef.current` 패턴으로 최신값 유지.

---

## 3. 핵심 규칙 & 패턴 (코딩 규칙 35개)

```typescript
// 1.  Firestore 접근은 반드시 infrastructure/firebase/ 헬퍼 경유
// 2.  petId 저장: updateMember(..., { 'character.petId': petId }) — dot notation
//     characterId / worldBanner: saveCharacter(newChar) — 전체 객체 교체
// 3.  팝업: 반드시 PixelModal 컴포넌트 사용. open: boolean 필수 prop. fixed inset-0 직접 구현 금지
// 4.  버튼: PixelButton 사용. type="button" 기본값 내장
// 5.  새 MissionStatus 추가 시 5개 파일 STATUS 맵 동시 업데이트
// 6.  새 Notification 타입 추가 시 Message.ts + NOTIF_ICONS + 홈 피드 필터 모두 업데이트
// 7.  PetSprite 이모지: PET_UNLOCKS에서 자동 생성 — 하드코딩 금지
// 8.  채팅 스크롤: containerRef.scrollTop = scrollHeight (scrollIntoView 금지)
// 9.  앱 초기화: deleteAllFamilyData() → signOut() → clearAllLocalData() 순서 필수
// 10. MissionDetailPage: useMissionStore(state => state.missions.find(m => m.id === id)) 셀렉터
// 11. 멤버 이름: useMembers() 훅 사용 — localStorage 캐시 직접 읽기 금지
// 12. 날짜 슬롯: slot_evaluations.{memberId}.{dateKey} 형태로 Firestore 저장
// 13. loginId 저장: fsSet() 사용 — fsUpdate()는 문서 없으면 실패
// 14. 페이지 컴포넌트에서 useMissions()/useNotifications() 직접 호출 금지
// 15. 보상 기록 생성: sendManualReward() 사용. missionId=null이면 수동/조르기로 분류
// 16. 달력에서 미션 데이터 사용 금지 — 기념일/생일(special_days)만 표시
// 17. 1:1 DM 전송: sendDirectMessage() 사용 (sendMessage receiverId=null은 그룹전용)
// 18. subscribeDirectChat: 양방향 병합 — sent/received 두 구독 후 createdAt 정렬
// 19. 멤버 이름 조회: useMembers() 훅 단일화 (각 컴포넌트에서 subscribeMembers 직접 호출 금지)
// 20. 미션 카드: PixelCard variant="special"(특별) / "dark"(일반) — inline style 금지
// 21. 상태 배지: StatusBadge 단일 사용 — 페이지별 STATUS_INFO 별도 정의 금지
// 22. 채팅 말풍선: speech-bubble + getBubbleBorderCls(role,id) 조합. bg-cream 직접 지정 금지
// 23. globals.css .t-title/.t-heading에 색상+text-shadow 내장. 다른 색 시 text-* utility override
// 24. 달력 inventory-slot 사용 시 반드시 !w-full aspect-square 추가 (w-16 h-16 충돌 방지)
// 25. InventoryGrid 슬롯: SLOT_SELECTED/UNLOCKED/LOCKED 상수 사용 (inventory-slot 직접 바인딩 금지)
// 26. 캔버스 게임: 상태는 useRef<GameState>. React state는 UI 전용. keysRef 패턴. cbRef.current onGameOver
// 27. 특별 퀘스트 카드: bg-panel-dark + border-yellow-400 + card-special(황금 네온 펄스). 배지: "⭐ SPECIAL"
// 28. 사운드: audioManager 싱글톤 경유. keyClick()/startAfterLogin() 내부에서 suspended 자동 처리
// 29. 인벤토리: useInventoryStore 훅. RAF 루프 동기 읽기: getState().currentWeapon. XP: addGameXP(score) 1회
// 30. 주간 대회 점수: tournament.active 시만 saveTournamentScore(). game_scores와 tournament_scores 완전 분리
// 31. 갤러그 자동 연사: keys.current.fire 없음. tick 내부에서 WEAPON_CFG 상수로 자동 발사 판단
// 32. 칭찬 스티커: sendPraiseSticker() / subscribePraiseStickers(). CheerOverlay: 자녀 홈에서만 마운트
// 33. 이모지 레거시 안전장치: CharacterSprite의 normalizeCharId/Weapon/PetId 함수 필수 경유
// 34. 메시지 리액션: toggleReaction(familyId, messageId, emoji, myId, currentReactions). 롱프레스 480ms
// 35. 메신저 탭 색상 고정: 그룹채팅=bg-sky, 1:1=bg-pink. bg-purple 절대 금지 (인지 왜곡 방지)
```

---

## 4. localStorage 키 전체 목록

| 키 | 내용 |
|----|------|
| `familyId` | 현재 가족 ID |
| `fq_last_login` | 마지막 로그인 멤버 ID |
| `fq_login_at` | 로그인 타임스탬프 (ms) |
| `fq_member_cache` | 멤버 목록 JSON 캐시 |
| `fq_snapshots` | 롤백 스냅샷 (최대 5) |
| `fq_fav_order` | 미션 즐겨찾기 순서 |
| `fq_weekly_comp` | 주간 경쟁 ON/OFF (초기화 시 유지) |
| `fq_monthly_comp` | 월간 경쟁 ON/OFF (초기화 시 유지) |
| `fq_bgm_theme` | BGM 테마 ('DEFAULT'\|'JOYFUL'\|'CALM'\|'MUTE') |
| `fq_inv_weapon` | 장착 무기 ('basic'\|'laser'\|'double') |
| `fq_inv_skin` | 장착 직업 스킨 ID |
| `fq_inv_pet` | 장착 XP펫 ID |
| `fq_inv_bg` | 장착 배경 테마 ID |
| `fq_inv_xp` | 보유 XP 잔액 (구매 시 차감) |
| `fq_inv_total_xp` | 누적 획득 XP (레벨 산출용, 차감 없음) |
| `fq_inv_owned_skins` | 보유 직업 스킨 ID 배열 |
| `fq_inv_owned_bgs` | 보유 배경 ID 배열 |
| `fq_inv_owned_pet_shop` | 보유 XP펫 ID 배열 |
| `fq_inv_owned_weapons` | 보유 무기 ID 배열 |

---

## 5. 알림 시스템

### NotificationType 전체

| 타입 | 발송 조건 | 대상 |
|------|---------|------|
| `NEW_MISSION` | 퀘스트 생성 | 대상 아이들 + 부모 전원 |
| `MISSION_CONFIRMED` | 아이 확인 버튼 | 부모 전원 |
| `MISSION_EXPIRED` | autoExpire() 실행 | 부모 전원 |
| `BEGGING_REQUEST` | 조르기 제출 | 부모 전원 |
| `BEG_RESULT` | 조르기 결과 | 신청 아이 |
| `NEW_MESSAGE` | DM 수신 | 수신자 |
| `MOM_CHEER` | 격려 발송 | 대상 자녀 |

### 홈 피드 필터 규칙

```typescript
// 부모/아이 공통 "📰 패밀리 늬우스"
// NEW_MESSAGE 제외
// 아이는 BEGGING_REQUEST 제외
// 최대 10개, relatedId+type 중복 제거
// MISSION_EXPIRED 항목 취소선 표시
```

### 알림 클릭 네비게이션

```typescript
BEGGING_REQUEST/BEG_RESULT → /begging/manage (부모) / /begging (아이)
MISSION 관련 → /missions/{relatedId} (없으면 /missions)
CHEER / NEW_MESSAGE → /messages
```

---

## 6. ProfilePage XP 상점 handleEquip 동작 원리

```typescript
// Session 29에서 완성된 4단 파이프라인
const handleEquip = async (type: ShopTab, id: string) => {
  if (!currentMember || !familyId) return   // null 가드

  // 1단: 로컬 인벤토리 스토어 즉시 반영 (React state → UI 즉각 갱신)
  if (type === 'skin')   setSkin(id)
  if (type === 'bg')     setBg(id as BgType)
  if (type === 'pet')    setInvPet(id)
  if (type === 'weapon') setWeapon(id as WeaponType)

  // 2단: 방금 바뀐 id를 직접 사용하는 삼항 분기로 updatedCharacter 재구성
  //      (setSkin 등은 비동기 배치이므로 currentSkin 바로 읽으면 과거값 → id 직접 사용)
  const updatedCharacter = {
    characterId: type === 'skin'   ? id : (currentSkin   || currentMember.character.characterId),
    petId:       type === 'pet'    ? id : (invPet        || currentMember.character.petId),
    worldBanner: type === 'bg'     ? id : (currentBg     || currentMember.character.worldBanner),
    equipment:   type === 'weapon' ? [id] : (currentMember.character.equipment || []),
  }

  // 3단: Firebase Firestore 원격 동기화
  await updateMember(familyId, currentMember.id, { character: updatedCharacter } as any)

  // 4단: 전역 Auth 세션 강제 갱신 → 패밀리뉴스·화면 전체 리렌더링 유도
  setCurrentMember({ ...currentMember, character: updatedCharacter })
}
```

---

## 7. 배포 & 빌드

### 명령어

```bash
npm run dev          # 개발 서버 (0.0.0.0 로컬망 전체)
npm run build        # vite build만 (tsc 체크 없음)
npm run deploy       # scripts/bump-version.mjs → 버전 0.1 증가 → build → firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes   # 규칙·인덱스만
```

### 버전 관리

`src/config/version.ts` → `scripts/bump-version.mjs`가 자동 0.1 증가  
현재: `2.2.0` (Session 29 수술 후 배포)

### 배포 로그 (Session 29 마지막 배포)

```
✅ 버전 업데이트: 2.1.0 → 2.2.0
✓ 153 모듈 변환 완료 / 빌드 1.46s
✓ hosting[family-quest-8b41b]: 배포 완료
✔ Deploy complete!
Hosting URL: https://family-quest-8b41b.web.app
```

---

## 8. 현재 알려진 기술 부채 (Tech Debt)

### 8-1. TypeScript 경고 (빌드 통과하나 코드 품질 저하)

| 파일 | 에러 | 내용 |
|------|------|------|
| `RewardStatusPage.tsx` | TS2741 | PixelModal `open` prop 누락 |
| `NotificationsPage.tsx` | TS2739 | `MISSION_EXPIRED`, `MOM_CHEER` NOTIF_ICONS 누락 |
| 다수 파일 | TS6133 | 미사용 import 30+ 개 |
| `TetrisGame.tsx`, `SnakeGame.tsx` | — | import 제거됐으나 파일 자체 미삭제 |

### 8-2. Firestore 인덱스 미배포

```
praise_stickers: targetMemberId ASC + createdAt DESC
cheer_messages: targetMemberId ASC + isRead ASC + createdAt DESC
tournament_scores: roundNumber ASC + score DESC
```

### 8-3. 레거시 Firestore 필드

```typescript
// missions 컬렉션 잔재 미사용 필드
memberStatuses: Record<string, string>  // 레거시 — 쿼리 제외 필요
childAccepted: boolean                   // 레거시 — 쿼리 제외 필요
```

### 8-4. 게임 번들 최적화

```
현재 번들: ~956KB (권고 500KB 초과)
해결책: dynamic import() 코드 스플리팅
```

---

## 9. 통계 요약 (v2.2.0 기준)

| 항목 | 수량 |
|------|------|
| 총 소스 파일 | ~100개 |
| 페이지 컴포넌트 | 26개 |
| UI 컴포넌트 | 20개 |
| 유스케이스 | 10개 |
| 도메인 엔티티 | 5개 |
| Firebase 컬렉션 헬퍼 | 15개 |
| Zustand 스토어 | 7개 (userInventoryStore 포함) |
| Presentation 훅 | 6개 |
| 도메인 서비스 | 2개 |
| Firestore 컬렉션 | 15개 |
| 라우트 | 25개 |
| 오디오 SFX 함수 | 20개 |
| BGM 테마 | 4개 |
| 게임 타이틀 | 3개 (갤러그/너구리/지뢰찾기) |
| localStorage 키 | 19개 |
| 코딩 규칙 | 35개 |

---

*Family Quest Source Overview v2.2.0 — 2026-05-31*  
*Session 29 완료 기준 | ProfilePage TS에러 전면 해소 + handleEquip 전역 세션 동기화 완성*  
*외부 AI 코드 리뷰 및 개발 지원용 전체 소스 인벤토리*
