#!/usr/bin/env node
/**
 * Clear World Cup Ball quiz sessions/winners from local SQLite so you can retest.
 * Usage: npm run reset:world-cup-ball
 * Uses SQLITE_PATH from .env / .env.local (default db/db.sqlite).
 */
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const sqlitePath = (process.env.SQLITE_PATH || 'db/db.sqlite').trim()

process.env.SQLITE_PATH = sqlitePath
delete process.env.DATABASE_URL

const { query } = await import('../backend/api/lib/db.mjs')
const { ensureWorldCupBallSchema } = await import('../backend/api/lib/worldCupBallSchema.mjs')

await ensureWorldCupBallSchema()

const winners = await query(`DELETE FROM world_cup_ball_winners`)
const sessions = await query(`DELETE FROM world_cup_ball_sessions`)
const subs = await query(
  `DELETE FROM kickup_submissions WHERE competition = 'world_cup_ball_giveaway' OR video_ref LIKE 'world_cup_ball:%'`,
)

console.log(`Reset World Cup Ball data in ${sqlitePath}`)
console.log(`  world_cup_ball_winners: ${winners.rowCount ?? winners.changes ?? 0} deleted`)
console.log(`  world_cup_ball_sessions: ${sessions.rowCount ?? sessions.changes ?? 0} deleted`)
console.log(`  kickup_submissions (wc ball): ${subs.rowCount ?? subs.changes ?? 0} deleted`)
console.log('')
console.log('In your browser (same tab): open DevTools → Console and run:')
console.log("  sessionStorage.removeItem('ss_wc_ball_session')")
console.log("  sessionStorage.removeItem('ss_wc_ball_quiz_progress')")
console.log('Then refresh http://localhost:5173/world-cup-ball-giveaway (or :5174)')
