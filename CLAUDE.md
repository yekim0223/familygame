# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **새 세션 시작 시**: 이 파일을 먼저 읽고 §12(현재 상태)와 §13(코딩 규칙)을 확인하세요.

---

## 1. 프로젝트 개요

**패밀리 퀘스트 (Family Quest)** — 우리 가족 미션 보상 앱

가족 4인 전용(아빠·엄마·하윤·서윤) 모바일 웹 PWA. 아이들이 미션에 참여하고, 부모가 날짜별로 평가·보상을 관리. Firebase 무료 플랜으로 운영비 0원.

| 항목 | 내용 |
|------|------|
| **사용자** | 가족 4인 + 옵저버 (비회원) |
| **접속** | 모바일 웹 PWA (URL 접속, 앱 설치 불필요) |
| **디자인** | 마인크래프트 오마주 픽셀 아트 + 여아 감성 퍼플/핑크 |
| **Firebase 프로젝트** | `family-quest-8b41b` |
| **배포 URL** | `family-quest-8b41b.web.app` |
| **현재 버전** | 1.8.0 |

---

## 2. 개발 명령어

```bash
# 개발 서버 (로컬망 전체 허용)
npm run dev

# 프로덕션 빌드만
npm run build         # vite build만 실행 (tsc 체크 없음)

# 배포 (버전 자동 증가 + 빌드 + 호스팅 배포)
npm run deploy        # scripts/bump-version.mjs 실행 → 버전 0.1 증가 → build → firebase deploy

# Firebase 개별 배포
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

> `npm run deploy`를 사용하면 버전이 자동으로 0.1씩 증가 (1.2 → 1.3 → ... → 1.9 → 2.0)  
> Firestore 규칙·인덱스 변경 시 반드시 `firebase deploy --only firestore:*` 별도 실행 필요.

---

## 3. 아키텍처 — Clean Architecture 4레이어

```
Presentation → Application → Domain ← Infrastructure
```

| 레이어 | 위치 | 역할 |
|--------|------|------|
| **Presentation** | `src/presentation/` | React 컴포넌트, 페이지, 훅 |
| **Application** | `src/application/use-cases/` | 비즈니스 유스케이스 |
| **Domain** | `src/domain/` | 엔티티 타입, 도메인 서비스 |
| **Infrastructure** | `src/infrastructure/` | Firebase, Zustand 스토어 |

### 핵심 데이터 흐름

```
Firestore onSnapshot → Zustand store → UI 컴포넌트 (단방향)
컴포넌트는 store만 구독, Firestore 직접 접근 절대 금지
```

### 전역 구독 구조 (중요)

```typescript
// AppLayout.tsx — 로그인 상태이면 항상 활성
useMissions()        // 전역 미션 구독 → missionStore 자동 갱신
useNotifications()   // 전역 알림 구독 → notificationStore 자동 갱신

// 개별 페이지에서 useMissions() / useNotifications() 중복 호출 금지
// 대신 useMissionStore() / useNotificationStore() 직접 읽기
```

### 상태 관리 (Zustand)

- **authStore**: 현재 로그인 멤버, familyId, PIN 잠금
- **missionStore**: 전체 미션 목록 (AppLayout에서 전역 onSnapshot 구독)
- **notificationStore**: 알림 목록 + 미읽음 수 (AppLayout에서 전역 구독)
- **messageStore**: 그룹채팅 메시지 + 읽음 상태
- **rewardStore**: 보상 목록

---

## 4. 역할 및 권한 체계

| DB Role | 표시명 | 권한 등급 |
|---------|--------|---------|
| `DAD` | 아빠 | Master — 최고 관리자, 마스터 패널 접근 |
| `MOM` | 엄마 | Parent — 부모 관리자 |
| `CHILD` | 하윤/서윤 | Child — 미션 확인 |
| `OBSERVER` | 옵저버 | 열람+응원 전용 (비회원) |

**중요 권한 규칙**:
- 미션 생성·수정·삭제: 부모(DAD/MOM)만
- 날짜별 G/B/H 평가: 부모만
- 보상 발송: 부모만 (`/settings/rewards-send`)
- 공지 관리: 부모만 (`/settings/notices`)
- 마스터 패널: DAD만 (`/settings/master`)

---

## 5. 인증 로직

### 로그인 흐름 (간소화 버전)

```
기존 기기 (familyId 캐시 있음):
  landing → FAMILY LOGIN → characters → PIN → /home

새 기기 (캐시 없음):
  landing → FAMILY LOGIN → family-id-input → 개인ID 입력

  ① 개인 ID (loginId) 입력 시:
     member_login_ids/{loginId} → {familyId, memberId} 조회
     → 해당 멤버로 바로 PIN 입력 → /home

  ② 가족 코드 입력 시:
     family_codes/{code} → familyId 조회
     → characters (구성원 목록) → PIN → /home
```

**loginId 설정**: 아빠 작업방 → 구성원 관리 → 수정 → 로그인 ID 입력 → 저장  
→ `member_login_ids/{loginId}` 컬렉션에 `{familyId, memberId}` 자동 저장 (fsSet)

### 핵심 인증 파일

- `src/infrastructure/firebase/auth.ts` — SHA-256 PIN 해시, Anonymous Auth
- `src/application/use-cases/auth/login.ts` — PIN 검증 로직
- `src/application/use-cases/auth/signUp.ts` — 가입 유스케이스 (DAD는 uid=familyId)
- `src/infrastructure/firebase/collections/familyCodes.ts` — 가족 비밀 코드 조회

---

## 6. 미션 시스템 — Daily Slot 방식 (v2)

### 핵심 패러다임

| 역할 | 동작 |
|------|------|
| 아이 | 확인 버튼 누르기 (confirmedByChild) → 부모에게 MISSION_CONFIRMED 알림 발송 |
| 부모 | 날짜별 G/B/H 슬롯 직접 평가 |

### 특별 퀘스트 (isSpecial)

```typescript
// Mission 엔티티에 isSpecial?: boolean 추가
// 생성: MissionFormPage의 ✨ 버튼 (빨간색으로 선택됨 표시)
// 표시: MissionCard에 금테두리 + "✨ 특별 퀘스트" 배지
```

### 상태 전이

```
ACTIVE  ─[기간 만료 자동]→ EXPIRED
ACTIVE  ─[부모 종료]→ EXPIRED
```

**EXPIRED**: 빨간색 폰트(`text-rejected`) + '종료됨' 표시

### Daily Slot 데이터 구조

```typescript
// Mission 엔티티 핵심 필드
slot_evaluations?: Record<string, Record<string, DaySlot>>
// 구조: { memberId: { 'YYYY-MM-DD': 'GOOD' | 'BAD' | 'HOLD' } }

