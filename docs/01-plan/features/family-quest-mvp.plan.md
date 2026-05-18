# Family Quest MVP — Planning Document

> **Summary**: 가족 4인을 위한 모바일 웹 기반 미션-보상 게이미피케이션 앱 (Phase 1+2 통합 MVP)
>
> **Project**: 패밀리 퀘스트 (Family Quest)
> **Version**: 1.0.0
> **Author**: Family Quest Team
> **Date**: 2026-04-23
> **Status**: Approved

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 아이들이 집안일·학습 미션에 자발적으로 참여하지 않고, 부모의 보상 약속이 구두로만 이뤄져 관리가 어렵다. 가족 간 소통도 미션 외 채널이 없어 단절되기 쉽다. |
| **Solution** | 마인크래프트 픽셀 아트 테마로 게임처럼 즐길 수 있는 모바일 웹앱. 부모가 미션을 생성하고 승인하면 보상이 자동 적립. 가족 채팅·조르기 요청·캐릭터 레벨업으로 지속 참여 유도. |
| **Function/UX Effect** | 미션 완료 신청 → 부모 승인 → 즉시 보상 적립의 명확한 워크플로우. 달력 감정 이모지·AI 피드·캐릭터 애니메이션으로 아이들이 매일 앱을 열고 싶게 만든다. |
| **Core Value** | 공정한 보상 체계 + 게임 같은 참여 경험 + 가족 소통 강화. Firebase 무료 플랜으로 완전 무비용 운영. |

---

## Context Anchor

> 설계/구현 단계로 전파되는 핵심 컨텍스트

| Key | Value |
|-----|-------|
| **WHY** | 아이들의 자발적 참여와 공정한 보상 관리를 위해. 구두 약속을 앱으로 투명하게 관리. |
| **WHO** | 아빠(Master)·엄마(Parent)·CHILD_1·CHILD_2, 확장 시 옵저버(비회원 조부모 등) |
| **RISK** | Firebase 실시간 동기화 복잡도, 픽셀 애니메이션 성능 (저사양 스마트폰), 가족 코드 인증 보안 |
| **SUCCESS** | 가족 4명이 매일 앱에 접속하여 미션 진행, 첫 달 미션 승인 10회 이상, 보상 적립 정상 동작 |
| **SCOPE** | Phase 1+2 통합 — 인증·미션·보상·달력·메시지·조르기·캐릭터/레벨·옵저버 포함. 두근두근 질문함·마스터 관리자 패널은 Phase 3. |

---

## 1. Overview

### 1.1 Purpose

가족만을 위한 폐쇄형 미션-보상 앱을 구축한다. 아이들이 미션을 게임 퀘스트처럼 인식하여 자발적으로 참여하고, 부모는 투명하게 보상을 관리할 수 있다.

### 1.2 Background

- 설계서 v1.0(기본 설계) ~ v1.3(추가 기능) 완성
- 기술 스택: React PWA + Firebase + Tailwind CSS + 마인크래프트 픽셀 테마 확정
- 개발 방식: Claude AI와 함께 단계별 구현
- 4인 가족 전용, Firebase 무료 플랜으로 운영 비용 0원

### 1.3 Related Documents

- 설계서 v1.0: `family_app_spec.py`
- 설계서 v1.1: `family_app_spec_v11.py`
- 설계서 v1.2: `family_app_spec_v12.py`
- 설계서 v1.3 (추가/변경): `family_app_spec_v13.py`

---

## 2. Scope

### 2.1 In Scope (Phase 1+2 통합 MVP)

