// Design Ref: §4.3 Cloud Functions — 스케줄 작업
// Plan FR-24: 월별 정산 자동화
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { initializeApp } = require('firebase-admin/app')

initializeApp()
const db = getFirestore()

// ── 매일 자정: 일일 미션 리셋 + 소멸 처리 ──────────────────────
exports.dailyMissionReset = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Seoul' },
  async () => {
    const now = new Date()
    const families = await db.collection('families').get()

    for (const family of families.docs) {
      const familyId = family.id
      const missionsRef = db.collection(`families/${familyId}/missions`)

      // 소멸 처리: 기간 만료된 ACTIVE 미션
      const expiredSnap = await missionsRef
        .where('status', '==', 'ACTIVE')
        .where('endDate', '<', Timestamp.fromDate(now))
        .get()

      const batch = db.batch()
      expiredSnap.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'EXPIRED', updatedAt: Timestamp.now() })
      })
      await batch.commit()
    }
    console.log('Daily mission reset complete')
  }
)

// ── 매주 월요일 자정: 주간 미션 리셋 + beggingLeft 초기화 ────────
exports.weeklyReset = onSchedule(
  { schedule: '0 0 * * 1', timeZone: 'Asia/Seoul' },
  async () => {
    const families = await db.collection('families').get()

    for (const family of families.docs) {
      const familyId = family.id
      const membersRef = db.collection(`families/${familyId}/members`)
      const membersSnap = await membersRef.where('isActive', '==', true).get()

      const batch = db.batch()
      membersSnap.docs.forEach(doc => {
        const member = doc.data()
        // 레벨 기반 조르기 횟수 리셋
        const beggingLimit = 1 + Math.floor((member.level ?? 1) / 5)
        batch.update(doc.ref, { beggingLeft: beggingLimit })
      })
      await batch.commit()
    }
    console.log('Weekly reset complete')
  }
)

// ── 매주 일요일 23:55: 주간 왕관 수여 ──────────────────────────
exports.weeklyChampion = onSchedule(
  { schedule: '55 23 * * 0', timeZone: 'Asia/Seoul' },
  async () => {
    const now = new Date()
    const weekKey = `${now.getFullYear()}-W${getWeekNumber(now)}`
    const families = await db.collection('families').get()

    for (const family of families.docs) {
      const familyId = family.id

      // 이번 주 승인된 보상으로 CHILD EXP 합산
      const rewardsSnap = await db.collection(`families/${familyId}/rewards`)
        .where('approvedAt', '>=', getWeekStart(now))
        .get()

      const scores: Record<string, number> = {}
      rewardsSnap.docs.forEach(doc => {
        const { memberId } = doc.data()
        scores[memberId] = (scores[memberId] ?? 0) + 1
      })

      const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      await db.doc(`families/${familyId}/competition/${weekKey}`).set({
        weekWinner: winner,
        monthWinner: null,
        scores,
        crownExchanged: false,
        createdAt: Timestamp.now(),
      }, { merge: true })
    }
    console.log('Weekly champion assigned')
  }
)

// ── 매월 1일 00:00: 월별 정산 ────────────────────────────────
exports.monthlySettlement = onSchedule(
  { schedule: '0 0 1 * *', timeZone: 'Asia/Seoul' },
  async () => {
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const families = await db.collection('families').get()

    for (const family of families.docs) {
      const familyId = family.id
      const rewardsSnap = await db.collection(`families/${familyId}/rewards`)
        .where('approvedAt', '>=', Timestamp.fromDate(prevMonth))
        .where('approvedAt', '<=', Timestamp.fromDate(prevMonthEnd))
        .get()

      const settlementKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
      const summary: Record<string, Record<string, number>> = {}

      rewardsSnap.docs.forEach(doc => {
        const { memberId, rewardType, amount } = doc.data()
        if (!summary[memberId]) summary[memberId] = {}
        summary[memberId][rewardType] = (summary[memberId][rewardType] ?? 0) + amount
      })

      await db.doc(`families/${familyId}/settlements/${settlementKey}`).set({
        period: settlementKey,
        summary,
        createdAt: Timestamp.now(),
      })
    }
    console.log('Monthly settlement complete')
  }
)

// ── 헬퍼 함수 ──────────────────────────────────────────────
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(d)
}
