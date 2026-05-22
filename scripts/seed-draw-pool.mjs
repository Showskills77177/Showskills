/**
 * Seed qualified draw pool (paid tickets + correct quiz).
 *
 *   node scripts/seed-draw-pool.mjs           # 3 sample entrants (default)
 *   node scripts/seed-draw-pool.mjs 200       # 200 unique names, 1 ticket each
 *   node scripts/seed-draw-pool.mjs 200 --clear # remove prior draw-*@local.test rows first
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const clearFirst = args.includes('--clear')
const countArg = args.find((a) => /^\d+$/.test(a))
const entrantCount = countArg ? Math.min(500, Math.max(1, parseInt(countArg, 10))) : 3

const { ensureTicketSchema } = await import('../backend/api/lib/ensureTicketSchema.mjs')
const { recordStripePaymentIntentCompleted } = await import('../backend/api/lib/recordSale.mjs')
const { reserveTicketNumbers } = await import('../backend/api/lib/ticketNumbers.mjs')
const { query, isDbConfigured, dbIsPostgres } = await import('../backend/api/lib/db.mjs')
const { fetchDrawPoolSummary } = await import('../backend/api/lib/qualifiedDrawPool.mjs')

await ensureTicketSchema()
if (!dbIsPostgres()) {
  for (const col of ['stripe_payment_intent_id', 'quiz_resume_token']) {
    try {
      await query(`ALTER TABLE tickets ADD COLUMN ${col} TEXT`)
    } catch {
      /* already exists */
    }
  }
}

if (!isDbConfigured()) {
  console.error('No database. Run npm run db:setup && npm run db:schema first.')
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
  'Thomas', 'Aria', 'Dylan', 'Lily', 'Muhammad', 'Aurora', 'Daniel', 'Zoey', 'Matthew', 'Penelope',
]

const LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
]

/** Ticket counts rotated across entrants (each number = one draw slot). */
const TICKET_QUANTITIES = [1, 3, 5, 10, 20]

function bundleIdForQuantity(qty) {
  if (qty >= 10) return 'medium10'
  if (qty >= 5) return 'small5'
  return 'single'
}

function buildEntrants(n) {
  if (n <= 3) {
    return [
      { email: 'draw-alice@local.test', name: 'Alice Draw Test', bundleId: 'single', quantity: 1 },
      { email: 'draw-bob@local.test', name: 'Bob Draw Test', bundleId: 'medium10', quantity: 10 },
      { email: 'draw-carol@local.test', name: 'Carol Draw Test', bundleId: 'small5', quantity: 5 },
    ].slice(0, n)
  }
  const list = []
  for (let i = 0; i < n; i += 1) {
    const num = String(i + 1).padStart(3, '0')
    const first = FIRST[i % FIRST.length]
    const last = LAST[Math.floor(i / FIRST.length) % LAST.length]
    const quantity = TICKET_QUANTITIES[i % TICKET_QUANTITIES.length]
    list.push({
      email: `draw-${num}@local.test`,
      name: `${first} ${last}`,
      bundleId: bundleIdForQuantity(quantity),
      quantity,
    })
  }
  return list
}

async function clearLocalDrawTestRows() {
  const like = '%@local.test'
  const users = await query(`SELECT id FROM users WHERE lower(email) LIKE $1`, [like])
  const ids = users.rows.map((r) => r.id)
  if (!ids.length) return
  const ph = ids.map((_, i) => `$${i + 1}`).join(', ')
  await query(`DELETE FROM draw_runs WHERE 1=1`)
  await query(`DELETE FROM competition_entries WHERE user_id IN (${ph})`, ids)
  await query(`DELETE FROM ticket_numbers WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id IN (${ph}))`, ids)
  await query(`DELETE FROM payments WHERE user_id IN (${ph})`, ids)
  await query(`DELETE FROM tickets WHERE user_id IN (${ph})`, ids)
  await query(`DELETE FROM users WHERE id IN (${ph})`, ids)
  console.log(`Cleared ${ids.length} prior local.test draw users (and their tickets).`)
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

if (clearFirst) {
  await clearLocalDrawTestRows()
}

const entrants = buildEntrants(entrantCount)
const runId = Date.now()
let ok = 0
let fail = 0

console.log(`Seeding ${entrants.length} qualified entrant(s)…`)

for (let i = 0; i < entrants.length; i += 1) {
  const ent = entrants[i]
  const pi = `pi_seed_draw_${String(i + 1).padStart(4, '0')}_${runId}`
  try {
    const ticketNumbers = await reserveTicketNumbers(ent.quantity)
    const sale = await recordStripePaymentIntentCompleted({
      paymentIntentId: pi,
      customerEmail: ent.email,
      customerFullName: ent.name,
      bundleId: ent.bundleId,
      quantity: ent.quantity,
      amountPence: Math.max(75, 75 * ent.quantity),
      currency: 'gbp',
      reservedTicketNumbers: ticketNumbers,
    })
    if (!sale?.ticketId) {
      fail += 1
      continue
    }
    const t = await query(`SELECT user_id, purchased_at FROM tickets WHERE id = $1`, [sale.ticketId])
    await qualifyEntry(t.rows[0].user_id, t.rows[0].purchased_at || new Date().toISOString())
    ok += 1
    if (entrantCount <= 10 || (i + 1) % 25 === 0 || i === entrants.length - 1) {
      console.log(`  ${i + 1}/${entrants.length} — ${ent.name}`)
    }
  } catch (e) {
    fail += 1
    console.error(`  ✗ ${ent.name}:`, e instanceof Error ? e.message : e)
  }
}

const summary = await fetchDrawPoolSummary()
console.log(`\nDone: ${ok} created, ${fail} failed.`)
console.log('Draw pool:', summary.poolSize, 'ticket slots,', summary.uniqueEntrants, 'entrants')
console.log('Open http://localhost:5173/admin/draw')
