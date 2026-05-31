// Pure Web Audio API 8-bit retro sound synthesizer — no external files required
// Uses OscillatorNode + GainNode frequency synthesis for all sounds

export type BGMTheme = 'DEFAULT' | 'JOYFUL' | 'CALM' | 'MUTE'

// ── Musical frequency constants (Hz) ─────────────────────────────────
const R  = 0       // rest
const E3 = 164.81, G3 = 196.00
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23
const Fs4 = 369.99, G4 = 392.00, A4 = 440.00, Bb4 = 466.16, B4 = 493.88
const C5 = 523.25, D5 = 587.33, E5 = 659.25
const Fs5 = 739.99, G5 = 783.99, A5 = 880.00, B5 = 987.77
const C6 = 1046.50, D6 = 1174.66

// ── Note type: frequency (Hz), duration (quarter beats), wave, volume ─
interface Note { f: number; d: number; w?: OscillatorType; v?: number }

interface ThemeDef {
  bpm:   number
  wave:  OscillatorType
  vol:   number        // base melody volume
  notes: Note[]
}

// ── [1] DEFAULT — Family Quest 메인 테마 (C Major, 120 BPM) ───────────
// 대표적 밝은 8비트 도트 테마. 미디엄 템포 아르페지오.
const DEFAULT_NOTES: Note[] = [
  // Bar 1: C-E-G 상승 아르페지오
  { f: C5, d: 1 }, { f: E5, d: 1 }, { f: G5, d: 1 }, { f: E5, d: 1 },
  // Bar 2: 하강 스케일 + 도약
  { f: C5, d: 1 }, { f: G4, d: 1 }, { f: A4, d: 1 }, { f: B4, d: 1 },
  // Bar 3: D minor 변화
  { f: C5, d: 1 }, { f: D5, d: 1 }, { f: E5, d: 1 }, { f: G5, d: 1 },
  // Bar 4: A5 피크 → 하강
  { f: A5, d: 1 }, { f: G5, d: 1 }, { f: E5, d: 1 }, { f: C5, d: 1 },
  // Bar 5: 고음역 도약
  { f: E5, d: 1 }, { f: G5, d: 1 }, { f: C6, d: 1 }, { f: G5, d: 1 },
  // Bar 6: 하강 귀환
  { f: E5, d: 1 }, { f: C5, d: 1 }, { f: G4, d: 1 }, { f: E4, d: 1 },
  // Bar 7: 종지 준비 상승
  { f: G4, d: 1 }, { f: A4, d: 1 }, { f: B4, d: 1 }, { f: C5, d: 1 },
  // Bar 8: 마무리 (마지막 음 2박자 유지)
  { f: D5, d: 1 }, { f: E5, d: 1 }, { f: D5, d: 1 }, { f: C5, d: 2 },
]

// ── [2] JOYFUL — 세가/너구리 감성 모험가풍 (G Major, 160 BPM) ─────────
// 빠른 8분음표 주도 런, 경쾌하고 활기찬 게임 배경음악 스타일.
const JOYFUL_NOTES: Note[] = [
  // Bar 1: G 아르페지오 상승 런
  { f: G4, d: .5 }, { f: B4, d: .5 }, { f: D5, d: .5 }, { f: G5, d: .5 },
  { f: G5, d: .5 }, { f: Fs5, d: .5 }, { f: E5, d: .5 }, { f: D5, d: .5 },
  // Bar 2: 응답 선율
  { f: E5, d: .5 }, { f: D5, d: .5 }, { f: B4, d: .5 }, { f: G4, d: .5 },
  { f: A4, d: .5 }, { f: B4, d: .5 }, { f: C5, d: .5 }, { f: D5, d: .5 },
  // Bar 3: 하강 스케일 런
  { f: E5, d: .5 }, { f: D5, d: .5 }, { f: C5, d: .5 }, { f: B4, d: .5 },
  { f: A4, d: .5 }, { f: G4, d: .5 }, { f: Fs4, d: .5 }, { f: G4, d: .5 },
  // Bar 4: 착지 (4분음표 = 여유)
  { f: G4, d: 1 }, { f: D5, d: 1 }, { f: G5, d: 2 },
  // Bar 5: 고음 대선율
  { f: A5, d: .5 }, { f: G5, d: .5 }, { f: E5, d: .5 }, { f: D5, d: .5 },
  { f: B4, d: .5 }, { f: G4, d: .5 }, { f: E4, d: .5 }, { f: G4, d: .5 },
  // Bar 6: 상승 응답
  { f: A4, d: .5 }, { f: C5, d: .5 }, { f: E5, d: .5 }, { f: A5, d: .5 },
  { f: G5, d: .5 }, { f: E5, d: .5 }, { f: C5, d: .5 }, { f: A4, d: .5 },
  // Bar 7: 클라이막스 런
  { f: D5, d: .5 }, { f: Fs5, d: .5 }, { f: A5, d: .5 }, { f: D6, d: .5 },
  { f: B5, d: .5 }, { f: G5, d: .5 }, { f: D5, d: .5 }, { f: B4, d: .5 },
  // Bar 8: 해결
  { f: G4, d: 1 }, { f: B4, d: 1 }, { f: D5, d: 2 },
]