confirmedByChild?: boolean  // 아이 확인 여부
isSpecial?: boolean         // 특별 퀘스트 여부
description?: string        // 퀘스트 내용 (MissionCard에 표시)
```

### 난이도 EXP

```typescript
// DIFFICULTY_INFO — 난이도 × 10
1: exp 10,  2: exp 20,  3: exp 30,  4: exp 40,  5: exp 50
```

### 기간 자동 만료

```typescript
// useMissions.ts — autoExpire()
// AppLayout의 전역 useMissions() 구독이 처리
// expiredSet으로 세션당 중복 방지
```

### 미션 관련 주요 함수

```typescript
// missions.ts
updateDaySlot(familyId, missionId, memberId, dateKey, slot)   // 날짜 평가
removeDaySlot(familyId, missionId, memberId, dateKey, evals)  // 평가 취소
confirmQuestByChild(familyId, missionId)                       // 아이 확인 (→ 부모 알림 자동 발송)
deleteMission(familyId, missionId)                             // 삭제
```

### MissionDetailPage 핵심 구조

```typescript
// Zustand 셀렉터로 즉시 갱신
const mission = useMissionStore(state => state.missions.find(m => m.id === id))

// 멤버 이름: subscribeMembers로 실시간 구독
const [members, setMembers] = useState<Member[]>([])
useEffect(() => subscribeMembers(familyId, setMembers), [familyId])
```

### MissionListPage 필터 구조

```typescript
// 탭: 전체(기본) | 공동 미션(targetMemberIds.length > 1) | 개별 미션(length === 1)
// 개별 미션 선택 시 → 아이별 탭 표시 (부모만)
// 즐겨찾기 우선 정렬 → 날짜+상태 정렬
```

### EXPIRED/CHILD_REJECTED 포함 필수 파일 (5곳)

- `src/domain/entities/Mission.ts` — STATUS_LABEL
- `src/presentation/components/missions/MissionCard.tsx` — STATUS_INFO
- `src/presentation/pages/missions/MissionListPage.tsx` — STATUS_SORT
- `src/presentation/pages/missions/MissionDetailPage.tsx` — STATUS_LABEL
- ~~`src/presentation/pages/home/HomePage.tsx`~~ — statusLabel 섹션 제거됨

---

## 7. Firestore 데이터 모델

```
families/{familyId}/
  config/settings     familyCodeHash, joinCode, resetAt
  members/{id}        name, realName, loginId(선택), role, pinHash, level, exp,
                      character{characterId,petId,equipment,worldBanner},
                      beggingLeft, beggingWeek, isActive
  missions/{id}       title, description(선택), category, type, difficulty,
                      targetMemberIds, creatorId, rewards, status, statusHistory,
                      isSpecial(선택), slot_evaluations, confirmedByChild,
                      memberStatuses(레거시), childAccepted(레거시)
  rewards/{id}        missionId(null=수동/조르기), memberId, approvedBy,
                      rewardType, amount, customLabel(선택), source(선택),
                      isPaid, approvedAt
  messages/{id}       type(CHAT|CHEER), senderId, receiverId, content
  notifications/{id}  type, targetMemberId, content, relatedId, isRead
  notices/{id}        title, content, authorId, authorName, createdAt
  begging/{id}        submitterId, type, content, status, dadApproved, momApproved
  special_days/{id}   name, type, month, day, isLunar, emoji, deleted
  question_answers/{id} memberId, question, answer, emotion, reward, dateKey
  game_scores/{id}    memberId, memberName, gameId('galaga'|'tetris'|'ponpoko'),
                      score, playedAt                ← 게임 점수 기록

family_codes/{code}          familyId, active       ← 루트 레벨 (가족 찾기)
member_login_ids/{loginId}   familyId, memberId     ← 루트 레벨 (개인 ID 로그인)
```

### 중요: rewards 컬렉션

```typescript
// 미션 완료 보상: missionId = 미션ID, source = 'mission'
// 수동 발송: missionId = null, source = 'manual'
// 조르기 양쪽 승인: missionId = null, source = 'begging', customLabel = '[조르기] ...'
sendManualReward(familyId, memberId, approvedBy, rewardType, amount, customLabel?)
```

### 중요: member_login_ids 설정

```typescript
// 마스터 패널 구성원 수정 시 → fsSet으로 저장 (fsUpdate 아님: 문서 없으면 실패)
await fsSet(`member_login_ids/${loginId}`, { familyId, memberId })
```

---

## 8. 알림 정책

| 타입 | 발송 조건 | 대상 |
|------|---------|------|
| `NEW_MISSION` | 퀘스트 생성 | 대상 아이들 + 부모 전원 |
| `MISSION_CONFIRMED` | 아이 확인 버튼 누름 | 부모 전원 |
| `MISSION_PENDING` | (레거시) | 부모 |
| `BEGGING_REQUEST` | 아이 조르기 제출 | 부모 전원 |
| `BEG_RESULT` | 조르기 결과 | 신청 아이 |

### 홈 피드 필터링 정책

```typescript
// 부모/아이 모두 "최근 활동" — 동일 로직
// NEW_MESSAGE 제외, 아이는 BEGGING_REQUEST 제외
// 최대 10개, relatedId+type 중복 제거
// '전체 보기' → /notifications
```

### 알림 클릭 네비게이션

```typescript
// BEGGING_REQUEST / BEG_RESULT → /begging/manage (부모) / /begging (아이)
// MISSION 관련 → /missions/{relatedId} (없으면 /missions로 안전 처리)
// CHEER / NEW_MESSAGE → /messages
```

---

## 9. 캐릭터·펫·배너 시스템

### PetSprite 이모지 매핑

```typescript
// CharacterSprite.tsx — PET_EMOJI는 PET_UNLOCKS에서 자동 생성 (하드코딩 금지)
const PET_EMOJI: Record<string, string> = Object.fromEntries(
  PET_UNLOCKS.map(p => [p.id, p.emoji])
)
```

### 저장 규칙

```typescript
// petId만 변경: updateMember(..., { 'character.petId': petId })
// characterId / worldBanner: saveCharacter(newChar) 전체 객체 교체
// 저장 후 setCurrentMember({ ...currentMember, character: safeChar }) — 재조회 금지
```

---

## 10. 디자인 시스템

### 폰트

| 클래스 | 폰트 | 용도 |
|--------|------|------|
| `font-pixel` | Press Start 2P | Lv, EXP, 숫자 배지 |
| `font-korean` | Pretendard → system-ui | **모든 한글 텍스트** |
| `font-pixel-kr` | DotGothic16 | 로그인 대형 타이틀만 |

### 컬러 팔레트

```
grass:#5C8A1E  dirt:#8B5E3C   stone:#9E9E9E   gold:#FFD700
sky:#4FC3F7    purple:#7B5EA7  pink:#E8A0BF   cream:#FFF8F0
pixel-dark:#1A1A1A   approved:#43A047  rejected:#E53935  hold:#FB8C00
```

### UI 규칙

```tsx
// 팝업/토스트 — 반드시 PixelModal 컴포넌트 사용 (규칙 3)
// fixed inset-0 z-[9999] 직접 선언 절대 금지
import { PixelModal } from '@/presentation/components/pixel/PixelModal'

// 메시지 채팅 스크롤 — scrollIntoView 금지
containerRef.current.scrollTop = containerRef.current.scrollHeight