**Phase 1 — 핵심 기반**
- [x] 가족 인증 시스템 (가족 비밀 코드 + 개인 PIN, 생년월일시, 한국 나이)
- [x] 미션 시스템 (일일/주간/월간/기간, 10종 카테고리, 난이도 5단계)
- [x] 미션 승인 워크플로우 (완료신청 → 승인/보류/미승인)
- [x] 보상 적립 (용돈·게임시간·핸드폰시간·선물·자유 보상, 커스텀 최대 10종)
- [x] 달력 — 월간 뷰 (생일·기념일, 마인크래프트 감정 이모지)
- [x] 홈 대시보드 (오늘의 퀘스트, 이번 주 진행률, 보상 요약)
- [x] 마인크래프트 픽셀 테마 (여아 감성 퍼플+핑크 포인트, Press Start 2P + Nanum Gothic Coding)
- [x] Firebase Hosting 배포 + 실시간 동기화

**Phase 2 — 핵심 경험**
- [x] AI 활동 피드 (홈에서 가족 미션 현황 자동 공지)
- [x] 로그인 캐릭터 애니메이션 (역할별·카테고리별 픽셀 시나리오)
- [x] 캐릭터+반려동물 조합 선택 및 변경 (인벤토리 UI)
- [x] 레벨 점수 시스템 (난이도 1~5점, Lv.100, 구간별 EXP)
- [x] 캐릭터 장비 아이템 (레벨 5마다 해금)
- [x] 조르기(요청) 시스템 (주 1회 제한, 레벨 5마다 +1회, 부모 양쪽 승인)
- [x] 가족 메시지 채팅 (단체·1:1·응원함 3분류)
- [x] 응원 이모티콘 시스템 (8종, 옵저버도 전송 가능)
- [x] 옵저버 비회원 시스템 (11종 유형, 24시간 세션, 최대 5명)
- [x] 달력 — 주간/일간 뷰 + 감정 이모지 자동 표시
- [x] 미션 거절/수정 제안 기능 (아이 → 부모)
- [x] 딸 경쟁 시스템 (주간 은왕관/월간 금왕관 수여)
- [x] 보상 히스토리 (연도·월 누적 조회, 한국 나이 기준)
- [x] 통계 화면 (차트, 레벨 현황, 경쟁 현황) — 부모 전용
- [x] 마인크래프트 세계관 배너 10종 (프로필 배경)
- [x] 알림 시스템 (앱 내 뱃지, 미션·레벨·조르기·응원)
- [x] 월별 정산 (Firebase Cloud Functions, 매월 1일 자동)
- [x] PWA 홈 화면 추가 아이콘

### 2.2 Out of Scope (Phase 3 / v2.0)

