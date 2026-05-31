/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ── 브랜드 컬러 ────────────────────────────────────────────
      colors: {
        grass:       '#5C8A1E',
        dirt:        '#8B5E3C',
        stone:       '#9E9E9E',
        gold:        '#FFD700',
        sky:         '#4FC3F7',
        purple:      '#7B5EA7',
        pink:        '#E8A0BF',
        cream:       '#FFF8F0',
        approved:    '#43A047',
        rejected:    '#E53935',
        hold:        '#FB8C00',
        'pixel-dark':'#1A1A1A',
        // 다크 마인크래프트 인벤토리 패널 계층 (v3.0)
        'panel-darkest': '#0F0A04',
        'panel-dark':    '#1A1208',
        'panel-mid':     '#2A1F0E',
        'panel-surface': '#3D2800',
        'panel-border':  '#6B4E2A',
        'panel-sub':     '#C4A06A',
      },

      // ── 폰트 패밀리 ────────────────────────────────────────────
      // font-pixel  : Press Start 2P — 레벨·배지·영문 레이블 (픽셀 블록)
      // font-korean : Pretendard → Noto Sans KR → system — 모든 한글 본문
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        korean: [
          '"Pretendard"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        // DotGothic16 — 로그인 대형 타이틀 전용 (특수 목적)
        'pixel-kr': ['"DotGothic16"', 'monospace'],
      },

      // ── 타이포그래피 스케일 (9살 아이 기준 — 커스텀 고정 px) ────
      // 위계: ds-xl > ds-title > ds-heading > ds-body > ds-sub > ds-micro > ds-badge
      // 2026-05-30 v2: 전체 +2~6px 상향 (가독성 개선)
      fontSize: {
        // Tailwind 기본값 override — 앱 전체 최소 크기 상향
        'xs':   ['13px', { lineHeight: '1.5' }],
        'sm':   ['15px', { lineHeight: '1.6' }],
        // 커스텀 ds-* 스케일
        'ds-badge':   ['10px', { lineHeight: '1.2', letterSpacing: '0.05em' }],
        'ds-label':   ['12px', { lineHeight: '1.4' }],
        'ds-micro':   ['13px', { lineHeight: '1.4' }],
        'ds-sub':     ['15px', { lineHeight: '1.5' }],
        'ds-body':    ['17px', { lineHeight: '1.6' }],
        'ds-heading': ['19px', { lineHeight: '1.5' }],
        'ds-title':   ['22px', { lineHeight: '1.4' }],
        'ds-xl':      ['26px', { lineHeight: '1.3' }],
      },

      // ── 박스 그림자 ────────────────────────────────────────────
      boxShadow: {
        pixel:        '3px 3px 0px #1A1A1A',
        'pixel-sm':   '2px 2px 0px #1A1A1A',
        'pixel-inset':'inset 2px 2px 0px rgba(0,0,0,0.3)',
        'pixel-gold': '3px 3px 0px #7B5000',
      },

      // ── 테두리 두께 ────────────────────────────────────────────
      borderWidth: {
        '3': '3px',
        '5': '5px',
      },

      // ── Tailwind 애니메이션 (keyframes는 pixel-theme.css에 정의) ──
      animation: {
        'pixel-bounce': 'pixelBounce 0.5s steps(4) infinite',
        'pixel-fade':   'pixelFade 0.3s steps(3) forwards',
        'sprite-walk':  'spriteWalk 0.8s steps(4) infinite',
      },
      keyframes: {
        pixelBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        pixelFade: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        spriteWalk: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '-256px 0' },
        },
      },
    },
  },
  plugins: [],
}
