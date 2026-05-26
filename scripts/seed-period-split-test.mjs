/**
 * Creates two competition periods and seeds qualified entries into each (isolated pools).
 * Usage: node scripts/seed-period-split-test.mjs
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const { query, isDbConfigured } = await import('../backend/api/lib/db.mjs')
const { ensureCompetitionPeriodsSchema } = await import('../backend/api/lib/competitionPeriods.mjs')
const { ensureTicketSchema } = await import('../backend/api/lib/ensureTicketSchema.mjs')
const { ensureUserPhoneColumn, upsertUserContact } = await import('../backend/api/lib/userContact.mjs')
const { fetchDrawPoolSummary } = await import('../backend/api/lib/qualifiedDrawPool.mjs')
const { getCompetitionPeriodById, updateCompetitionPeriodStatus } = await import(
  '../backend/api/lib/competitionPeriods.mjs',
)
const { PERIOD_STATUS } = await import('../shared/competitionPeriods.mjs')

if (!isDbConfigured()) {
  console.error('DATABASE_URL or SQLITE_PATH required')
  process.exit(1)
}

await ensureCompetitionPeriodsSchema()
await ensureTicketSchema()
await ensureUserPhoneColumn()

const legacyId = 'legacy-main-test'
const test3Id = 'legacy-bundle-test-3'
const now = Date.now()
const legacyOpens = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
const legacyCloses = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
const test3Opens = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString()
const test3Closes = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()

async function upsertPeriod(id, title, opens, closes, status) {
  await query(`DELETE FROM competition_periods WHERE id = $1`, [id])
  await query(
    `INSERT INTO competition_periods (id, competition, title, summary, entry_opens_at, entry_closes_at, status)
     VALUES ($1, 'ronaldo_legacy_bundle', $2, $3, $4, $5, $6)`,
    [
      id,
      title,
      `Test period: ${title}`,
      opens,
      closes,
      status,
    ],
  )
}

const testEmails = ['legacy-main@test.showskills', 'bundle-test3@test.showskills']

await query(`DELETE FROM draw_runs WHERE period_id IN ($1, $2)`, [legacyId, test3Id])
for (const email of testEmails) {
  const u = await query(`SELECT id FROM users WHERE email = $1`, [email])
  const userId = u.rows[0]?.id
  if (!userId) continue
  const tickets = await query(
    `SELECT id FROM tickets WHERE user_id = $1 AND period_id IN ($2, $3)`,
    [userId, legacyId, test3Id],
  )
  for (const t of tickets.rows) {
    await query(`DELETE FROM ticket_numbers WHERE ticket_id = $1`, [t.id])
    await query(`DELETE FROM competition_entries WHERE user_id = $2`, [userId])
    await query(`DELETE FROM tickets WHERE id = $1`, [t.id])
  }
}

await upsertPeriod(
  legacyId,
  'Ronaldo Legacy Bundle — Main (test)',
  legacyOpens,
  legacyCloses,
  PERIOD_STATUS.closed,
)
await upsertPeriod(
  test3Id,
  'Ronaldo Bundle Test 3',
  test3Opens,
  test3Closes,
  PERIOD_STATUS.closed,
)

async function seedEntrant({ periodId, label, email, purchasedAt }) {
  const userId = await upsertUserContact({
    email,
    fullName: `${label} Player`,
    phone: '+447700900123',
  })
  const ticketId = randomUUID()
  const publicId = `ORD-${randomBytes(3).toString('hex').toUpperCase()}`
  const tn = `SS-${randomBytes(4).toString('hex').toUpperCase()}`
  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, purchased_at, period_id)
     VALUES ($1, $2, $3, 'single', 1, 'paid', $4, $5)`,
    [ticketId, publicId, userId, purchasedAt, periodId],
  )
  await query(
    `INSERT INTO ticket_numbers (id, ticket_id, ticket_number, slot_index) VALUES ($1, $2, $3, 1)`,
    [randomUUID(), ticketId, tn],
  )
  await query(
    `INSERT INTO competition_entries (id, user_id, competition, entry_type, answers_json, all_correct, created_at)
     VALUES ($1, $2, 'ronaldo_legacy_bundle', 'paid', '{}', 1, $3)`,
    [randomUUID(), userId, purchasedAt],
  )
  return tn
}

const legacyPurchased = new Date(legacyOpens).getTime() + 3600000
const test3Purchased = new Date(test3Opens).getTime() + 3600000

const tLegacy = await seedEntrant({
  periodId: legacyId,
  label: 'Legacy Main',
  email: 'legacy-main@test.showskills',
  purchasedAt: new Date(legacyPurchased).toISOString(),
})
const tTest3 = await seedEntrant({
  periodId: test3Id,
  label: 'Bundle Test 3',
  email: 'bundle-test3@test.showskills',
  purchasedAt: new Date(test3Purchased).toISOString(),
})

const legacyPeriod = await getCompetitionPeriodById(legacyId)
const test3Period = await getCompetitionPeriodById(test3Id)
const legacyPool = await fetchDrawPoolSummary('ronaldo_legacy_bundle', legacyPeriod)
const test3Pool = await fetchDrawPoolSummary('ronaldo_legacy_bundle', test3Period)

console.log('\nPeriod split test seeded:')
console.log(`  ${legacyId}: pool=${legacyPool.poolSize} ticket=${tLegacy} (email legacy-main@test.showskills)`)
console.log(`  ${test3Id}: pool=${test3Pool.poolSize} ticket=${tTest3} (email bundle-test3@test.showskills)`)
console.log('\nAdmin → Draw winner: select each closed period — pools must not mix.')
console.log('Resend winner email: POST /api/admin/resend-winner-email { drawId } after a draw.\n')