// 보상 종류 합계 — flex-wrap 소형 뱃지 (grid-cols-N 사용 금지)
// EXPIRED 표시 — text-rejected + font-bold (빨간 굵게)
// 특별 퀘스트 버튼 — 선택 시 bg-rejected (빨간색)
```

### globals.css 글로벌 클래스 현황 (v3.0 MC Dark — Session 20 교체)

```
.t-pixel-shadow  → text-shadow: 2px 2px 0px #000 (MC 외곽선, 독립 클래스)
.t-title         → 22px bold + text-gold + text-shadow 내장 (override 가능)
.t-heading       → 19px bold + text-cream + text-shadow 내장
.t-body          → 16px text-cream
.t-sub           → 14px text-panel-sub
.t-micro         → text-xs text-stone
.t-badge         → font-pixel 11px text-gold + text-shadow
.btn-pixel       → border-black + inset MC 3D shadow
.btn-block-*     → border-black + inset MC shadow (gold/purple/sky/danger/ghost)
.input-pixel     → bg-panel-darkest border-black + inset 3D shadow (인벤토리 슬롯)
.card-pixel      → bg-panel-dark border-black + inset shadow (기존 bg-cream 제거)
.card-highlight  → bg-panel-dark border-gold + inset gold shadow
.speech-bubble   → bg-panel-darkest border-black p-3 + inset shadow
.inventory-slot  → bg-panel-darkest border-black + inset shadow
.badge-base      → text-xs (13px, 최소 폰트 규칙 준수)
```

### 채팅 말풍선 역할별 테두리 패턴 (MessagesPage)

```typescript
// getBubbleBorderCls(role, id) — 역할별 border 오버라이드 (Tailwind utility > component)
DAD   → border-sky    (하늘색, 아빠 고유)
MOM   → border-pink   (핑크, 엄마 고유)
CHILD → border-approved | border-gold (id 해시로 자녀별 고유 배정)

// 내 메시지 (isMine)
'speech-bubble bg-purple text-white border-purple/80'