- 두근두근 질문함 (Lucky Question Box) — v1.3 신규, 복잡도 높음
- 마스터 관리자 패널 (Master Admin) — v1.3 신규, 28개 메뉴
- 계절/이벤트 테마 자동 변경
- 메시지 사진 첨부
- 히스토리 CSV 내보내기
- Firebase Cloud Messaging 푸시 알림 (외부 앱 알림)
- 다크 모드
- 게임 사운드 이펙트

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | 가족 비밀 코드 + 개인 PIN으로 회원가입/로그인 (이메일 불필요) | High | Pending |
| FR-02 | 아빠(Master)·엄마(Parent)·CHILD_1·CHILD_2 역할별 권한 분리 | High | Pending |
| FR-03 | 생년월일시 입력 및 한국 나이 자동 계산·표시 | Medium | Pending |
| FR-04 | 미션 생성 (제목·카테고리·유형·난이도·대상·보상·반복 설정) | High | Pending |
| FR-05 | 미션 상태 관리 (ACTIVE → PENDING_APPROVAL → APPROVED/ON_HOLD/REJECTED/EXPIRED) | High | Pending |
| FR-06 | 미션 완료 신청 → 부모 승인/보류/미승인 워크플로우 | High | Pending |
| FR-07 | 미션 승인 시 보상 즉시 적립 + 레벨 EXP 동시 적립 | High | Pending |
| FR-08 | 아이가 못하겠는 미션 거절 또는 수정 요청 제출 가능 | Medium | Pending |
| FR-09 | 보상 6종 기본 제공 (용돈/게임시간/핸드폰시간/선물/외식/자유) + 커스텀 최대 10종 | High | Pending |
| FR-10 | 달력 월간/주간/일간 뷰, 날짜별 감정 이모지 자동 표시 | High | Pending |
| FR-11 | 생일·결혼기념일 달력 자동 표시 + 말풍선 팝업 | Medium | Pending |
| FR-12 | 홈 대시보드: AI 활동 피드, 로그인 캐릭터 애니메이션, 오늘의 퀘스트 | High | Pending |
| FR-13 | 가족 채팅 (단체·1:1) + 응원 이모티콘(8종) + 알림함 3분류 | High | Pending |
| FR-14 | 조르기 요청 (주 1회 기본 + 레벨 5마다 +1회, 부모 양쪽 승인 필요) | High | Pending |
| FR-15 | 옵저버 비회원 접속 (이름+전화뒤4자리+유형11종, 24시간, 최대 5명/동시 1명) | Medium | Pending |
| FR-16 | 옵저버: 홈 화면 구경, 응원 이모티콘 전송, 단체채팅 읽기 전용 | Medium | Pending |
| FR-17 | 캐릭터+반려동물 선택 (인벤토리 그리드 UI), 레벨 해금 시스템 | High | Pending |
| FR-18 | 레벨 시스템 (난이도 1~5점, 구간별 EXP, Lv.100까지, 구간별 해금 혜택) | High | Pending |
| FR-19 | 캐릭터 장비 아이템 (레벨 5마다 해금: 검·갑옷 등) | Medium | Pending |
| FR-20 | 딸 경쟁 시스템 (주간 은왕관/월간 금왕관 자동 수여, 상징물 현금 교환) | Medium | Pending |
| FR-21 | 마인크래프트 세계관 배너 10종 (프로필 배경 선택) | Low | Pending |
| FR-22 | 보상 히스토리 연도·월 누적 조회 (한국 나이 기준 레이블) | High | Pending |
| FR-23 | 통계 화면: 월별 차트, 레벨 현황, 경쟁 현황 (부모 전용) | Medium | Pending |
| FR-24 | 월별 정산 자동화 (Firebase Cloud Functions, 매월 1일 00:00) | High | Pending |
| FR-25 | 앱 내 알림 뱃지 (미션·레벨업·조르기·응원 알림) | High | Pending |
| FR-26 | PWA — 홈 화면 추가 아이콘 (manifest.json) | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | 측정 방법 |
|----------|----------|----------|
| Performance | 화면 초기 로드 < 3초 (3G 환경) | Lighthouse |
| Performance | 미션 승인 반응 < 500ms (Firestore 기준) | 브라우저 DevTools |
| Responsiveness | 모바일 세로 360px~428px 최적화 | 기기 테스트 |
| Security | 가족 코드 없이 가입 불가, PIN 오입력 3회 30초 잠금 | 수동 테스트 |
| Reliability | Firestore 실시간 동기화 — 데이터 일관성 유지 | 멀티 디바이스 테스트 |
| Accessibility | 폰트 최소 크기 11px 이상, 주요 버튼 터치 영역 44px 이상 | 육안 확인 |
| Cost | Firebase 무료 플랜 한도 이내 운영 (읽기 50K/일, 쓰기 20K/일) | Firebase Console |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 가족 4명 모두 회원가입 후 각자 로그인 가능
- [ ] 부모가 미션 생성 → 아이가 완료 신청 → 부모 승인 → 보상 적립 전체 플로우 동작
- [ ] 달력에서 미션 감정 이모지 자동 표시
- [ ] 가족 채팅 실시간 전송·수신 동작
- [ ] 조르기 요청 제출 → 부모 양쪽 승인 동작
- [ ] 캐릭터 선택 및 레벨 EXP 적립 동작
- [ ] 옵저버 비회원 접속 및 응원 이모티콘 전송 동작
- [ ] Firebase Hosting 배포 완료, HTTPS 접속 가능
- [ ] PWA manifest 설정, 홈 화면 추가 가능

