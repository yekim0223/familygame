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

---

## 2. 개발 명령어

```bash
# 개발 서버 (로컬망 전체 허용)
npm run dev

# 프로덕션 빌드 (dist/ 생성)
npm run build         # vite build만 실행 (tsc 체크 없음)

# Firebase 배포
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

> `npm run build`는 `vite build`만 실행 — tsc 오류가 빌드를 막지 않음.  
> Firestore 규칙·인덱스 변경 시 반드시 `firebase deploy --only firestore:*` 실행 필요.

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

### 상태 관리 (Zustand)

- **authStore**: 현재 로그인 멤버, familyId, PIN 잠금
- **missionStore**: 전체 미션 목록 (onSnapshot 구독)
- **messageStore**: 그룹채팅 메시지 + 읽음 상태
- **notificationStore**: 알림 목록 + 미읽음 수
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

### 로그인 흐름 (LoginPage 4개 뷰)

```
'landing' → 'family-code' → 'family-id-input' → 'characters' → PIN → /home

- 초대 코드: 'family' (고정값)
- 가족 비밀 코드: 아빠가 마스터 패널에서 설정 → family_codes/{code} 컬렉션에 저장
- 기존 기기: FAMILY LOGIN 클릭 시 초대 코드 건너뛰고 캐릭터 선택으로 바로 이동
- 세션 복원: App.tsx SessionRestorer가 localStorage(familyId + fq_last_login) 기반으로 복원
- 세션 강제 종료: settings.resetAt > fq_login_at → clearAllLocalData() + window.location.replace('/login')
```

### 핵심 인증 파일

- `src/infrastructure/firebase/auth.ts` — SHA-256 PIN 해시, Anonymous Auth
- `src/application/use-cases/auth/login.ts` — PIN 검증 로직
- `src/application/use-cases/auth/signUp.ts` — 가입 유스케이스 (DAD는 uid=familyId)
- `src/infrastructure/firebase/collections/familyCodes.ts` — 가족 비밀 코드 조회/설정

---

## 6. 미션 시스템 — Daily Slot 방식 (v2)

### 핵심 패러다임 전환

| 이전 방식 | 현재 방식 |
|-----------|-----------|
| 아이: 수락/거절/완료신청 | 아이: 확인 버튼만 (confirmedByChild) |
| 부모: 완료신청 검토 → 승인/반려 | 부모: 날짜별 G/B/H 슬롯 직접 평가 |
| 자동 보상 적립 | 수동 보상 발송 (/settings/rewards-send) |

### 상태 전이 (단순화)

```
ACTIVE  ─[기간 만료 자동]→ EXPIRED
ACTIVE  ─[부모 종료]→ EXPIRED
ACTIVE  ─[모든 슬롯 평가 완료 시]→ APPROVED  (미래 구현 예정)
```

**EXPIRED**: 빨간색 폰트(`text-rejected`) + '종료됨' 표시 — 5개 파일 모두 수정 필요

### Daily Slot 데이터 구조

```typescript
// Mission 엔티티 핵심 필드
slot_evaluations?: Record<string, Record<string, DaySlot>>
// 구조: { memberId: { 'YYYY-MM-DD': 'GOOD' | 'BAD' | 'HOLD' } }

confirmedByChild?: boolean  // 아이 확인 여부
```

### 기간 자동 만료

```typescript
// useMissions.ts — autoExpire()
// 미션 수신 시 endDate < 오늘 && status === 'ACTIVE' → EXPIRED 자동 업데이트
// expiredSet으로 세션당 중복 처리 방지
```

### 미션 관련 주요 함수

```typescript
// missions.ts
updateDaySlot(familyId, missionId, memberId, dateKey, slot)   // 날짜 평가
removeDaySlot(familyId, missionId, memberId, dateKey, evals)  // 평가 취소
confirmQuestByChild(familyId, missionId)                       // 아이 확인
deleteMission(familyId, missionId)                             // 삭제
```

### MissionDetailPage 핵심 구조

```typescript
// Zustand 셀렉터로 즉시 갱신 (navigate 없이도 통계 업데이트)
const mission = useMissionStore(state => state.missions.find(m => m.id === id))