// 상대방 메시지
'speech-bubble ' + getBubbleBorderCls(role, senderId)
```

---

## 11. 화면 목록 (App Map)

| Route | 화면 | 비고 |
|-------|------|------|
| `/login` | 로그인 (3뷰) | landing → family-id-input → characters |
| `/register` | 회원가입 | |
| `/master` | 마스터 패널 | ProtectedRoute 밖 |
| `/home` | 홈 대시보드 | 부모/아이 공통 "최근 활동" (최대 10개) + 공지사항 |
| `/missions` | 미션 목록 | 전체/공동/개별 탭 + 즐겨찾기 |
| `/missions/new` | 미션 생성 | 부모 전용, 설명란+특별퀘스트 포함 |
| `/missions/:id` | 미션 상세 | Daily Slot 평가 + 아이별 탭 |
| `/missions/:id/edit` | 미션 수정 | |
| `/calendar` | 달력 (월간/주간/일간) | 기념일·생일만 표시 (미션 표시 없음) |
| `/rewards` | 보상 현황 | 당월 총합 + 종류별 합계 + 출처 배지 |
| `/messages` | 그룹채팅 | 하단 고정 스크롤 |
| `/begging` | 조르기 (아이) | |
| `/begging/manage` | 조르기 관리 (부모) | 승인 시 rewards 컬렉션에 자동 기록 |
| `/profile` | 프로필·캐릭터·펫·배너 | `location.state.panel`로 탭 자동 오픈 |
| `/notifications` | 알림 전체 목록 | 홈 "전체 보기" 연결 |
| `/settings` | 설정 (부모) | 보상주기·공지 버튼 포함 |
| `/settings/master` | 설정 (마스터/DAD만) | loginId 설정 포함, 가족비밀코드/수동보상 섹션 제거됨 |
| `/settings/rewards-send` | 아이들 보상주기 | 엄마·아빠 공통 |
| `/settings/notices` | 공지사항 관리 | 엄마·아빠 공통 |
| `/settings/special-days` | 기념일·생일 관리 | |
| `/settings/question-answers` | 두근두근 답변 목록 | 부모 전용 |
| `/settings/questions` | 질문 전체 목록 | |
| `/settings/reward-types` | 보상 종류 관리 | |
| `/game` | 레트로 게임 허브 | 갤러그·테트리스·너구리 + 가족 랭킹 |

---

## 12. 현재 상태 (2026-05-31 Session 23 완료 기준 — v1.8.0)

### 구현 완료

- **인증 간소화**: 초대코드('family') 완전 제거. 기존 기기 바로 PIN, 새 기기 개인ID 또는 가족코드 입력
- **개인 loginId 시스템**: member_login_ids/{id} 컬렉션. 마스터 패널에서 각 구성원 ID 설정. fsSet으로 저장(문서 없어도 생성)
- **앱 초기화**: Firestore 전체 삭제 + PIN 확인 + window.location.replace — 완전 구현
- **특별 퀘스트**: isSpecial 필드, 빨간 토글 버튼, MissionCard → `PixelCard variant="special"` (황금탄 #D4A843) 고정
- **퀘스트 내용(description)**: 생성 폼에 textarea 추가, MissionCard에 2줄 이내 표시
- **미션 Daily Slot 시스템**: 아이별 날짜 탭 + G/B/H 평가 + 즉시 통계 업데이트
- **퀘스트 자동 만료**: endDate < 오늘 → EXPIRED 자동 처리 (AppLayout 전역 구독)
- **전역 Firestore 구독**: AppLayout에 useMissions()+useNotifications() 추가. 어느 페이지에서도 실시간 반영
- **미션 목록 필터**: 전체(기본)/공동/개별 탭. 개별 탭 선택 시 아이별 탭 표시
- **홈 피드**: 부모/아이 모두 "최근 활동", 최대 10개. 부모 "아이들 진행 미션 보기" 섹션 제거
- **아이 홈 간소화**: "오늘의 퀘스트", "오늘의 진행율", "이번주 진행율" 제거
- **난이도 EXP**: 1=10, 2=20, 3=30, 4=40, 5=50
- **알림 확대**: NEW_MISSION을 부모에게도 발송. MISSION_CONFIRMED 타입 추가 (아이 확인 → 부모 알림)
- **달력 개편**: 월간/주간/일간/바텀시트 모두 기념일·생일만 표시. 미션 표시·수행률 이모지·범례 완전 제거
- **마스터 패널 정리**: 가족 비밀코드 설정, 수동 보상 발송 섹션 제거. 구성원 loginId 편집 추가. 롤백 스냅샷 삭제 기능 유지
- **보상현황 개선**: 수동발송/조르기/미션 출처 배지 구분. 조르기 양쪽 승인 시 rewards 컬렉션 자동 기록
- **Firestore rules**: member_login_ids 컬렉션 read/write 규칙 추가 및 배포
- **버전 자동 증가**: npm run deploy → 버전 0.1 자동 증가 → 빌드 → 배포
- **공지사항 시스템**: /settings/notices 관리 + 홈 하단 아코디언 (최근 5개)
- **두근두근 질문함**: 아이 홈 📝 풍선(일 1회), 감정(👍👎), 부모 답변 목록
- **기념일·생일**: `/settings/special-days`, 달력 이모지 연동
- **프로필**: PIN 변경, 마이펫 50종 이모지, 부모 해금목록 숨김
- **메시지 수평 스크롤 수정**: `overflow-hidden` + 버블 `min-w-0 break-words` 적용
- **1:1 DM 채팅**: 양방향 실시간 채팅. 읽음 처리(✓/✓✓). unread 뱃지. NEW_MESSAGE 알림 자동 발송
- **메신저 개선**: 읽음 숫자 금색 표시(카카오 스타일), 메시지 삭제 기능
- **로그인 플로우 심플화**: FAMILY LOGIN 시 member_login_ids/kye Firestore 자동 조회. 마스터 패널 ID=`kye` PW=`1111`
- **폰트 시스템 전면 개선 (v1.4.0)**: text-xs→13px, text-sm→15px. ds-* 스케일. body 16px. 소형 폰트 전면 제거
- **마스터 패널 키보드 버그 수정 (v1.5.0)**: 인라인 JSX 교체 → 포커스 유지
- **🎮 게임 탭 + 레트로 게임 3종 (v1.8.0)**: 바텀 내비 6번째 탭 추가 + `/game` 라우트
  - **갤러그(GalagaGame)**: HTML5 Canvas 우주 슈터. 32적(4×8), 다이빙, 적 총알, 멀티웨이브
  - **테트리스(TetrisGame)**: 7종 테트로미노, 고스트 피스, 벽킥 회전, 라인 클리어
  - **너구리 달리기(PonpokoGame)**: 너구리 엔들리스러너, 이단점프, 통나무/새 장애물, 코인
  - **공통**: RAF 루프 + keysRef 패턴(터치·키보드 동시 지원), touchAction:none 모바일 최적화
  - **game_scores 컬렉션**: `saveGameScore()` / `subscribeAllGameScores()` Firebase 헬퍼
  - **가족 랭킹 위젯**: 게임별 Top5, 내 점수 금색 강조, 클라이언트 필터링(인덱스 불필요)
  - **채팅방 자동 알림**: 개인 최고 경신·1위 추월 시 그룹채팅에 `[🎮 게임 알림]` 자동 발송
- **특별 퀘스트 카드 텍스트 대비 수정 (v1.8.0)**:
  - `MissionCard.tsx`: `text-stone`(#9E9E9E, 대비 1.3:1) → `text-amber-900`(#78350f, WCAG AA 달성)
  - 배지 `text-gold` → `text-[#1C1917]`, `opacity-80` 황금 배경 이중 희석 제거

---

### 디자인 전면 개편 (Session 18 — v3.0 진행 중)

#### Phase 1 완료 ✓ — 디자인 토큰 + 공통 컴포넌트
- **tailwind.config.js**: panel-darkest/dark/mid/surface/border/sub 6종 컬러 토큰 추가
- **globals.css**: `.t-title` `.t-heading` 컬러 중립화 (색상은 사용처에서 `text-gold` 등으로 지정)
- **PixelButton.tsx**: purple/hold variant 추가, ghost 다크모드화 (bg-transparent text-cream border-panel-border), md 터치높이 py-2.5, variant 기본값 `purple`, `type={props.type ?? 'button'}` 명시적 처리
- **PixelCard.tsx**: variant 4종(dark/special/highlight/light), padding none 추가. 기본값 `dark`
- **PixelModal.tsx** 신규 생성: fixed inset-0 z-[9999], title+onClose X버튼 44px 터치 영역

#### Phase 2 완료 ✓ — 레이아웃 다크화
- **AppLayout.tsx**: `bg-minecraft` → `bg-panel-dark`
- **Header.tsx**: `bg-mc-brick` → `bg-panel-darkest` + `border-b-[3px] border-gold/30`. 드롭다운 메뉴 다크화 (bg-panel-mid, text-cream, text-gold)
- **BottomNav.tsx**: `bg-mc-brick` → `bg-panel-darkest` + `border-t-[3px] border-gold/30`. 활성 탭 상단 gold 라인(`h-[2px] bg-gold`) 추가

#### Phase 3-1 완료 ✓ — 핵심 페이지 (홈 + 미션목록)
- **useMembers.ts** 신규: subscribeMembers + getMemberName 단일 소스 훅. localStorage 직접 접근 완전 대체
- **HomePage.tsx**: localStorage getMemberName 완전 제거 → useMembers 훅 적용. 프로필 카드 `PixelCard variant="highlight"`. 퀵메뉴/피드/공지 다크 디자인. t-heading text-gold 섹션 헤더
- **MissionListPage.tsx**: useMembers 훅 적용 (startAnonymousSession 제거). 탭바 `bg-panel-darkest` + 활성 `bg-panel-surface border-b-4 border-gold`. 빈 상태 통일 패턴
- **MissionCard.tsx**: `PixelCard variant="special"|"dark"` 적용. 조건부 텍스트 색상(특별:text-pixel-dark/일반:text-cream). StatusBadge 통합. 난이도 이모지 text-2xl
- **StatusBadge.tsx**: CHILD_REJECTED 추가. text-xs(13px) 최소 크기 준수. Tailwind 직접 클래스 적용

#### Phase 3-2 완료 ✓ (MissionDetailPage) — 미션 상세 페이지
- **MissionDetailPage.tsx**: 다크 테마 전면 적용 + 팝업 통합 + 규칙 위반 청산
  - 헤더 카드 `PixelCard variant="highlight"`, 나머지 카드 `variant="dark"`
  - 인라인 `Toast` 컴포넌트 + `fixed inset-0` 직접 선언 전면 제거 → `PixelModal` 통합
  - 삭제 확인: `PixelModal` title="퀘스트 삭제" + `PixelButton ghost/danger`
  - 토스트: `PixelModal` 타입별 title(완료/오류/안내) + `PixelButton ghost`
  - 상태 표시: `STATUS_LABEL` 인라인 span → `StatusBadge` 컴포넌트 (규칙 21)
  - G/B/H 슬롯 평가 버튼 → `PixelButton success/danger/hold`
  - 아이별 탭: `bg-panel-darkest` + 활성 `border-gold` (Phase 3-2 스펙)
  - 종료/삭제 액션 버튼 → `PixelButton ghost/danger`
  - text-cream / text-panel-sub 전환 (text-pixel-dark / text-stone 제거)
  - 보상 배지 text-xs → text-base (가독성 기준 준수)
  - text-[8px] → text-xs 수정 (최소 폰트 규칙 준수)
  - 슬롯 rowCls 불투명도 /8 → /20 (다크 배경 가시성 확보)
  - React hooks 규칙 수정: `useState(confirming/expiring)` 를 조건부 return 이전으로 이동
  - targetMemberIds.map(id→) shadowing 버그 수정 → `tid`로 변경

#### Phase 3-3 완료 ✓ — MissionFormPage 전면 개편 (2026-05-31, Session 19)
- **MissionFormPage.tsx**: 다크 패널 표준 + PixelButton 전면 적용
  - 입력창 규격: `bg-panel-darkest border-2 border-panel-border text-cream focus:border-gold` (INPUT_CLS/TEXTAREA_CLS/SELECT_CLS 상수 통일)
  - 모든 라벨: `font-korean text-sm font-bold text-panel-sub` (`font-pixel-kr text-purple` 제거)
  - 특별 퀘스트 토글: `PixelButton variant="danger"(선택) / "ghost"(미선택)`
  - 카테고리 칩: `PixelButton variant="purple"(선택) / "ghost"(미선택)`
  - 주기 빠른 선택 4종: `PixelButton purple/ghost`
  - 보상 삭제/추가: `PixelButton danger sm / ghost sm`
  - 액션 버튼 영역: `PixelButton gold lg type="submit"` + `PixelButton ghost lg` 취소 버튼 추가
  - 터치 영역: 모든 input/select `min-h-[44px]`, 체크박스 라벨 `min-h-[44px]`
  - 난이도 버튼: 커스텀 layout 유지 (flex-col emoji+숫자), w-11 h-12 (44px+ 터치 보장)

#### Phase 4-A 완료 ✓ — globals.css MC 다크 인프라 전면 교체 (2026-05-31, Session 20)
- **globals.css**: 라이트 테마 완전 청산 → 마인크래프트 칠흑 우드 테마
  - `body` 배경: `bg-panel-darkest` (#0F0A04), `#root`: `bg-panel-dark`
  - `.t-pixel-shadow` 신규: `text-shadow: 2px 2px 0px #000` (마인크래프트 외곽선 효과)
  - `.t-title`: `text-gold` + text-shadow 내장 (사용처에서 다른 색 원하면 utility로 override)
  - `.t-heading`: `text-cream` + text-shadow 내장
  - `.t-badge`: font-size 10px → 11px (최소 폰트 규칙 근접)
  - `.btn-pixel` / `.btn-block`: `shadow-[inset_2px_2px_0px_#ffffff40,inset_-2px_-2px_0px_#00000080]` (MC 3D 입체 효과)
  - `.input-pixel`: `shadow-[inset_3px_3px_0px_#00000090]` (안으로 파인 인벤토리 슬롯 감성)
  - `.card-pixel`: `bg-panel-dark border-black` + inset shadow (기존 bg-cream → 다크)
  - `.card-highlight`: `bg-panel-dark border-gold` + inset gold shadow
  - `.speech-bubble`: `bg-panel-darkest border-black` + inset shadow (기존 bg-cream → 다크)
  - `.inventory-slot`: `bg-panel-darkest border-black` + inset shadow

#### Phase 4-B 완료 ✓ — LoginPage 다크 개편 (2026-05-31, Session 20)
- **LoginPage.tsx**: 모든 뷰 `bg-minecraft` → `bg-panel-darkest`
  - FAMILY LOGIN raw `<button>` → `PixelButton variant="gold" fontMode="pixel" fullWidth size="lg"`
  - 마스터 패널 입력창 inline 클래스 → `.input-pixel`
  - 마스터 패널 버튼 `variant="primary"` → `variant="gold"`, 제목 `text-purple` → `text-gold`
  - family-id-input: 입력창 `.input-pixel`, 제출 `PixelButton gold`, 뒤로 `PixelButton ghost`
  - 신규 안내 div: `bg-cream/10` → `bg-panel-dark border-panel-border`
  - 캐릭터 선택 카드: `bg-cream/10 border-cream/30` → `bg-panel-dark border-panel-border`
  - 캐릭터 이름 `text-pixel-dark` → `text-cream`, `text-stone` → `text-panel-sub`
  - PIN 도트: `bg-pixel-dark/bg-cream` → `bg-gold` (채움) / `bg-panel-darkest` (빔)
  - PIN 입력창 inline → `.input-pixel text-center tracking-widest`
  - 취소/입장 버튼 raw → `PixelButton ghost/gold`

#### Phase 4-C 완료 ✓ — MessagesPage 다크 개편 (2026-05-31, Session 20)
- **MessagesPage.tsx**: MC 다크 테마 전면 적용 + 규칙 위반 청산
  - `PixelButton`, `PixelModal` import 추가
  - `getBubbleBorderCls(role, id)` 헬퍼 추가: DAD→`border-sky`, MOM→`border-pink`, CHILD→`border-approved`/`border-gold`(해시)
  - 말풍선: raw `bg-cream` → `.speech-bubble` 베이스 + 역할별 border 오버라이드
  - 내 메시지: `speech-bubble bg-purple text-white border-purple/80`
  - 이모지 패널: `bg-cream border-dirt` → `bg-panel-darkest border-black`, 탭 `text-pixel-dark` → `text-cream`
  - 입력바: `bg-cream border-dirt` → `bg-panel-darkest border-black`, 전송 raw → `PixelButton variant="purple"`
  - 탭바: `bg-cream text-pixel-dark border-dirt` → `bg-panel-darkest text-cream border-black`
  - DM 멤버 목록: `bg-cream` → `bg-panel-dark`, 이름 `text-pixel-dark` → `text-cream`
  - DM 헤더: `bg-cream border-dirt` → `bg-panel-darkest border-black`
  - 삭제 확인: `fixed inset-0` 직접 구현(규칙 위반) → `PixelModal` (규칙 3 준수)
  - 채팅 스크롤: `scrollTop = scrollHeight` 완전 보존 (규칙 8)

#### Phase 4-D 완료 ✓ — MessagesPage 픽셀 입체감 2차 미세조정 (Session 21)
- **MessagesPage.tsx**: 상대방 말풍선 `shadow-[inset_2px_2px_0px_#ffffff15,inset_-2px_-2px_0px_#00000060]` 인셋 섀도우 주입, 발신자 이름표 `t-pixel-shadow` 글자 외곽선, DM 파트너 선택 버튼 `card-pixel` 아이템 상자화

#### Phase 4-E 완료 ✓ — NoticesPage 공지사항 게시판 마인크래프트 개편 (Session 21)
- **NoticesPage.tsx**: 전면 리팩토링
  - 각 공지 항목 `card-pixel` 독립 상자 + 아코디언 펼치기(📄→📖)
  - 제목 `t-heading t-pixel-shadow`, 요약 `t-micro`, 날짜·작성자 `t-sub`
  - 작성 폼: `input-pixel` + `textarea.input-pixel`, 등록 `PixelButton variant="gold"`
  - 삭제 확인: `window.confirm` 제거 → `PixelModal` (규칙 3 준수)
  - 상세 본문: `speech-bubble border-panel-border` 표지판 컨셉
  - `PixelCard` import 제거 → `card-pixel` 직접 클래스 사용

#### Phase 4-F 완료 ✓ — CalendarPage 전면 마인크래프트 개편 (Session 21)
- **CalendarPage.tsx**: 전면 리팩토링
  - 날짜 그리드: `!w-full aspect-square` 정사각형 강제 + `inventory-slot`/`card-highlight` 조건부 바인딩
  - 헤더 월·연도: `t-title t-pixel-shadow` 볼드 연출
  - 네비/뷰탭: raw `<button>` → `PixelButton ghost/purple`
  - 날짜 상세: 기존 `BottomSheet(fixed inset-0 z-40)` → `PixelModal` 교체 (규칙 3 준수)
  - 기념일 아이템: `speech-bubble border-gold` 표지판 컨셉 — `SpecialDayItem` 서브 컴포넌트 분리
  - 달력 외곽: `PixelCard` → `div.card-pixel` 교체
  - 미사용 `PixelCard`, `SpecialDay`, `specialDays` dead code 완전 제거
  - `t-micro` / `t-sub` / `t-heading` 텍스트 위계 정렬

#### Phase 4-G 완료 ✓ — InventoryGrid 다크 테마 전면 교체 (Session 21)
- **InventoryGrid.tsx**: 전면 리팩토링
  - 3단계 슬롯 스타일 상수: `SLOT_SELECTED`(border-gold + 금빛 인셋 글로우) / `SLOT_UNLOCKED`(border-black hover:border-gold/60) / `SLOT_LOCKED`(opacity-40)
  - `bg-cream border-pixel-dark` 라이트 테마 완전 제거 → `bg-panel-darkest` 다크 베이스
  - `text-[8px]` → `text-xs` 최소 폰트 규칙 준수, `text-pixel-dark` → `text-cream`
  - 펼쳐보기 raw `<button>` → `PixelButton variant="ghost" fullWidth`

#### Phase 4-H 완료 ✓ — ProfilePage 전면 다크 개편 (Session 21)
- **ProfilePage.tsx**: 전면 리팩토링
  - `_BANNER_BG_UNUSED` 미사용 상수 완전 삭제
  - PIN 폼: `bg-pixel-dark border-4 border-pixel-dark` → `input-pixel` 상수화
  - 패널 토글 버튼: raw `bg-cream border-dirt` → `PixelButton variant="purple"/"ghost"`
  - 닉네임 저장/취소: raw underline button → `PixelButton size="sm" gold/ghost`
  - 로그아웃: raw → `PixelButton variant="danger" fullWidth`
  - `PixelCard` 래퍼 → `div.card-pixel` 교체
  - 텍스트 위계: `text-pixel-dark` → `text-cream`, `text-stone` → `text-panel-sub`, `t-sub/t-micro` 적용

#### Phase 4-I 완료 ✓ — MasterSettingsPage 전면 대수술 (Session 21)
- **MasterSettingsPage.tsx**: 전면 리팩토링
  - 커스텀 `ConfirmModal(bg-cream fixed inset-0)` 완전 제거 → `PixelModal` (규칙 3 준수)
  - 커스텀 `Toast(fixed inset-0 z-[9999])` 완전 제거 → `PixelModal` auto-close (규칙 3 준수)
  - `window.confirm` 제거 → `expelTarget` state + `PixelModal` 내보내기 확인
  - `bg-minecraft` → `bg-panel-dark`, 헤더 `bg-pixel-dark border-dirt` → `bg-panel-darkest border-gold/30`
  - 전 입력창: `bg-pixel-dark border-4 border-pixel-dark` → `input-pixel` (INPUT_CLS / TEXTAREA_CLS 상수)
  - 전 버튼: raw `<button>` → `PixelButton` variant별 교체
  - 구성원 행: `border-b border-stone/20` 평면 → `card-pixel p-3` 독립 상자
  - `SectionHeader`: `text-purple` → `t-sub font-bold text-gold t-pixel-shadow`
  - `PixelCard` → `div.card-pixel` 전면 교체
  - `text-pixel-dark` → `text-cream`, `text-stone` → `text-panel-sub`

#### Phase 4-J 완료 ✓ — HomePage·RewardStatusPage·RewardSendPage 개편 (Session 21)
- **HomePage.tsx**: 퀵메뉴 `bg-panel-mid border-2 border-panel-border` → `card-pixel` 입체 상자
- **RewardStatusPage.tsx**: 전면 리팩토링
  - 당월 총합: `bg-gold/10 border-2 border-gold` → `card-highlight` 금빛 강조
  - 연도/월/멤버 탭: raw `<button>` → `PixelButton` variant(purple/sky/gold/ghost)
  - 종류별 합계 뱃지: `bg-cream border-pixel-dark` → `card-pixel`
  - 보상 행: `PixelCard` → `div.card-pixel`
  - `text-pixel-dark` → `text-cream`, `t-heading/t-body/t-micro` 텍스트 위계 정렬
- **RewardSendPage.tsx**: 전 입력/선택창 `input-pixel` (INPUT_CLS/SELECT_CLS), 발송 버튼 `PixelButton variant="gold" size="lg"`, `PixelCard` → `div.card-pixel`

#### Phase 4-K 완료 ✓ — BeggingManagePage 전면 다크 개편 (Session 22)
- **BeggingManagePage.tsx**: 전면 재작성
  - `text-pixel-dark` / `text-stone` → `text-cream` / `text-panel-sub` (가독성 블랙홀 제거)
  - `border-pixel-dark` → `border-black`
  - `PixelCard` 래퍼 → `div.card-pixel` 독립 상자
  - STATUS_CHIP: 테두리 색상 다크 팔레트 동기화 (border-hold/sky/approved/rejected)
  - 섹션 헤더: `font-pixel text-xs text-purple` → `t-heading text-gold t-pixel-shadow`
  - 수락/거절 현황: `text-stone` → `text-panel-sub` / `text-approved`

#### Phase 4-L 완료 ✓ — BeggingPage 전면 다크 개편 + Rule 3 청산 (Session 22)
- **BeggingPage.tsx**: 전면 재작성
  - **규칙 3 위반 청산**: `fixed inset-0 z-[9999]` 전송 완료 toast → `PixelModal` 교체
  - 타입 선택 raw `<button>` → `PixelButton variant="purple"(선택) / "ghost"(미선택)`
  - 전송 raw `<button>` → `PixelButton variant="gold" size="lg" fullWidth`
  - 텍스트에어리어 → `.input-pixel` 표준 적용
  - `text-pixel-dark` / `text-stone` / `bg-cream` 전면 제거 → `text-cream` / `text-panel-sub`
  - 남은 횟수 카드: `PixelCard border-rejected/gold` → `card-pixel` + 조건부 border 클래스
  - 미사용 `SpeechBubble` import 제거

#### Phase 4-M 완료 ✓ — SettingsPage 전면 다크 개편 (Session 22)
- **SettingsPage.tsx**: 전면 재작성
  - `text-pixel-dark` / `text-stone` → `text-cream` / `text-panel-sub`
  - 모든 raw `<button>` → `PixelButton variant="gold" size="lg" fullWidth`
  - 로그아웃 → `PixelButton variant="danger" size="lg" fullWidth`
  - 구성원 목록 `PixelCard` → `div.card-pixel`
  - 관리 링크 raw `<span>` → `PixelButton size="sm" variant="ghost"`
  - 레거시 `btn` 상수 상수 완전 제거

#### Phase 4-N 완료 ✓ — NotificationsPage 다크 테마 + PixelButton 교체 (Session 22)
- **NotificationsPage.tsx**: 부분 리팩토링
  - `PixelButton import` 추가
  - "전체 읽기" raw `<button>` → `PixelButton variant="ghost" size="sm"`
  - 알림 타입 배지: `text-stone bg-stone/10 border-stone/30` → `text-panel-sub bg-panel-surface border-panel-border`
  - 미션명: `text-purple` → `text-gold`
  - 읽지 않은 내용: `font-bold text-pixel-dark` → `font-bold text-cream`
  - 읽은 내용: `text-stone` → `text-panel-sub`
  - 시간: `text-stone` → `text-panel-sub`
  - 빈 상태: `text-stone` → `text-panel-sub`
  - 제목 `font-korean text-base font-bold` → `t-heading t-pixel-shadow`
  - 미읽음 `PixelCard` border → `!border-gold` (Tailwind important 오버라이드)

#### Phase 4-O 완료 ✓ — CalendarPage 버그픽스 (Session 22)
- **CalendarPage.tsx**: 추가 수정
  - `!w-full aspect-square` → `!w-full !h-auto aspect-square` (`h-16` 고정 높이 충돌 해결)
  - 날짜 텍스트: `font-korean text-xs font-bold` → `t-micro font-bold !text-gold/rejected/sky/cream`
  - `getSpecialDaysForDate`: `d.deleted` TS2339 에러 제거 (subscribeSpecialDays가 서버 필터링 담당)
  - `setSpecialDayDocs(docs.filter((d:any) => !d.deleted))` → `setSpecialDayDocs` 직접 전달

#### Phase 4-P 완료 ✓ — InventoryGrid .inventory-slot.selected CSS class 통합 (Session 22)
- **InventoryGrid.tsx**: 슬롯 스타일 상수 업데이트
  - globals.css `.inventory-slot` / `.inventory-slot.selected` / `.inventory-slot.unlocked` 공식 CSS 클래스 사용
  - `!w-full !h-auto`로 `.inventory-slot`의 `w-16 h-16` 고정 치수 오버라이드 → 반응형 격자 유지
  - `SLOT_SELECTED = inventory-slot !w-full !h-auto ... selected` (금테두리 CSS 클래스 연계)

#### [새 마일스톤] 게임 탭 + 레트로 게임 3종 완료 ✓ (Session 23 — v1.8.0)
- **BottomNav.tsx**: 6번째 탭 `🎮 게임` → `/game` 추가. 아이콘 크기 active:26px / inactive:20px 조정
- **App.tsx**: `<Route path="game" element={<GamePage />} />` 등록
- **gameScores.ts** (`src/infrastructure/firebase/collections/`): `GameId` 타입, `saveGameScore()`, `subscribeAllGameScores()` (전체 구독 후 클라이언트 필터 — 인덱스 불필요)
- **GalagaGame.tsx** (`src/presentation/pages/game/`):
  - 32적(4×8 포메이션), 다이빙 AI, 적 총알, 멀티웨이브 (웨이브별 속도 증가)
  - keysRef 패턴: 좌/우/발사 — RAF 루프에서 매 프레임 읽기
  - 터치 패드: ◄ ► (이동) + 🔫 (발사) onTouchStart/End
  - HUD: SCORE, WAVE, 잔여 생명(♥ 삼각형)
- **TetrisGame.tsx** (`src/presentation/pages/game/`):
  - 7종 테트로미노, 고스트 피스, 벽킥 회전 (5오프셋 시도), 자동 낙하 (레벨×속도)
  - keysRef + keyTimer: 좌/우 반복 이동, 소프트 드롭
  - 터치 패드: ◄ ► ▼ (이동/드롭) + ↻ (회전) + ⬇DROP (하드드롭)
- **PonpokoGame.tsx** (`src/presentation/pages/game/`):
  - 너구리 캐릭터 Canvas 드로우, 이단점프(jumps 카운터), 중력 물리
  - 장애물 타입: log(지상) / bird(공중), 코인 수집(+10점)
  - 게임 속도 선형 증가 (frame×0.0012)
  - 터치 패드: 🦘 JUMP 단일 버튼 (이단점프 지원)
- **GamePage.tsx** (`src/presentation/pages/game/`):
  - 선택(selection) → 플레이(playing) → 결과(result) 3단계 뷰 상태 머신
  - 게임 선택 카드: 게임별 최고기록·랭더 미리보기
  - ResultScreen: 순위 메달(🥇🥈🥉) + RankingWidget + 다시하기/나가기 버튼
  - `handleGameOver`: saveGameScore → 개인 최고/1위 추월 판정 → sendMessage(그룹채팅 알림)
  - 채팅 알림 포맷: `[🎮 게임 알림] ⚡ {이름}이(가) {게임}에서 {점수}점으로 {상대}을(를) 제치고 1위를 탈환했습니다!`
- **MissionCard.tsx**: 특별 퀘스트(#D4A843) 텍스트 대비 수정
  - `textMain`: `text-pixel-dark` → `text-[#1C1917]` (Tailwind stone-900)
  - `textSub`: `text-stone`(대비1.3:1) → `text-amber-900`(WCAG AA 달성)
  - 배지 `text-gold` → `text-[#1C1917]`, `opacity-80` 조건부 제거

### 폰트 규칙 (v1.4.0 확정 — 반드시 준수)

```typescript
// 9살 아이 가독성 기준
t-title   → 22px bold  (페이지 대제목)
t-heading → 19px bold  (섹션 헤더)
text-base → 16px       (카드 본문, 주요 텍스트)
text-sm   → 15px       (보조 텍스트, 라벨)
text-xs   → 13px       (날짜, 상태 뱃지) ← 최소값
font-pixel 10px        (Lv, EXP 픽셀 배지 전용)

금지:
  - text-[7px], text-[8px], text-[9px], text-[10px] → 모두 text-xs 이상 사용
  - text-stone/40 ~ text-stone/70 → text-stone 사용 (저채도 금지)
  - text-cream/40 ~ text-cream/70 → text-cream/80 이상 사용
```

### 미완성 (추후 구현)

| 항목 | 우선순위 |
|------|---------|
| 두근두근 질문함 보상 → rewards 컬렉션 자동 기록 | 중간 |
| FCM 푸시 알림 | 낮음 |
| 경쟁 시스템 실시간 UI | 낮음 |

---

## 13. 다음 세션 시작 방법 (Phase 5 — 잔여 페이지 다크 개편 + 코드 정리)

```bash
# 1. 이 파일 읽기 (완료)
# 2. 개발 서버 실행
npm run dev
# → http://192.168.10.15:5173 (로컬망)

# 3. 배포 (버전 자동 증가 포함)
npm run deploy

# 4. 규칙·인덱스만 배포 시
firebase deploy --only firestore:rules,firestore:indexes
```

### 진행 현황 (Session 23 기준)

```
Phase 1 — 완료 ✓ (tailwind 토큰 + PixelButton/PixelCard/PixelModal)
Phase 2 — 완료 ✓ (AppLayout/Header/BottomNav 다크화)
Phase 3 — 완료 ✓ (미션 관련 페이지 전체)
Phase 4 — 완료 ✓ (보조 페이지 15개 다크 개편 전체)
[새 마일스톤] — 완료 ✓ (게임 탭 + 레트로 게임 3종 + 랭킹 + 채팅 알림)

Phase 5 — 다음 작업 ← (잔여 페이지 다크 개편 + 코드 정리)
  잔여 페이지 (다크 테마 미적용):
  - ApprovalListPage — 퀘스트 승인 목록
  - SpecialDaysPage — 기념일·생일 관리
  - QuestionAnswersPage, QuestionBoxPage — 두근두근 질문함
  - StatisticsPage — 통계
  - RegisterPage — 회원가입
  게임 관련 후속 개선 (선택적):
  - 게임 페이지 로딩 코드 스플리팅 (현재 번들 905KB → dynamic import 분리)
  - 갤러그 적 스프라이트 다양화 (현재 사각형 → 곡선 형태)
  - Firestore 게임 인덱스 배포 (firebase deploy --only firestore:indexes)
  코드 정리:
  - TS6133 미사용 import 전면 정리
  - 레거시 필드(memberStatuses, childAccepted) 쿼리 제외
  - 남은 raw <button> → PixelButton 교체 최종 확인
```

### 앱 초기화 로직

```
[handleAppReset] 실행 순서:
  1. PIN 검증
  2. Firestore 전체 삭제 (로그인 상태에서 먼저):
     members/ missions/ rewards/ messages/ notifications/
     begging/ special_days/ question_answers/ notices/
     config/settings + family_codes/{joinCode}
  3. signOut() + clearSession() + clearAllLocalData()
  4. window.location.replace('/login')

[다른 기기 자동 kick-out]
  SessionRestorer → getMember() → null → clearAllLocalData() + location.replace('/login')
```

### 세션 관련 localStorage 키

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

### 코딩 규칙

```typescript
// 1. Firestore 접근은 반드시 infrastructure/firebase/ 헬퍼 경유
// 2. petId 저장: updateMember(..., { 'character.petId': petId }) — dot notation 직접
//    characterId / worldBanner: saveCharacter(newChar) — 전체 객체 교체
// 3. 팝업은 반드시 PixelModal 컴포넌트 사용 (fixed inset-0 z-[9999] 직접 구현 금지)
// 4. 버튼은 PixelButton 컴포넌트 사용 — type="button" 기본값 내장됨
// 5. 새 MissionStatus 추가 시 5개 파일 STATUS 맵 동시 업데이트 (HomePage statusLabel 제외, 섹션 삭제됨)
// 6. 새 Notification 타입 추가 시 Message.ts + NOTIF_ICONS(NotificationsPage) + 홈 피드 필터 모두 업데이트
// 7. PetSprite 이모지는 PET_UNLOCKS에서 자동 생성 — 하드코딩 금지
// 8. 채팅 스크롤은 containerRef.scrollTop = scrollHeight (scrollIntoView 금지)
// 9. 앱 초기화: deleteAllFamilyData() → signOut() → clearAllLocalData() 순서 필수
// 10. MissionDetailPage: useMissionStore(state => state.missions.find(m => m.id === id)) 셀렉터 사용
// 11. 멤버 이름: subscribeMembers()로 실시간 구독 — localStorage 캐시 직접 읽기 금지
// 12. 날짜 슬롯: slot_evaluations.{memberId}.{dateKey} 형태로 Firestore 저장
// 13. loginId 저장은 반드시 fsSet() 사용 — fsUpdate()는 문서 없으면 실패
// 14. 페이지 컴포넌트에서 useMissions()/useNotifications() 호출 금지
//     → AppLayout에서 전역 구독 중. 대신 useMissionStore()/useNotificationStore() 사용
// 15. 보상 기록 생성: sendManualReward() 사용. missionId=null이면 수동/조르기로 분류
// 16. 달력에서 미션 데이터 사용 금지 — 기념일/생일(special_days)만 표시
// 17. 1:1 DM 전송: sendDirectMessage() 사용 (sendMessage receiverId=null은 그룹전용)
// 18. subscribeDirectChat은 양방향 병합 — sent/received 두 구독 후 createdAt 정렬
// 19. 멤버 이름 조회는 useMembers() 훅 사용 — 각 컴포넌트에서 subscribeMembers 직접 호출 금지
// 20. 미션 카드: PixelCard variant="special"(특별퀘스트) / variant="dark"(일반) — inline style backgroundColor 금지
// 21. 상태 배지: StatusBadge 컴포넌트 단일 사용 — 페이지별 STATUS_INFO 별도 정의 금지
// 22. 채팅 말풍선: speech-bubble 클래스 + getBubbleBorderCls(role,id) 조합 사용
//     inline style 또는 bg-cream 직접 지정 금지
// 23. globals.css .t-title/.t-heading 에는 색상+text-shadow 내장됨
//     다른 색 필요 시 Tailwind utility(text-*)로 override (e.g. t-title text-cream)
// 24. 달력 그리드 날짜 칸 — inventory-slot/card-highlight 사용 시 반드시 !w-full aspect-square 추가
//     (inventory-slot의 고정 w-16 h-16과 충돌하므로 !w-full로 강제 override 필수)
// 25. InventoryGrid 슬롯 스타일 — SLOT_SELECTED/SLOT_UNLOCKED/SLOT_LOCKED 상수 사용
//     (inventory-slot 클래스 직접 바인딩 금지 — 고정 크기가 그리드 레이아웃과 충돌)
// 26. 캔버스 게임 컴포넌트 — 게임 상태는 useRef<GameState>로 관리 (RAF stale closure 방지)
//     React state(useState)는 UI 표시용 score/lives/phase만 사용
//     keysRef 패턴: { left, right, fire, ... } → onTouchStart/End + keydown/keyup 모두 동일 ref 수정
//     onGameOver 콜백은 cbRef.current = onGameOver 패턴으로 최신값 유지
// 27. 특별 퀘스트(PixelCard variant="special", 배경 #D4A843) 내 텍스트 규칙:
//     textMain → text-[#1C1917] (Tailwind stone-900에 해당, 대비 12:1 이상)
//     textSub  → text-amber-900 (#78350f, WCAG AA 달성)
//     배지류   → text-[#1C1917] (text-gold 절대 금지 — 황금 배경 위 대비 1:1)
//     opacity-80 등 추가 희석 금지 (이중 가독성 저하)
```

---

*패밀리 퀘스트 — 우리 가족만의 특별한 게임 세계 ⛏*  
*최초 작성: 2026-04-23 | 마지막 업데이트: 2026-05-31 (Session 23 완료 — v1.8.0 배포: 🎮 게임 탭 + 레트로 게임 3종(갤러그/테트리스/너구리) + game_scores 컬렉션 + 가족 랭킹 + 채팅 알림 연동 + 특별 퀘스트 카드 텍스트 대비 WCAG AA 수정)*