### 4.2 Quality Criteria

- [ ] 모바일 Chrome·Safari 기본 동작 확인
- [ ] Lighthouse Performance 점수 70 이상
- [ ] Firebase 읽기/쓰기 일일 한도 여유 있음
- [ ] 픽셀 애니메이션 저사양 기기에서 버벅임 없음 (CSS only)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Firebase 실시간 리스너 과다 구독 → 성능 저하 | High | Medium | 화면별 구독 범위 최소화, onSnapshot 언마운트 정리 |
| 픽셀 스프라이트 애니메이션 저사양 기기 성능 | Medium | Medium | CSS Keyframe만 사용, Canvas는 최소화, prefers-reduced-motion 지원 |
| 가족 코드 유출 시 외부인 가입 | High | Low | 가족 코드 Firestore 서버사이드 검증, 변경 기능 아빠 전용 |
| Firestore 보안 규칙 설계 오류 → 데이터 노출 | High | Medium | 역할별 read/write 규칙 철저히 정의 (family scoped) |
| Cloud Functions 월별 정산 실패 | Medium | Low | 수동 정산 폴백 UI 제공, Functions 실패 시 알림 |
| Press Start 2P 폰트 로드 지연 | Low | Medium | Google Fonts preconnect, font-display: swap |

---

## 6. Impact Analysis

### 6.1 Changed Resources (신규 프로젝트)

| Resource | Type | 설명 |
|----------|------|------|
| Firestore `families/{id}/members` | DB Collection | 구성원 프로필, 역할, 레벨, 캐릭터 |
| Firestore `families/{id}/missions` | DB Collection | 미션 목록 및 상태 관리 |
| Firestore `families/{id}/rewards` | DB Collection | 보상 적립 히스토리 |
| Firestore `families/{id}/messages` | DB Collection | 채팅 메시지 |
| Firestore `families/{id}/notifications` | DB Collection | 앱 내 알림 |
| Firestore `families/{id}/competition` | DB Collection | 주간/월간 왕관 기록 |
| Firestore `families/{id}/settings` | DB Document | 가족 설정 (코드, 보상 종류, 달력 특별일) |
| Firebase Auth | Auth | 커스텀 인증 (가족 코드 + PIN) |
| Firebase Hosting | Hosting | React PWA 정적 배포 |
| Firebase Cloud Functions | Serverless | 월별 정산, 미션 자동 리셋, 주간/월간 왕관 집계 |

### 6.2 Current Consumers

신규 프로젝트로 기존 소비자 없음. 설계 단계에서 Firestore 보안 규칙을 통해 역할별 접근 제어를 정의한다.

### 6.3 Verification

- [ ] 아빠(Master): 모든 컬렉션 read/write
- [ ] 엄마(Parent): settings 일부 제외 read/write
- [ ] CHILD: 본인 관련 read, 제한된 write (완료신청, 조르기)
- [ ] OBSERVER: 아이 관련 read only, 응원 write만 허용

---

## 7. Architecture Considerations

### 7.1 Project Level: Dynamic

| Level | Characteristics | Selected |
|-------|-----------------|:--------:|
| Starter | 단순 구조 | ☐ |
| **Dynamic** | 기능별 모듈, Firebase BaaS 통합 | ✅ |
| Enterprise | 엄격한 레이어 분리, 마이크로서비스 | ☐ |