// ── [3] CALM — 야간 픽셀 휴식곡 (A Minor, 68 BPM, triangle) ──────────
// 느리고 따뜻한 플러크 사운드. 취침 전 앱 사용에 어울리는 차분한 감성.
const CALM_NOTES: Note[] = [
  // Phrase 1: Am → C
  { f: A4, d: 2 }, { f: R,  d: .5 }, { f: C5, d: 1.5 },
  { f: E5, d: 2 }, { f: D5, d: 2 },
  // Phrase 2: G → Em
  { f: G4, d: 2 }, { f: R,  d: .5 }, { f: B4, d: 1.5 },
  { f: D5, d: 2 }, { f: C5, d: 2 },
  // Phrase 3: F → Dm (색채 변화)
  { f: F4, d: 2 }, { f: R,  d: .5 }, { f: A4, d: 1.5 },
  { f: C5, d: 2 }, { f: Bb4, d: 2 },
  // Phrase 4: E → Am 해결
  { f: E4, d: 2 }, { f: R,  d: .5 }, { f: G4, d: 1.5 },
  { f: A4, d: 4 },
]

// ── Theme 레지스트리 ─────────────────────────────────────────────────
const THEMES: Record<Exclude<BGMTheme, 'MUTE'>, ThemeDef> = {
  DEFAULT: { bpm: 120, wave: 'square',   vol: 0.16, notes: DEFAULT_NOTES },
  JOYFUL:  { bpm: 160, wave: 'square',   vol: 0.13, notes: JOYFUL_NOTES  },
  CALM:    { bpm: 68,  wave: 'triangle', vol: 0.22, notes: CALM_NOTES    },
}

// ── 스케줄러 상수 ─────────────────────────────────────────────────────
const LOOKAHEAD   = 0.12  // 120ms 앞까지 예약
const SCHED_INTV  = 25    // 25ms마다 스케줄러 체크

// ════════════════════════════════════════════════════════════════════
class AudioManager {
  private ctx:      AudioContext | null = null
  private bgmGain:  GainNode    | null = null
  private sfxGain:  GainNode    | null = null

  private theme:    BGMTheme = 'MUTE'
  private running   = false
  private timer:    ReturnType<typeof setTimeout> | null = null
  private noteIdx   = 0
  private nextTime  = 0   // AudioContext 타임라인상 다음 음표 시작 시각

  constructor() {
    try {
      const saved = localStorage.getItem('fq_bgm_theme') as BGMTheme | null
      this.theme = saved ?? 'MUTE'
    } catch { /* localStorage not available */ }
  }

  // ── AudioContext 지연 초기화 ────────────────────────────────────
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
      this.bgmGain = this.ctx.createGain()
      this.bgmGain.gain.value = 0.12
      this.bgmGain.connect(this.ctx.destination)

      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = 0.35
      this.sfxGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  // 유저 인터랙션 핸들러에서 호출 → suspended 상태 해제
  resume(): void {
    try {
      const ctx = this.getCtx()
      if (ctx.state === 'suspended') ctx.resume()
    } catch { /* ignore */ }
  }

