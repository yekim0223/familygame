// Design Ref: §7 Security — PIN SHA-256 해시, Firebase Anonymous Auth
import { signInAnonymously, signOut as fbSignOut } from 'firebase/auth'
import { auth } from './config'

// ── SHA-256 구현 ─────────────────────────────────────────────────
// crypto.subtle (HTTPS/localhost 전용)을 우선 사용하고,
// 비보안 컨텍스트(로컬 IP 접근 등)에서는 순수 JS 구현으로 폴백합니다.

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

function sha256Js(text: string): string {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ])
  const h = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ])

  const bytes = new TextEncoder().encode(text)
  const bitLen = bytes.length * 8
  const blockCount = Math.ceil((bytes.length + 9) / 64)
  const padded = new Uint8Array(blockCount * 64)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 4, bitLen >>> 0, false)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false)

  const W = new Uint32Array(64)
  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j++) W[j] = dv.getUint32(i + j * 4, false)
    for (let j = 16; j < 64; j++) {
      const s0 = rotr32(W[j-15], 7) ^ rotr32(W[j-15], 18) ^ (W[j-15] >>> 3)
      const s1 = rotr32(W[j-2], 17) ^ rotr32(W[j-2], 19) ^ (W[j-2] >>> 10)
      W[j] = (W[j-16] + s0 + W[j-7] + s1) >>> 0
    }
    let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7]
    for (let j = 0; j < 64; j++) {
      const S1  = rotr32(e,6) ^ rotr32(e,11) ^ rotr32(e,25)
      const ch  = (e & f) ^ (~e & g)
      const t1  = (hh + S1 + ch + K[j] + W[j]) >>> 0
      const S0  = rotr32(a,2) ^ rotr32(a,13) ^ rotr32(a,22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2  = (S0 + maj) >>> 0
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0
    }
    h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0
    h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0
  }
  return Array.from(h).map(n => n.toString(16).padStart(8, '0')).join('')
}

// 환경에 따른 SHA-256 선택
async function sha256(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(text)
      const buf  = await crypto.subtle.digest('SHA-256', data)
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
    }
  } catch { /* 비보안 컨텍스트: 아래 폴백 사용 */ }
  return sha256Js(text)
}

// ── 공개 해시 함수 ───────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  return sha256(pin + 'family-quest-salt')
}

export async function hashFamilyCode(code: string): Promise<string> {
  return sha256(code.toUpperCase().trim())
}

// ── Firebase Anonymous 세션 (10초 타임아웃) ─────────────────────

export async function startAnonymousSession(): Promise<{ uid: string | null; error: string | null }> {
  // 이미 인증된 세션 재사용 — ngrok/외부망에서 불필요한 API 호출 방지
  if (auth.currentUser) return { uid: auth.currentUser.uid, error: null }

  // ※ ngrok/외부망 접속 시 Firebase Console → Authentication → Settings →
  //   Authorized domains 에 ngrok 도메인을 반드시 추가해야 합니다.
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(), { code: 'auth/timeout' })), 10_000)
    )
    const cred = await Promise.race([signInAnonymously(auth), timeout])
    return { uid: cred.user.uid, error: null }
  } catch (e: any) {
    const code = e?.code ?? ''
    const messages: Record<string, string> = {
      'auth/timeout':               'Firebase 연결 시간이 초과됐어요. 인터넷 연결과 .env.local 설정을 확인해주세요',
      'auth/invalid-api-key':       'Firebase API 키가 올바르지 않아요. .env.local 파일을 확인해주세요',
      'auth/operation-not-allowed': 'Firebase Console에서 익명 로그인을 활성화해주세요',
      'auth/network-request-failed':'인터넷 연결을 확인해봐요',
      'auth/too-many-requests':     '잠시 후 다시 시도해봐요',
      'auth/internal-error':        'Firebase 서버 오류예요. 잠시 후 다시 시도해봐요',
      'auth/configuration-not-found':'Firebase 설정을 확인해주세요',
    }
    console.error('[Auth] startAnonymousSession error:', code, e?.message)
    return { uid: null, error: messages[code] ?? `인증 오류 (${code})` }
  }
}

export async function signOut(): Promise<void> {
  try { await fbSignOut(auth) } catch { /* ignore */ }
}

// 기기 완전 초기화 — 로그아웃 시 모든 앱 관련 로컬 데이터 삭제
export function clearAllLocalData(): void {
  const preserve = ['fq_weekly_comp', 'fq_monthly_comp']  // 유지할 설정
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && !preserve.includes(k)) keys.push(k)
  }
  keys.forEach(k => localStorage.removeItem(k))
  sessionStorage.clear()
}

export function getCurrentUid(): string | null {
  return auth.currentUser?.uid ?? null
}