// 멤버 이름: subscribeMembers로 실시간 구독 (localStorage 캐시 의존 금지)
const [members, setMembers] = useState<Member[]>([])
useEffect(() => subscribeMembers(familyId, setMembers), [familyId])
```

### EXPIRED/CHILD_REJECTED 포함 필수 파일 (5곳)

- `src/domain/entities/Mission.ts` — STATUS_LABEL
- `src/presentation/components/missions/MissionCard.tsx` — STATUS_INFO
- `src/presentation/pages/missions/MissionListPage.tsx` — STATUS_SORT
- `src/presentation/pages/home/HomePage.tsx` — statusLabel
- `src/presentation/pages/missions/MissionDetailPage.tsx` — STATUS_LABEL

---

## 7. Firestore 데이터 모델

```
families/{familyId}/
  config/settings     familyCodeHash, joinCode, resetAt
  members/{id}        name, realName, role, pinHash, level, exp,
                      character{characterId,petId,equipment,worldBanner},
                      beggingLeft, beggingWeek, isActive
  missions/{id}       title, category, type, difficulty, targetMemberIds,
                      creatorId, rewards, status, statusHistory,
                      slot_evaluations, confirmedByChild,
                      memberStatuses(레거시), childAccepted(레거시)
  rewards/{id}        missionId(null=수동발송), memberId, approvedBy,
                      rewardType, amount, customLabel, isPaid, approvedAt
  messages/{id}       type(CHAT|CHEER), senderId, receiverId, content
  notifications/{id}  type, targetMemberId, content, relatedId, isRead
  notices/{id}        title, content, authorId, authorName, createdAt
  begging/{id}        submitterId, type, content, status, dadApproved, momApproved
  special_days/{id}   name, type, month, day, isLunar, emoji, deleted
  question_answers/{id} memberId, question, answer, emotion, reward, dateKey

family_codes/{code}   familyId, active  ← 루트 레벨 (가족 찾기 용도)
```

### 중요: notices 컬렉션

```typescript
// infrastructure/firebase/collections/notices.ts
subscribeNotices(familyId, onData)
addNotice(familyId, title, content, authorId, authorName)
deleteNotice(familyId, noticeId)
```

### 중요: rewards 수동 발송

```typescript
// 수동 발송: missionId = null
sendManualReward(familyId, memberId, approvedBy, rewardType, amount, customLabel?)
```

---

## 8. 알림 정책

| 타입 | 발송 조건 | 대상 |
|------|---------|------|
| `MISSION_PENDING` | (레거시) | 부모 |
| `NEW_MISSION` | 퀘스트 생성 | 대상 아이들 |
| `BEGGING_REQUEST` | 아이 조르기 제출 | 부모 전원 |
| `BEG_RESULT` | 조르기 결과 | 신청 아이 |

### 홈 피드 필터링 정책

```typescript
// 부모 피드 ('우리 아이들 신청 보기') — 오늘 날짜 기준 미션
// 아이 피드 ('최근 활동') — 본인 알림, BEGGING_REQUEST 제외
// 공통: NEW_MESSAGE 제외, relatedId+type 중복 제거, 최대 5개
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
// 팝업/토스트 — 화면 정중앙
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-6">

// 메시지 채팅 스크롤 — scrollIntoView 금지
containerRef.current.scrollTop = containerRef.current.scrollHeight

