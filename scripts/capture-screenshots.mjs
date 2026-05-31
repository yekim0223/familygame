/**
 * Family Quest — 주요 화면 스크린샷 캡처
 * 사용법: node scripts/capture-screenshots.mjs [PIN]
 * 결과:  captures/ 폴더에 PNG 저장
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = path.join(__dirname, '..', 'captures')
const BASE_URL  = 'http://localhost:5173'
const LOGIN_ID  = 'dad'
const PIN       = process.argv[2] ?? '1111'

// iPhone 14 모바일 뷰포트
const VIEWPORT = { width: 390, height: 844 }

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function capture(page, filename, label) {
  const filepath = path.join(OUT_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: false })
  console.log(`  ✅ ${label} → ${filename}`)
}

// ─────────────────────────────────────────────────────────────
// Phase 1: 스플래시 스크린 (별도 컨텍스트 — 스플래시 표시)
// ─────────────────────────────────────────────────────────────
async function captureSplash(browser) {
  console.log('\n[1/3] 스플래시 스크린 캡처...')
  const ctx  = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  await sleep(2200) // 스플래시 phase 3~4 (FAMILY QUEST + 파티클)
  await capture(page, '01_splash.png', '스플래시 스크린')
  await ctx.close()
}

// ─────────────────────────────────────────────────────────────
// Phase 2: 로그인 화면들 (스플래시 스킵)
// ─────────────────────────────────────────────────────────────
async function captureLoginFlow(browser) {
  console.log('\n[2/3] 로그인 화면 캡처...')
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  // 스플래시 스크린 스킵 (sessionStorage 주입)
  await page.addInitScript(() => sessionStorage.setItem('fq_splash_done', '1'))

  // 랜딩
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await sleep(800)
  await capture(page, '02_login_landing.png', '랜딩 페이지')

  // ID 입력 화면
  await page.click('button:has-text("FAMILY LOGIN")')
  await sleep(600)
  await capture(page, '03_login_id_input.png', 'ID 입력 화면')

  // loginId 입력 → characters view 진입
  await page.fill('input[placeholder="개인 ID 입력"]', LOGIN_ID)
  await page.click('button:has-text("입장하기")')

  // PIN 입력 패널이 나타날 때까지 대기 (최대 12초)
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 12000 })
    await sleep(600)
    await capture(page, '04_character_select.png', '캐릭터 선택 화면')
  } catch {
    // fallback: 현재 상태 그대로 캡처
    await capture(page, '04_character_select.png', '캐릭터 선택 화면 (fallback)')
  }

  await ctx.close()
}

// ─────────────────────────────────────────────────────────────
// Phase 3: 인증 후 화면들
// ─────────────────────────────────────────────────────────────
async function captureAuthPages(browser) {
  console.log('\n[3/3] 인증 후 주요 화면 캡처...')
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  // 스플래시 스크린 스킵
  await page.addInitScript(() => sessionStorage.setItem('fq_splash_done', '1'))

  // ── 로그인 수행 ───────────────────────────────────────────
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await sleep(500)
  await page.click('button:has-text("FAMILY LOGIN")')
  await sleep(400)
  await page.fill('input[placeholder="개인 ID 입력"]', LOGIN_ID)
  await page.click('button:has-text("입장하기")')

  // PIN 입력 대기
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 12000 })
    await page.fill('input[type="password"]', PIN)
    await page.click('button:has-text("입장 (Enter)")')
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 10000 })
    console.log('  🔑 로그인 성공!')
  } catch (e) {
    console.error('  ❌ 로그인 실패:', e.message)
    console.error('  💡 family code 방식을 시도합니다...')
    await ctx.close()
    return false
  }

  // ── 홈 ──────────────────────────────────────────────────
  await sleep(1200)
  await capture(page, '05_home.png', '홈 대시보드')

  // ── 미션 목록 ────────────────────────────────────────────
  await page.goto(`${BASE_URL}/missions`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '06_missions.png', '미션 목록')

  // ── 미션 상세 (첫 번째 미션) ─────────────────────────────
  const missionLink = page.locator('a[href^="/missions/"]').first()
  if (await missionLink.count() > 0) {
    await missionLink.click()
    await sleep(1200)
    await capture(page, '07_mission_detail.png', '미션 상세')
  } else {
    console.log('  ⚠️  미션 없음 — 상세 스킵')
  }

  // ── 미션 생성 폼 ─────────────────────────────────────────
  await page.goto(`${BASE_URL}/missions/new`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '08_mission_create.png', '미션 생성 폼')

  // ── 달력 ─────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/calendar`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '09_calendar.png', '달력')

  // ── 보상 현황 ─────────────────────────────────────────────
  await page.goto(`${BASE_URL}/rewards`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '10_rewards.png', '보상 현황')

  // ── 그룹채팅 ─────────────────────────────────────────────
  await page.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '11_messages.png', '그룹채팅')

  // ── 조르기 관리 ───────────────────────────────────────────
  await page.goto(`${BASE_URL}/begging/manage`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '12_begging_manage.png', '조르기 관리')

  // ── 알림 ─────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '13_notifications.png', '알림')

  // ── 프로필 ───────────────────────────────────────────────
  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '14_profile.png', '프로필')

  // ── 설정 ─────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '15_settings.png', '설정')

  // ── 마스터 패널 ───────────────────────────────────────────
  await page.goto(`${BASE_URL}/settings/master`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '16_master_settings.png', '마스터 패널')

  // ── 보상 발송 ─────────────────────────────────────────────
  await page.goto(`${BASE_URL}/settings/rewards-send`, { waitUntil: 'networkidle' })
  await sleep(1000)
  await capture(page, '17_rewards_send.png', '보상 발송')

  await ctx.close()
  return true
}

// ─────────────────────────────────────────────────────────────
async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`\n📸 Family Quest 스크린샷 캡처 시작`)
  console.log(`📁 출력 폴더: ${OUT_DIR}\n`)

  const browser = await chromium.launch({ headless: true })

  try {
    await captureSplash(browser)
    await captureLoginFlow(browser)
    const success = await captureAuthPages(browser)

    if (!success) {
      console.log('\n⚠️  인증 후 화면 캡처에 실패했습니다.')
      console.log('   가족 코드 또는 loginId/PIN을 확인해주세요.')
    }
  } finally {
    await browser.close()
  }

  // 결과 목록
  console.log('\n────────────────────────────────')
  const { readdirSync } = await import('fs')
  const files = readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort()
  console.log(`\n🎉 캡처 완료! 총 ${files.length}개 파일`)
  files.forEach(f => console.log(`  📷 ${f}`))
  console.log(`\n📁 ${OUT_DIR}\n`)
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message)
  process.exit(1)
})
