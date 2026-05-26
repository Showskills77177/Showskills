/**
 * Seed 334 qualified entrants on competition period legacy-bundle-test-3 (Ronaldo Bundle Test 3).
 * Each person gets a different bundle size (rotates through all paid bundles).
 *
 *   node scripts/seed-ronaldo-bundle-test3-bulk.mjs
 *   node scripts/seed-ronaldo-bundle-test3-bulk.mjs 334 --clear
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { TICKET_BUNDLES } from '../shared/ticketBundles.mjs'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const PERIOD_ID = 'legacy-bundle-test-3'
const PERIOD_TITLE = 'Ronaldo Bundle Test 3'
const EMAIL_DOMAIN = 'test3-bulk.local.test'
const DEFAULT_COUNT = 334

const args = process.argv.slice(2)
const clearFirst = args.includes('--clear') || !args.includes('--no-clear')
const countArg = args.find((a) => /^\d+$/.test(a))
const entrantCount = countArg
  ? Math.min(2000, Math.max(1, parseInt(countArg, 10)))
  : DEFAULT_COUNT

const { query, isDbConfigured, dbIsPostgres } = await import('../backend/api/lib/db.mjs')
const { ensureCompetitionPeriodsSchema } = await import('../backend/api/lib/competitionPeriods.mjs')
const { ensureTicketSchema } = await import('../backend/api/lib/ensureTicketSchema.mjs')
const { ensureUserPhoneColumn } = await import('../backend/api/lib/userContact.mjs')
const { recordStripePaymentIntentCompleted } = await import('../archive/stripe/backend/lib/recordSaleStripe.mjs')
const { reserveTicketNumbers } = await import('../backend/api/lib/ticketNumbers.mjs')
const { fetchDrawPoolSummary } = await import('../backend/api/lib/qualifiedDrawPool.mjs')
const { getCompetitionPeriodById } = await import('../backend/api/lib/competitionPeriods.mjs')
const { PERIOD_STATUS } = await import('../shared/competitionPeriods.mjs')

if (!isDbConfigured()) {
  console.error('DATABASE_URL or SQLITE_PATH required')
  process.exit(1)
}

const CORRECT_ANSWERS = {
  q1: 'Bolton Wanderers 4-0',
  q2: 'Nicky Butt',
  q3: '47',
}

const FIRST = [
  'James', 'Emma', 'Oliver', 'Sophia', 'Liam', 'Ava', 'Noah', 'Isabella', 'Ethan', 'Mia',
  'Lucas', 'Charlotte', 'Mason', 'Amelia', 'Logan', 'Harper', 'Alexander', 'Evelyn', 'Henry', 'Abigail',
  'Sebastian', 'Emily', 'Jack', 'Elizabeth', 'Aiden', 'Sofia', 'Owen', 'Avery', 'Samuel', 'Ella',
  'Ryan', 'Scarlett', 'Nathan', 'Grace', 'Leo', 'Chloe', 'Isaiah', 'Victoria', 'Caleb', 'Riley',
]

const LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
]

function buildEntrants(n) {
  const list = []
  for (let i = 0; i < n; i += 1) {
    const num = String(i + 1).padStart(3, '0')
    const bundle = TICKET_BUNDLES[i % TICKET_BUNDLES.length]
    const first = FIRST[i % FIRST.length]
    const last = LAST[Math.floor(i / FIRST.length) % LAST.length]
    list.push({
      email: `test3-${num}@${EMAIL_DOMAIN}`,
      name: `${first} ${last}`,
      bundleId: bundle.id,
      quantity: bundle.qty,
      amountPence: bundle.totalPence,
      bundleTitle: bundle.title,
    })
  }
  return list
}

async function ensureTest3Period() {
  await ensureCompetitionPeriodsSchema()
  const now = Date.now()
  const opens = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString()
  const closes = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
  const existing = await getCompetitionPeriodById(PERIOD_ID)
  if (!existing) {
    await query(
      `INSERT INTO competition_periods (id, competition, title, summary, entry_opens_at, entry_closes_at, status)
       VALUES ($1, 'ronaldo_legacy_bundle', $2, $3, $4, $5, $6)`,
      [
        PERIOD_ID,
        PERIOD_TITLE,
        'Bulk test period — isolated draw pool',
        opens,
        closes,
        PERIOD_STATUS.closed,
      ],
    )
  } else {
    await query(
      `UPDATE competition_periods
       SET title = $2, entry_opens_at = $3, entry_closes_at = $4, status = $5, updated_at = $6
       WHERE id = $1`,
      [PERIOD_ID, PERIOD_TITLE, opens, closes, PERIOD_STATUS.closed, new Date().toISOString()],
    )
  }
  return getCompetitionPeriodById(PERIOD_ID)
}

async function clearTest3BulkRows() {
  await query(`DELETE FROM draw_runs WHERE period_id = $1`, [PERIOD_ID])
  const like = `%@${EMAIL_DOMAIN}`
  const users = await query(`SELECT id FROM users WHERE lower(email) LIKE $1`, [like])
  const ids = users.rows.map((r) => r.id)
  if (ids.length) {
    const ph = ids.map((_, i) => `$${i + 1}`).join(', ')
    await query(
      `DELETE FROM ticket_numbers WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id IN (${ph}))`,
      ids,
    )
    await query(`DELETE FROM competition_entries WHERE user_id IN (${ph})`, ids)
    await query(`DELETE FROM payments WHERE user_id IN (${ph})`, ids)
    await query(`DELETE FROM tickets WHERE user_id IN (${ph})`, ids)
    await query(`DELETE FROM users WHERE id IN (${ph})`, ids)
  }
  const orphanTickets = await query(`SELECT id FROM tickets WHERE period_id = $1`, [PERIOD_ID])
  for (const row of orphanTickets.rows) {
    await query(`DELETE FROM ticket_numbers WHERE ticket_id = $1`, [row.id])
    await query(`DELETE FROM tickets WHERE id = $1`, [row.id])
  }
  console.log(`Cleared ${ids.length} bulk test users and draw runs for ${PERIOD_ID}.`)
}

async function qualifyEntry(userId, purchasedAt) {
  const entryId = randomUUID()
  const allVal = dbIsPostgres() ? true : 1
  const createdAt = new Date(new Date(purchasedAt).getTime() + 2000).toISOString()
  await query(
    `INSERT INTO competition_entries (id, user_id, competition, entry_type, answers_json, all_correct, created_at)
     VALUES ($1, $2, 'ronaldo_legacy_bundle', 'paid', $3, $4, $5)`,
    [entryId, userId, JSON.stringify(CORRECT_ANSWERS), allVal, createdAt],
  )
}

await ensureTicketSchema()
await ensureUserPhoneColumn()

const period = await ensureTest3Period()
if (clearFirst) await clearTest3BulkRows()

const entrants = buildEntrants(entrantCount)
const periodOpenMs = new Date(period.entryOpensAt).getTime()
const periodCloseMs = new Date(period.entryClosesAt).getTime()
const windowMs = Math.max(3600000, periodCloseMs - periodOpenMs - 60000)
const runId = Date.now()

let ok = 0
let fail = 0
let totalTickets = 0
const bundleCounts = Object.fromEntries(TICKET_BUNDLES.map((b) => [b.id, 0]))

console.log(`Seeding ${entrants.length} entrants into "${PERIOD_TITLE}" (${PERIOD_ID})…`)

for (let i = 0; i < entrants.length; i += 1) {
  const ent = entrants[i]
  const purchasedAt = new Date(
    periodOpenMs + Math.floor((windowMs * (i + 0.5)) / entrants.length),
  ).toISOString()
  const pi = `pi_test3_${String(i + 1).padStart(4, '0')}_${runId}`
  const phone = `+4477009${String(10000 + (i % 90000)).slice(-5)}`

  try {
    const ticketNumbers = await reserveTicketNumbers(ent.quantity)
    const sale = await recordStripePaymentIntentCompleted({
      paymentIntentId: pi,
      customerEmail: ent.email,
      customerFullName: ent.name,
      customerPhone: phone,
      periodId: PERIOD_ID,
      bundleId: ent.bundleId,
      quantity: ent.quantity,
      amountPence: ent.amountPence,
      currency: 'gbp',
      reservedTicketNumbers: ticketNumbers,
    })
    if (!sale?.ticketId) {
      fail += 1
      continue
    }
    await query(`UPDATE tickets SET purchased_at = $2 WHERE id = $1`, [sale.ticketId, purchasedAt])
    await qualifyEntry(sale.userId, purchasedAt)
    ok += 1
    totalTickets += ent.quantity
    bundleCounts[ent.bundleId] = (bundleCounts[ent.bundleId] || 0) + 1
    if (entrantCount <= 15 || (i + 1) % 50 === 0 || i === entrants.length - 1) {
      console.log(
        `  ${i + 1}/${entrants.length} — ${ent.name} (${ent.bundleTitle}, ${ent.quantity} tickets)`,
      )
    }
  } catch (e) {
    fail += 1
    if (fail <= 5) {
      console.error(`  ✗ ${ent.email}:`, e instanceof Error ? e.message : e)
    }
  }
}

const summary = await fetchDrawPoolSummary('ronaldo_legacy_bundle', period)

console.log(`\nDone: ${ok} people created, ${fail} failed.`)
console.log(`Ticket slots in pool: ${summary.poolSize} (${totalTickets} expected from bundle qty sum)`)
console.log(`Unique entrants in pool: ${summary.uniqueEntrants}`)
console.log('Bundle mix (people per bundle type):')
for (const b of TICKET_BUNDLES) {
  console.log(`  ${b.title} (${b.qty} tickets each): ${bundleCounts[b.id] || 0} people`)
}
console.log(`\nAdmin → Draw winner → select "${PERIOD_TITLE}" — pool must not include other periods.`)