// 보상 종류 합계 — flex-wrap 소형 뱃지 (grid-cols-N 사용 금지)
// EXPIRED 표시 — text-rejected + font-bold (빨간 굵게)
```

### 달력 달성률 이모지 범위

```typescript
// CalendarEmoji.ts
if (percent >= 80) return { emoji: '😄', label: '완전 완료!' }   // 80~100%
if (percent >= 50) return { emoji: '😊', label: '대부분 완료' }  // 50~79%
if (percent >= 1)  return { emoji: '😐', label: '조금 완료' }    // 1~49%
return                    { emoji: '😢', label: '미수행' }
```

---

## 11. 화면 목록 (App Map)

| Route | 화면 | 비고 |
|-------|------|------|
| `/login` | 로그인 (4뷰) | |
| `/register` | 회원가입 | |
| `/master` | 마스터 패널 | ProtectedRoute 밖 |
| `/home` | 홈 대시보드 | 부모/아이 피드 분리 + 공지사항 아코디언 |
| `/missions` | 미션 목록 | 상태 필터·월별·즐겨찾기 |
| `/missions/new` | 미션 생성 | 부모 전용 |
| `/missions/:id` | 미션 상세 | Daily Slot 평가 + 아이별 탭 |
| `/missions/:id/edit` | 미션 수정 | |
| `/calendar` | 달력 (월간/주간/일간) | 특별일 연동, 달성률 이모지 3단계 |
| `/rewards` | 보상 현황 | 당월 총합 + 종류별 합계 |
| `/messages` | 그룹채팅 | 하단 고정 스크롤 |
| `/begging` | 조르기 (아이) | |
| `/begging/manage` | 조르기 관리 (부모) | |
| `/profile` | 프로필·캐릭터·펫·배너 | `location.state.panel`로 탭 자동 오픈 |
| `/notifications` | 알림 전체 목록 | 홈 "전체 보기" 연결 |
| `/settings` | 설정 (부모) | 엄마·아빠 공통 — 보상주기·공지 버튼 포함 |
| `/settings/master` | 설정 (마스터/DAD만) | |
| `/settings/rewards-send` | 아이들 보상주기 | 엄마·아빠 공통 |
| `/settings/notices` | 공지사항 관리 | 엄마·아빠 공통 |
| `/settings/special-days` | 기념일·생일 관리 | |
| `/settings/question-answers` | 두근두근 답변 목록 | 부모 전용 |
| `/settings/questions` | 질문 전체 목록 | |
| `/settings/reward-types` | 보상 종류 관리 | |

---

## 12. 현재 상태 (2026-05-04 Session 12 기준)

### 구현 완료

- **인증**: 가족 비밀 코드 신규 기기 로그인, 기존 기기 스킵, 30분 자동 로그아웃, 앱 초기화 시 모든 기기 강제 kick-out
- **앱 초기화**: Firestore 전체 삭제 + PIN 확인 + window.location.replace — 완전 구현
- **미션 Daily Slot 시스템**: 아이별 날짜 탭 + G/B/H 평가 + 즉시 통계 업데이트 + 평가 완료 색깔 처리
- **퀘스트 자동 만료**: endDate < 오늘 → EXPIRED 자동 처리 (useMissions 훅)
- **보상 수동 발송**: /settings/rewards-send (엄마·아빠 공통)
- **공지사항 시스템**: /settings/notices 관리 + 홈 하단 아코디언 (최근 5개)
- **두근두근 질문함**: 아이 홈 📝 풍선(일 1회), 감정(👍👎), 부모 답변 목록
- **기념일·생일**: `/settings/special-days`, 달력 빨간콩(●) 연동
- **달력**: 월간=달성률(80/50/1% 기준), 주간/일간=특별일+미션 병행
- **디자인**: 벽돌 텍스처 GNB+탭바, 텍스트 없는 탭, 하단탭 노란점 제거
- **홈 피드**: 부모="우리 아이들 신청 보기"(오늘 기준) / 아이="최근 활동", 전체 보기 연결
- **알림**: 정중앙 팝업, BEGGING_REQUEST 네비, 삭제된 미션 안전 처리
- **프로필**: PIN 변경, 마이펫 50종 이모지, 부모 해금목록 숨김
- **메시지**: containerRef.scrollTop으로 채팅 하단 고정
- **보상현황**: 당월 총합 + 종류별 합계 + GIFT 선물명 표시

### 미완성 (추후 구현)

| 항목 | 우선순위 |
|------|---------|
| SCR-16 1:1 채팅 | 중간 |
| 경쟁 시스템 실시간 UI | 낮음 |
| FCM 푸시 알림 | 낮음 |

---

## 13. 다음 세션 시작 방법

```bash
# 1. 이 파일 읽기 (완료)
# 2. 개발 서버 실행
npm run dev
# → http://192.168.10.15:5173 (로컬망)

# 3. Firebase 배포 시
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
```

### 앱 초기화 로직

```
[handleAppReset] 실행 순서:
  1. PIN 검증
  2. Firestore 전체 삭제 (로그인 상태에서 먼저):
     members/ missions/ rewards/ messages/ notifications/
     begging/ special_days/ question_answers/ notices/
     config/settings + family_codes/{joinCode}
  3. Firestore settings.resetAt 기록 (다른 기기 kick-out용)
  4. signOut() + clearSession() + clearAllLocalData()
  5. window.location.replace('/login')

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
// 3. 팝업은 반드시 fixed inset-0 flex items-center justify-center
// 4. 버튼은 type="button" 명시
// 5. 새 MissionStatus 추가 시 5개 파일 STATUS 맵 동시 업데이트
// 6. 새 Notification 타입 추가 시 Message.ts + NOTIF_ICONS + 홈 피드 필터 모두 업데이트
// 7. PetSprite 이모지는 PET_UNLOCKS에서 자동 생성 — 하드코딩 금지
// 8. 채팅 스크롤은 containerRef.scrollTop = scrollHeight (scrollIntoView 금지)
// 9. 앱 초기화: deleteAllFamilyData() → signOut() → clearAllLocalData() 순서 필수
// 10. MissionDetailPage: useMissionStore(state => state.missions.find(m => m.id === id)) 셀렉터 사용
//     (즉시 갱신 위해 getMissionById 함수 대신 직접 셀렉터 사용)
// 11. 멤버 이름: subscribeMembers()로 실시간 구독 — localStorage 캐시 직접 읽기 금지
// 12. 날짜 슬롯: slot_evaluations.{memberId}.{dateKey} 형태로 Firestore 저장
```

---

*패밀리 퀘스트 — 우리 가족만의 특별한 게임 세계 ⛏*  
*최초 작성: 2026-04-23 | 마지막 업데이트: 2026-05-04 (Session 12 최종)*
