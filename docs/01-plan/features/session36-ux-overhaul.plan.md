# Session 36 UX 개편 Plan

> 작성: 2026-06-01 | 버전: v2.7.0 → v2.8.0

## Executive Summary

| 항목 | 내용 |
|------|------|
| Problem | ProfilePage 상단 캐릭터 박스 과대, Header 아이콘 어른 감성, 설정 나열 정신없음, 게임오버 즉시 화면전환 |
| Solution | 컴팩트 가로형 프로필 + 아이 친화 아이콘 + 아코디언 설정 + 게임오버 3초 딜레이 |
| UX Effect | 스크롤 없이 설정 전체 조망, 9세 아이도 직관적 아이콘 인식, 게임오버 이유 파악 가능 |
| Core Value | 가족 4인 모두 불편 없이 사용하는 일관된 UX |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 9세 아이가 직접 사용하는 앱 — 어른 UI 감성 요소 제거 필요 |
| WHO | 하윤·서윤 (9세/7세 아이), 아빠·엄마 (부모) |
| RISK | 게임 gameover 콜백 타이밍 변경 시 중복 호출 방지 필요 |
| SUCCESS | 프로필 상단 스크롤 없이 PIN 카드까지 노출, 아이콘 교체 완료, 아코디언 동작 |
| SCOPE | ProfilePage / Header / SettingsPage / GalagaGame / PonpokoGame / MinesweeperGame |

## 개선 항목

### A. ProfilePage 상단 컴팩트화
- **현재**: `size="xl" animate="bob"` + gradient 배너 박스 p-4 (화면 40% 차지)
- **변경**: `size="md"` + compact 가로형, h-[88px] 이하, 배너 그라디언트 유지하되 p-2.5

### B. Header 아이콘 어린이 친화적 교체
- 🎵 → 🎸 (기타, 음악 = 어린이 친화)
- 🔔 → 🌟 (반짝별, 알림 = 어린이 친화)  
- ⚙️ → 🎒 (배낭, RPG 인벤토리 = 게임 감성)

### C. SettingsPage 아빠 작업공간 아코디언
- 🏆 주간 대회 — 기본 접힘
- ⚡ 엔진 새로고침 — 기본 접힘
- 💾 상태 저장/롤백 — 기본 접힘
- 💀 앱 초기화 — 기본 접힘 (위험, 더 숨김)

### D. 게임 게임오버 3초 딜레이
- GalagaGame: `cbRef.current(score)` → `setTimeout(3000)` wrapping
- PonpokoGame: 동일
- MinesweeperGame: 1800ms → 3000ms

### E. 게임 조작 버튼 개선
- GalagaGame 좌/우 버튼: w-[60px] h-[60px] → w-[72px] h-[72px]
- MinesweeperGame 모드 토글: w-16 h-14 → w-20 h-16, text-[10px] → text-xs
- Back 버튼: 게임 중 화면 귀퉁이 반투명으로 축소 (방해 최소화)