Firebase 실시간 DB + 커스텀 인증 + Cloud Functions 조합은 Dynamic 레벨에 최적.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | **React 18 + Vite** | 빠른 빌드, PWA 플러그인 |
| 라우팅 | React Router / TanStack Router | **React Router v6** | 표준, 파일 기반 |
| 상태 관리 | Context / Zustand / Redux | **Zustand** | 가볍고 단순, Firebase 리스너 연동 용이 |
| API/Data | fetch / axios / react-query | **Firebase SDK + Zustand** | 실시간 동기화, 별도 API 서버 불필요 |
| 폼 처리 | react-hook-form / formik | **react-hook-form** | 경량, Tailwind 연동 용이 |
| 스타일링 | Tailwind / CSS Modules | **Tailwind CSS v3 + CSS Modules** | 픽셀 커스텀 테마, 컴포넌트별 격리 |
| 애니메이션 | Framer Motion / GSAP / CSS | **CSS Keyframes + Canvas (최소)** | 외부 라이브러리 없음, 성능 최우선 |
| 테스트 | Jest / Vitest / Playwright | **Vitest + Playwright** | Vite 생태계, E2E 포함 |
| 인증 | Firebase Auth | **Firebase Auth (커스텀)** | 가족 코드 + PIN 방식 |
| 스케줄 | Cloud Functions | **Firebase Cloud Functions** | 월정산, 미션 리셋 |

### 7.3 폴더 구조 (Dynamic Level)

```
src/
├── features/                # 기능별 모듈
│   ├── auth/               # 인증 (로그인·회원가입·옵저버)
│   ├── missions/           # 미션 시스템
│   ├── rewards/            # 보상·정산·통계
│   ├── calendar/           # 달력 (월간·주간·일간)
│   ├── messages/           # 채팅·응원·알림
│   ├── begging/            # 조르기 시스템
│   ├── characters/         # 캐릭터·레벨·장비
│   ├── competition/        # 딸 경쟁 시스템
│   └── observer/           # 옵저버 비회원
├── components/             # 공통 컴포넌트
│   ├── layout/             # 헤더·하단탭·드로어
│   ├── pixel/              # 픽셀 UI (버튼·카드·말풍선·EXP바)
│   └── animations/         # CSS 애니메이션 컴포넌트
├── lib/
│   ├── firebase.ts         # Firebase 초기화
│   ├── firestore.ts        # Firestore 헬퍼
│   └── utils.ts            # 한국 나이, 날짜 유틸
├── stores/                 # Zustand 스토어
│   ├── authStore.ts
│   ├── missionStore.ts
│   ├── rewardStore.ts
│   └── notificationStore.ts
├── types/                  # TypeScript 타입 정의
│   └── index.ts
├── hooks/                  # 커스텀 훅
├── styles/                 # 전역 스타일, Tailwind 설정
│   ├── globals.css
│   └── pixel-theme.css     # 마인크래프트 픽셀 테마
└── pages/                  # 라우팅 페이지 컴포넌트
```

---

## 8. Convention Prerequisites

### 8.1 Conventions to Define

| Category | Rule |
|----------|------|
| **네이밍** | 컴포넌트 PascalCase, 파일 kebab-case, 상수 UPPER_SNAKE_CASE |
| **폴더** | feature별 index.ts 배럴 export |
| **CSS** | Tailwind 우선, 픽셀 고유 스타일은 CSS Module |
| **Firebase** | 모든 Firestore 접근은 `lib/firestore.ts` 헬퍼 경유 |
| **상태** | 서버 데이터는 Zustand + Firebase 리스너, UI 상태는 useState |
| **타입** | 모든 Firestore 문서에 TypeScript 타입 정의 필수 |
| **에러 처리** | Firebase 에러는 사용자 친화적 메시지로 변환 후 표시 |

### 8.2 Environment Variables

| Variable | Purpose | Scope |
|----------|---------|-------|
| `VITE_FIREBASE_API_KEY` | Firebase 프로젝트 키 | Client |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth 도메인 | Client |
| `VITE_FIREBASE_PROJECT_ID` | Firestore 프로젝트 ID | Client |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage 버킷 | Client |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender | Client |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | Client |

### 8.3 색상 토큰 (tailwind.config.js)

