/**
 * Smoke test: monthly draw entry + admin pool + fair draw (SQLite/local).
 * Usage: npm run test:world-cup-ball-monthly-draw
 */
import { randomUUID } from 'node:crypto'
import { query } from '../backend/api/lib/db.mjs'
import { ensureWorldCupBallSchema, createWorldCupBallSession } from '../backend/api/lib/worldCupBallSchema.mjs'
import {
  fetchWorldCupBallMonthlyDrawPool,
  fetchWorldCupBallMonthlyDrawSummary,
  runWorldCupBallMonthlyDraw,
} from '../backend/api/lib/worldCupBallMonthlyDrawPool.mjs'
import { awardWorldCupBallMonthlyDrawEntry } from '../backend/api/lib/awardWorldCupBallMonthlyDrawEntry.mjs'

const drawMonth = '2026-06'
const ip = `test-monthly-draw-${Date.now()}`

await ensureWorldCupBallSchema()

for (let i = 0; i < 3; i += 1) {
  const session = await createWorldCupBallSession(`${ip}-${i}`, {
    questionKeys: Array.from({ length: 10 }, (_, n) => `q${n + 1}`),
    combinationIndex: i,
  })
  await query(
    `UPDATE world_cup_ball_sessions SET status = $2, submitted_at = $3 WHERE id = $1`,
    [session.id, i === 0 ? 'won' : 'lost', new Date().toISOString()],
  )
  if (i > 0) {
    const award = await awardWorldCupBallMonthlyDrawEntry({
      sessionId: session.id,
      ip: `${ip}-${i}`,
      outcome: 'lost',
    })
    if (!award.awarded) {
      console.error('Expected draw entry award failed:', award)
      process.exit(1)
    }
  }
}

const summary = await fetchWorldCupBallMonthlyDrawSummary(drawMonth)
console.log('Pool size (excludes outright winner):', summary.poolSize)
if (summary.poolSize !== 2) {
  console.error('Expected 2 eligible entries, got', summary.poolSize)
  process.exit(1)
}

const draw = await runWorldCupBallMonthlyDraw({ drawMonth, adminNotes: 'smoke test' })
if (!draw.ok) {
  console.error('Draw failed:', draw.error)
  process.exit(1)
}

const poolAfter = await fetchWorldCupBallMonthlyDrawPool(drawMonth)
if (poolAfter.length !== 1) {
  console.error('Expected 1 remaining entry after draw, got', poolAfter.length)
  process.exit(1)
}

const secondDraw = await runWorldCupBallMonthlyDraw({ drawMonth })
if (secondDraw.ok) {
  console.error('Second draw for same month should fail')
  process.exit(1)
}

console.log('Monthly draw smoke test passed.')
console.log('Winner entry:', draw.winner.entryNumber)

process.exit(0)