  // ── 단일 음표 예약 (내부용) ────────────────────────────────────
  private schedNote(
    freq: number,
    durSec: number,
    wave: OscillatorType,
    vol: number,
    when: number,
    dest: GainNode,
  ): void {
    if (freq === 0) return  // rest: 시간만 진행, 소리 없음
    try {
      const ctx = this.getCtx()
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.connect(g)
      g.connect(dest)
      osc.type = wave
      osc.frequency.value = freq

      // Attack–Sustain–Release 엔벨로프
      const atk = Math.min(0.012, durSec * 0.05)
      const rel = Math.min(0.09,  durSec * 0.35)
      g.gain.setValueAtTime(0, when)
      g.gain.linearRampToValueAtTime(vol, when + atk)
      g.gain.setValueAtTime(vol, when + durSec - rel)
      g.gain.exponentialRampToValueAtTime(0.0001, when + durSec)

      osc.start(when)
      osc.stop(when + durSec + 0.01)
    } catch { /* AudioContext not available */ }
  }

  // ── BGM 스케줄러 루프 (lookahead 패턴) ──────────────────────────
  private schedulerTick(): void {
    if (!this.running) return
    const ctx   = this.getCtx()
    const def   = THEMES[this.theme as Exclude<BGMTheme, 'MUTE'>]
    if (!def) return

    const beatLen = 60 / def.bpm

    // LOOKAHEAD 시간 내의 음표를 모두 예약
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const note = def.notes[this.noteIdx]
      this.schedNote(
        note.f,
        note.d * beatLen * 0.88,   // 88% duration → 음표 간격 자연스럽게
        note.w ?? def.wave,
        note.v ?? def.vol,
        Math.max(this.nextTime, ctx.currentTime + 0.001),
        this.bgmGain!,
      )
      this.nextTime += note.d * beatLen
      this.noteIdx = (this.noteIdx + 1) % def.notes.length
    }

