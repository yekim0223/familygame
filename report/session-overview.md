# Family Quest — 세션별 주요 작업 요약

> 마지막 업데이트: 2026-06-04 (Session 49 → v7.4 기준)

---

## 버전 히스토리 (주요 마일스톤)

| 버전 | 세션 | 핵심 작업 |
|------|------|-----------|
| 1.0 | S1~S22 | 기본 인증·미션·보상·달력·메신저·알림 |
| 1.8 | S23 | 게임 탭 + 레트로 게임 3종 (갤러그·테트리스·너구리) |
| 1.9 | S24 | Web Audio 8비트 BGM 4테마 + SFX 전면 연동 |
| 2.0 | S28 | 게임 대개편 (지뢰찾기·두더지잡기·뱀꼬리 삭제→재편) |
| 2.1 | S29 | XP 재화 단일화 + 인벤토리 슬롯 상점 |
| 2.9 | S37 | UX 전면 통일 (NavRow+Accordion) + 게임 카운트다운 |
| 3.1 | S42 | Gap 91%+ 달성 + 도파민 이펙트 T1~T7 |
| 5.8 | S45 | SVG 픽셀아트 전면 교체 (캐릭터·펫·배경·장비 257종+) |
| 6.1 | S46 | 언도쿠(sudoku) 게임 신규 + 게임 HUD 버튼 통일 |
| 6.5 | S48 | SVG 카탈로그 + 갤러그 생명 HUD 중복 제거 |
| 7.1 | S49 | 게임 4종 대규모 업그레이드 + 캐릭터 시스템 확장 |
| 7.2 | S50 | members.html 가족소개 페이지 + 감정 인터랙션 |
| 7.3 | S50 | LoginAnimation Loading 제거 (즉시 START!) |
| 7.4 | S50 | 메뉴소개 위치 이동 (헤더 드롭다운 → 프로필 설정 하단) |

---

## 아키텍처 핵심 규칙

### Clean Architecture 4레이어
```
Presentation → Application → Domain ← Infrastructure
```
- **컴포넌트에서 Firestore 직접 접근 절대 금지**
- AppLayout에서 `useMissions()` + `useNotifications()` 전역 구독
- 각 페이지는 `useMissionStore()` / `useNotificationStore()` 로만 읽기

### Zustand 스토어 구조
| 스토어 | 역할 |
|--------|------|
| authStore | 로그인 멤버, familyId, PIN |
| missionStore | 전체 미션 목록 |
| notificationStore | 알림 + 미읽음 수 |
| messageStore | 그룹채팅 |
| rewardStore | 보상 목록 |
| userInventoryStore | XP·무기·스킨·펫·배경 localStorage 영속 |

---

## SVG 에셋 시스템

### 에셋 구조 (`/public/assets/`)
| 카테고리 | 수량 | viewBox | 렌더 크기 |
|----------|------|---------|-----------|
| characters/ | 103종 | 32×32 | 40–112px |
| pets/ | 50종 | 16×16 | 32–48px |
| backgrounds/ | 50종 | 32×16 (2:1) | card bg |
| icons/ | 29종 | 16×16 | 20–36px |
| gear/ (무기·투구·방패·갑옷) | 25종 | 32×32 | 17–38px overlay |

### 장비 Z-index 레이어 순서
```
갑옷(8) < 투구(10) < 방패(12) < 무기(13)
```

### CharacterSprite prop 규칙
- `petId={null}` → 펫 강제 미표시 (로그인 카드 등)
- `weapon={null}` → 무기 강제 미표시
- `petId` 미전달 → `useInventoryStore.currentPet` 폴백
- `weapon` 미전달 → `useInventoryStore.currentWeapon` 폴백

---

## 게임 시스템

### GameId (Firebase 저장 키 — 절대 불변)
```
'galaga' | 'ponpoko' | 'minesweeper' | 'whacamole' | 'sudoku'
```

### 게임별 특징
| 게임 | 타입 | 특징 |
|------|------|------|
| GalagaGame | Canvas 슈터 | 웨이브별 누적곱 난이도, 특수적 3종, 아이템 사인파 |
| PonpokoGame (슈퍼점핑) | Canvas 러너 | 내 캐릭터 SVG, 빨간코인 10% (+20pts) |
| MinesweeperGame (마이펫찾기) | DOM Grid | 마이펫 SVG 지뢰, BFS 연쇄오픈 |
| WhacAMoleGame (아빠잡기) | Canvas | base-dad SVG, 배경 5종, 엄마 캐릭터 |
| SudokuGame (언도쿠) | DOM 그리드 | 5난이도, 생명 2개, 가변 타이머 |

### 점수 저장
- 일반: `game_scores/{id}` (memberId, gameId, score, playedAt)
- 대회: `tournament_scores/{id}` (roundNumber 추가)

---

## 보상 체계 (v5.8 확정)

| 보상 종류 | 발생 조건 | rewards 컬렉션 source |
|-----------|-----------|----------------------|
| 수동 발송 | 부모 직접 발송 | `manual` |
| 퀘스트 완료 XP | 퀘스트 ⏹ 종료, 난이도×10 | `xp_quest` |
| 두근두근 XP | 답변 제출 +10/+20 | `xp_question` |
| 게임 1위 XP | 가족 1위 탈환 +10 | `xp_game` |

---

## 홈 화면 인터랙션 (v7.2+)

### 캐릭터/펫 터치 감정 반응
- **1~2회 탭**: music / star / begging SVG 아이콘 우상단 플로팅
- **3~4회 연타 (2.5초 내)**: 캐릭터 작은 진동 + 이동 멈춤 (annoyedLevel=1)
- **5회+ 연타**: 큰 진동 + skull 아이콘 (annoyedLevel=2)
- **3초 무탭**: 자동 리셋
- **캐미오 클릭**: skull 즉시 출현 → 700ms 후 소멸

### 홈 캐릭터 규칙
```typescript
displayCharId = currentMember.character.characterId  // Firebase 직접 (localStorage 금지)
displayPetId  = currentMember.character.petId
```

---

## 인증 흐름

```
기존 기기: landing → FAMILY LOGIN → characters → PIN → /home
새 기기: landing → loginId 입력 → PIN → /home
         또는: 가족코드 입력 → characters → PIN → /home
```

**loginId 저장**: 반드시 `fsSet()` (fsUpdate는 문서 없으면 실패)

---

## 배포 규칙
- `npm run deploy` = 버전 0.1 자동 증가 + vite build + firebase deploy
- 로컬 확인 후 명시적 지시가 있을 때만 실행
- Firestore rules/indexes 변경 시: `firebase deploy --only firestore:rules,firestore:indexes` 별도 실행