```js
colors: {
  grass:    '#5C8A1E',  // 잔디 초록 — 배경 블록
  dirt:     '#8B5E3C',  // 흙 갈색 — 카드 테두리
  stone:    '#9E9E9E',  // 돌 회색 — 비활성
  gold:     '#FFD700',  // 금색 — 보상·EXP·CTA 버튼
  sky:      '#4FC3F7',  // 하늘 블루 — 달력·메시지
  purple:   '#7B5EA7',  // 라벤더 퍼플 — 포인트 (여아)
  pink:     '#E8A0BF',  // 연한 핑크 — 포인트 (여아)
  cream:    '#FFF8F0',  // 크림 화이트 — 카드 내부
  approved: '#43A047',  // 승인 그린
  rejected: '#E53935',  // 미승인 레드
  hold:     '#FB8C00',  // 보류 오렌지
}
```

---

## 9. Firestore 데이터 모델 (핵심)

```
families/{familyId}
  ├── settings (doc)
  │     familyCode: string       # 가족 비밀 코드 (해시 저장)
  │     rewardTypes: array       # 커스텀 보상 종류
  │     specialDays: array       # 생일·기념일
  │     createdAt: timestamp
  │
  ├── members/{memberId} (col)
  │     name: string             # 닉네임
  │     role: 'DAD'|'MOM'|'CHILD'|'OBSERVER'
  │     birthDate: timestamp
  │     birthHour: number        # 태어난 시간 (0~23)
  │     pinHash: string          # PIN 해시
  │     level: number
  │     exp: number
  │     character: string        # 캐릭터 ID
  │     pet: string              # 반려동물 ID
  │     equipment: array         # 장비 아이템 목록
  │     worldBanner: string      # 세계관 배너 ID
  │     beggingLeft: number      # 이번 주 조르기 남은 횟수
  │     isActive: boolean
  │
  ├── missions/{missionId} (col)
  │     title: string
  │     category: string         # 10종 카테고리
  │     type: 'DAILY'|'WEEKLY'|'MONTHLY'|'CUSTOM'
  │     difficulty: 1|2|3|4|5
  │     targetMemberIds: array
  │     creatorId: string        # 생성한 부모 ID
  │     rewards: array           # [{type, amount}]
  │     status: 'ACTIVE'|'PENDING_APPROVAL'|'APPROVED'|'ON_HOLD'|'REJECTED'|'EXPIRED'
  │     completedBy: string      # 완료 신청한 구성원 ID
  │     repeatEnabled: boolean
  │     startDate: timestamp
  │     endDate: timestamp
  │     emoji: string
  │     isFavorite: boolean
  │
  ├── rewards/{rewardId} (col)
  │     missionId: string
  │     memberId: string
  │     rewardType: string
  │     amount: number
  │     approvedBy: string
  │     approvedAt: timestamp
  │     isPaid: boolean          # 실물 지급 완료 여부
  │
  ├── messages/{messageId} (col)
  │     type: 'CHAT'|'CHEER'|'SYSTEM'
  │     senderId: string
  │     receiverId: string|null  # null = 전체
  │     content: string
  │     emoji: string|null       # 응원 이모티콘
  │     targetMissionId: string|null
  │     createdAt: timestamp
  │     readBy: array
  │
  ├── notifications/{notifId} (col)
  │     type: 'MISSION_APPROVED'|'MISSION_REJECTED'|'LEVEL_UP'|'BEG_RESULT'|'CHEER'
  │     targetMemberId: string
  │     content: string
  │     relatedId: string
  │     isRead: boolean
  │     createdAt: timestamp
  │
  └── competition/{year_week} (col)
        weekWinner: string       # 주간 왕관 구성원 ID
        monthWinner: string|null # 월간 왕관 구성원 ID
        scores: map              # {memberId: score}
        crownExchanged: boolean
```

---

## 10. 화면 목록 (총 25개)