    this.timer = setTimeout(() => this.schedulerTick(), SCHED_INTV)
  }

  private startBGM(): void {
    if (this.running || this.theme === 'MUTE') return
    this.running = true
    const ctx = this.getCtx()
    this.nextTime = ctx.currentTime + 0.08
    this.schedulerTick()
  }

  private stopBGM(): void {
    this.running = false
    if (this.timer) { clearTimeout(this.timer); this.timer = null }

    // BGM 즉시 페이드아웃 (80ms)
    if (this.bgmGain && this.ctx) {
      const now = this.ctx.currentTime
      this.bgmGain.gain.cancelScheduledValues(now)
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now)
      this.bgmGain.gain.linearRampToValueAtTime(0, now + 0.08)
      setTimeout(() => {
        if (this.bgmGain) this.bgmGain.gain.value = 0.12
      }, 120)
    }
  }

  // ── 공개 API ────────────────────────────────────────────────────

  setTheme(theme: BGMTheme): void {
    this.stopBGM()
    this.theme = theme
    this.noteIdx = 0
    try { localStorage.setItem('fq_bgm_theme', theme) } catch { /* ignore */ }
    if (theme !== 'MUTE') {
      this.resume()
      setTimeout(() => this.startBGM(), 130)
    }
  }

  getTheme(): BGMTheme { return this.theme }

  pause(): void {
    this.stopBGM()
  }

  play(): void {
    if (this.theme === 'MUTE') return
    this.noteIdx = 0
    this.resume()
    this.startBGM()
  }

  isPlaying(): boolean { return this.running }

  // ── SFX 공통 헬퍼 ────────────────────────────────────────────────

  // 단발 음
  private sfx(freq: number, dur: number, wave: OscillatorType = 'square', vol = 0.32): void {
    if (this.theme === 'MUTE') return
    try {
      const ctx = this.getCtx()
      if (ctx.state === 'suspended') return
      this.schedNote(freq, dur, wave, vol, ctx.currentTime, this.sfxGain!)
    } catch { /* ignore */ }
  }

  // 연속 음 시퀀스 (즉시 재생)
  private sfxSeq(notes: Array<[number, number, OscillatorType?, number?]>): void {
    if (this.theme === 'MUTE') return
    try {
      const ctx = this.getCtx()
      if (ctx.state === 'suspended') return
      let t = ctx.currentTime
      for (const [f, d, w, v] of notes) {
        this.schedNote(f, d, w ?? 'square', v ?? 0.30, t, this.sfxGain!)
        t += d
      }
    } catch { /* ignore */ }
  }

  // 화이트노이즈 버스트 (폭발음)
  private sfxNoise(durSec: number, vol = 0.45, decayRate = 0.06): void {
    if (this.theme === 'MUTE') return
    try {
      const ctx = this.getCtx()
      if (ctx.state === 'suspended') return
      const len = Math.floor(ctx.sampleRate * durSec)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) *
          Math.exp(-i / (ctx.sampleRate * decayRate))
      }
      const src = ctx.createBufferSource()
      const g   = ctx.createGain()
      src.buffer = buf
      src.connect(g)
      g.connect(this.sfxGain!)
      g.gain.setValueAtTime(vol, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durSec)
      src.start()
    } catch { /* ignore */ }
  }

  // ════════════════════════════════════════════════════════════════
  // 게임 SFX
  // ════════════════════════════════════════════════════════════════

  /** 갤러그: 미사일 발사 */
  shoot(): void {
    this.sfxSeq([
      [880, 0.04, 'square', 0.18],
      [660, 0.04, 'square', 0.12],
    ])
  }

  /** 갤러그: 적 파괴 폭발 */
  explosion(): void {
    this.sfxNoise(0.22, 0.5, 0.055)
  }

  /** 갤러그: 플레이어 피격 */
  playerHit(): void {
    this.sfxSeq([
      [220, 0.08, 'sawtooth', 0.35],
      [165, 0.12, 'sawtooth', 0.28],
    ])
  }

  /** 테트리스: 블록 회전 */
  rotate(): void {
    this.sfx(440, 0.04, 'triangle', 0.22)
  }

  /** 테트리스: 하드드롭 */
  hardDrop(): void {
    this.sfxSeq([
      [300, 0.05, 'square', 0.28],
      [180, 0.07, 'square', 0.22],
    ])
  }

  /** 테트리스: 라인 클리어 (클리어 수에 따라 화려도 증가) */
  lineClear(lines = 1): void {
    const freqs = [523, 659, 784, 1047]
    const cnt = Math.min(lines + 1, 4)
    const notes: Array<[number, number, OscillatorType?, number?]> =
      Array.from({ length: cnt }, (_, i) => [freqs[i], 0.11, 'square', 0.28])
    this.sfxSeq(notes)
  }

  /** 너구리: 점프 */
  jump(): void {
    this.sfxSeq([
      [400, 0.045, 'square', 0.22],
      [600, 0.065, 'square', 0.20],
    ])
  }

  /** 너구리: 코인 수집 */
  coinCollect(): void {
    this.sfxSeq([
      [880,  0.05, 'triangle', 0.30],
      [1100, 0.07, 'triangle', 0.25],
    ])
  }

  /** 공통: 게임 오버 */
  gameOver(): void {
    this.sfxSeq([
      [440, 0.18, 'square', 0.30],
      [330, 0.18, 'square', 0.30],
      [220, 0.40, 'square', 0.35],
    ])
  }

  // ════════════════════════════════════════════════════════════════
  // 가족 액션 SFX
  // ════════════════════════════════════════════════════════════════

  /** 아이 미션 확인 버튼 — 상승 도·미·솔 */
  missionConfirm(): void {
    this.sfxSeq([
      [C5, 0.12, 'triangle', 0.30],
      [E5, 0.12, 'triangle', 0.30],
      [G5, 0.20, 'triangle', 0.35],
    ])
  }

  /** 부모 슬롯 GOOD 승인 — 마인크래프트 레벨업 감성 고음 아르페지오 */
  slotApproval(): void {
    this.sfxSeq([
      [G4,  0.08, 'square', 0.28],
      [B4,  0.08, 'square', 0.28],
      [D5,  0.08, 'square', 0.28],
      [G5,  0.14, 'square', 0.30],
      [C6,  0.28, 'triangle', 0.22],
    ])
  }

  /** 보상 지급 — 오락실 아이템 획득 뾰로로롱 */
  rewardPayout(): void {
    const run: Array<[number, number, OscillatorType?, number?]> =
      [C4, D4, E4, G4, A4, C5, E5, G5].map(f => [f, 0.06, 'square', 0.24])
    run.push(
      [C6,  0.30, 'triangle', 0.26],
      [E5,  0.30, 'triangle', 0.18],
      [G5,  0.30, 'triangle', 0.16],
    )
    this.sfxSeq(run)
  }

  // ════════════════════════════════════════════════════════════════
  // 로그인 SFX
  // ════════════════════════════════════════════════════════════════

  /** 로그인 화면 인트로 — 신비로운 하강 아르페지오 */
  loginIntro(): void {
    if (this.theme === 'MUTE') return
    try {
      const ctx = this.getCtx()
      if (ctx.state === 'suspended') return
      // 느린 하강 아르페지오: C5 → A4 → F4 → C4
      this.sfxSeq([
        [C5,  0.20, 'triangle', 0.16],
        [A4,  0.20, 'triangle', 0.14],
        [F4,  0.20, 'triangle', 0.12],
        [C4,  0.40, 'triangle', 0.10],
      ])
      // 잔향: 약한 화음 겹침
      setTimeout(() => {
        if (this.theme === 'MUTE') return
        try {
          const c = this.getCtx()
          if (c.state === 'suspended') return
          this.schedNote(E3, 0.60, 'triangle', 0.06, c.currentTime, this.sfxGain!)
          this.schedNote(G3, 0.60, 'triangle', 0.05, c.currentTime, this.sfxGain!)
        } catch { /* ignore */ }
      }, 600)
    } catch { /* ignore */ }
  }

  /** 키패드 / 캐릭터 카드 탭 — 경쾌한 삑 (유저 제스처 직후 즉시 반응) */
  keyClick(): void {
    if (this.theme === 'MUTE') return
    try {
      const ctx = this.getCtx()
      // suspended 상태라도 resume() 후 미래 시각으로 스케줄 → 밀림 없는 즉시 반응
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.schedNote(880, 0.035, 'square', 0.14,
            this.ctx!.currentTime + 0.008, this.sfxGain!)
        }).catch(() => {/* ignore */})
        return
      }
      this.schedNote(880, 0.035, 'square', 0.14, ctx.currentTime, this.sfxGain!)
    } catch { /* ignore */ }
  }

  /** 로그인 성공 팡파르 — 승리 아르페지오 */
  loginFanfare(): void {
    this.sfxSeq([
      [C5,  0.08, 'square',   0.28],
      [E5,  0.08, 'square',   0.28],
      [G5,  0.08, 'square',   0.28],
      [C6,  0.20, 'square',   0.32],
      [G5,  0.10, 'triangle', 0.24],
      [C6,  0.35, 'triangle', 0.28],
    ])
  }

  /** 지뢰찾기: 셀 오픈 */
  mineOpen(): void {
    this.sfx(440, 0.04, 'triangle', 0.18)
  }

  /** 지뢰찾기: 깃발 설치 */
  mineFlag(): void {
    this.sfxSeq([
      [600, 0.04, 'square', 0.18],
      [800, 0.04, 'square', 0.14],
    ])
  }

  /** 지뢰찾기: 지뢰 폭발 */
  mineBoom(): void {
    this.sfxNoise(0.35, 0.6, 0.04)
    setTimeout(() => {
      if (this.theme === 'MUTE') return
      try {
        const ctx = this.getCtx()
        if (ctx.state === 'suspended') return
        this.schedNote(110, 0.40, 'sawtooth', 0.30, ctx.currentTime, this.sfxGain!)
      } catch { /* ignore */ }
    }, 120)
  }

  /** 지뢰찾기: 스테이지 클리어 */
  mineWin(): void {
    this.sfxSeq([
      [C5,    0.07, 'square',   0.26],
      [E5,    0.07, 'square',   0.26],
      [G5,    0.07, 'square',   0.26],
      [C6,    0.07, 'square',   0.28],
      [1318.51, 0.30, 'triangle', 0.24], // E6
    ])
  }

  /** BGM 자동 시작 (로그인 성공 후 호출 — 팡파르 종료 후 seamless 전환) */
  startAfterLogin(): void {
    if (this.theme === 'MUTE' || this.running) return
    this.noteIdx = 0
    const ctx = this.getCtx()
    const doStart = () => setTimeout(() => this.startBGM(), 600)
    // suspended 상태이면 resume 완료 후 BGM 시작 (Autoplay Policy 우회)
    if (ctx.state === 'suspended') {
      ctx.resume().then(doStart).catch(() => {/* 정책 거부 시 무음 유지 */})
    } else {
      doStart()
    }
  }
}

// ── 싱글톤 ─────────────────────────────────────────────────────────
export const audioManager = new AudioManager()

