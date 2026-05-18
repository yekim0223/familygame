# 패밀리 퀘스트 — 배포 가이드

## 1. Firebase 프로젝트 최초 설정

### Firebase Console에서 프로젝트 생성
1. https://console.firebase.google.com/ 접속
2. "프로젝트 추가" → 프로젝트 이름: `family-quest`
3. Firestore Database → "데이터베이스 만들기" → 아시아 태평양 (asia-northeast3, 서울)
4. Authentication → 로그인 방법 → 익명 → 사용 설정
5. Hosting → 시작하기

### .env.local 설정
```
# Firebase Console → 프로젝트 설정 → 웹 앱 → 구성에서 복사
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### .firebaserc 업데이트
```json
{
  "projects": {
    "default": "실제-프로젝트-ID"
  }
}
```

---

## 2. 로컬 개발 시작

```bash
# 의존성 설치
npm install
cd functions && npm install && cd ..

# 개발 서버 실행
npm run dev
```

---

## 3. Firebase 에뮬레이터 (선택사항)

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 로그인
firebase login

# 에뮬레이터 시작
firebase emulators:start

# .env.local에 추가
VITE_USE_EMULATOR=true
```

---

## 4. Firestore 보안 규칙 배포

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 5. 프로덕션 배포

```bash
# 빌드
npm run build

# Firebase Hosting 배포
firebase deploy --only hosting

# Cloud Functions 배포
firebase deploy --only functions

# 전체 배포
firebase deploy
```

---

## 6. 커스텀 도메인 설정 (선택)

1. Firebase Console → Hosting → 커스텀 도메인 추가
2. 도메인 구매: familyquest.kr (연 1~2만원, 가비아·후이즈 등)
3. DNS 설정 후 SSL 자동 발급 (24시간 내)

---

## 7. 아이콘 파일 생성

PWA를 위해 아래 파일이 필요합니다:
- `public/icon-192.png` — 192×192 앱 아이콘
- `public/icon-512.png` — 512×512 앱 아이콘

마인크래프트 ⛏ 곡괭이 이미지를 픽셀 아트로 제작하여 public 폴더에 넣어주세요.

---

## 8. 배포 후 최초 설정

1. 앱 URL 접속 (`https://your-project.web.app`)
2. "우리 가족 인증하기" → 아빠(DAD)로 가입
3. 생성된 **가족 ID**를 엄마·딸들과 공유
4. 나머지 가족 구성원 각자 가입
5. 아빠 계정으로 미션 첫 생성 → 테스트 완료!