| ID | 화면명 | 대상 | Phase |
|----|--------|------|-------|
| SCR-01 | 스플래시/로딩 | 전체 | 1 |
| SCR-02 | 로그인 (캐릭터 선택+PIN) | 전체 | 1 |
| SCR-03 | 회원가입 (4단계 폼) | 신규 | 1 |
| SCR-03b | 옵저버 Guest 접속 | 옵저버 | 2 |
| SCR-04 | 홈 대시보드 | 전체 | 1+2 |
| SCR-04b | 옵저버 홈 (열람 전용) | 옵저버 | 2 |
| SCR-05 | 미션 목록 (필터+정렬) | 전체 | 1 |
| SCR-06 | 미션 상세 (완료신청+승인) | 전체 | 1 |
| SCR-07 | 미션 생성/수정 | 부모 | 1 |
| SCR-08 | 미션 승인 관리 | 부모 | 1 |
| SCR-09 | 달력 (월간) | 전체 | 1 |
| SCR-10 | 달력 (주간) | 전체 | 2 |
| SCR-11 | 달력 (일간) | 전체 | 2 |
| SCR-12 | 보상 현황 (연도·월 필터) | 전체 | 2 |
| SCR-13 | 히스토리 (연도·월 아코디언) | 전체 | 2 |
| SCR-14 | 통계 (차트, 레벨, 경쟁) | 부모 | 2 |
| SCR-15 | 가족 단체 채팅 | 전체 | 2 |
| SCR-16 | 1:1 채팅 | 전체 | 2 |
| SCR-17 | 조르기 요청 (아이) | CHILD | 2 |
| SCR-18 | 조르기 관리 (부모) | 부모 | 2 |
| SCR-19 | 프로필 (캐릭터+레벨+배너) | 전체 | 2 |
| SCR-20 | 설정 (부모) — 구성원·보상 관리 | 부모 | 2 |
| SCR-21 | 설정 (아빠/Master) — 역할·코드 관리 | DAD | 2 |
| SCR-22 | 알림 목록 | 전체 | 1+2 |
| SCR-응원 | 응원함 (메시지 탭 내부) | 전체 | 2 |

---

## 11. 개발 순서 (권장)

```
[1주차] 프로젝트 세팅 + 인증
  → Vite+React 초기화, Firebase 연결, Tailwind 픽셀 테마
  → 회원가입·로그인 (가족 코드, PIN, 역할, 캐릭터 선택)
  → Firestore 보안 규칙 초안

[2주차] 미션 코어
  → 미션 생성·목록·상세 화면
  → 완료 신청 → 승인/보류/미승인 워크플로우
  → 보상 즉시 적립 + EXP 적립

[3주차] 달력 + 홈
  → 월간 달력 (감정 이모지 자동 표시, 생일·기념일)
  → 홈 대시보드 (오늘의 퀘스트, AI 피드, 로그인 애니메이션)
  → 알림 뱃지 시스템

[4주차] 메시지 + 조르기
  → 가족 채팅 (단체·1:1)
  → 응원 이모티콘 시스템
  → 조르기 요청·관리

[5주차] 캐릭터 + 레벨 + 보상 히스토리
  → 캐릭터+반려동물 인벤토리 UI
  → 레벨 EXP 시스템, 해금 로직
  → 보상 히스토리 (연도·월 필터)
  → 통계 화면 (차트)

[6주차] 옵저버 + 경쟁 + 정산 + 배포
  → 옵저버 비회원 접속 시스템 (11종)
  → 딸 경쟁 시스템 (주간/월간 왕관)
  → Cloud Functions (월정산, 미션 리셋, 왕관 집계)
  → 주간/일간 달력 뷰
  → Firebase Hosting 배포 + PWA manifest
```

---

## 12. Next Steps

1. [ ] `/pdca design family-quest-mvp` — Design 문서 생성 (아키텍처 선택, 컴포넌트 설계)
2. [ ] Firebase 프로젝트 생성 및 `.env` 설정
3. [ ] Vite + React 프로젝트 초기화
4. [ ] `/pdca do family-quest-mvp --scope module-1` — 인증 모듈부터 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-23 | 초안 작성 (v1.0~v1.3 설계서 통합 분석 기반) | Family Quest Team |
