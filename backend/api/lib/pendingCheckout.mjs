import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { insertPreservedTicketNumbers, getTicketNumbersForPurchase } from './ticketNumbers.mjs'

function orderPublicId() {
  return `ORD-${randomBytes(4).toString('hex').toUpperCase()}`
}

async function upsertUserSimple(email, fullName) {
  const e = email.trim().toLowerCase()
  const n = fullName?.trim() || 'Unknown'
  const newId = randomUUID()
  try {
    await query(`INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) RETURNING id`, [newId, e, n])
    return newId
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const u = await query(`SELECT id FROM users WHERE lower(email) = $1`, [e])
    if (u.rows[0]) {
      await query(`UPDATE users SET full_name = COALESCE(NULLIF($2,''), full_name) WHERE id = $1`, [
        u.rows[0].id,
        n,
      ])
      return u.rows[0].id
    }
    throw err
  }
}

function providerColumn(provider) {
  if (provider === 'stripe') return 'stripe_session_id'
  if (provider === 'stripe_pi') return 'stripe_payment_intent_id'
  return 'paypal_order_id'
}

/**
 * Reserve ticket numbers on a pending ticket row before payment completes.
 * @param {'stripe'|'stripe_pi'|'paypal'} provider
 */
export async function createPendingTicketCheckout({
  provider,
  externalId,
  bundleId,
  quantity,
  ticketNumbers,
  customerEmail,
  customerFullName,
}) {
  if (!isDbConfigured() || !externalId) return null
  await ensureTicketSchema()

  const col = providerColumn(provider)
  const dup = await query(`SELECT id, ticket_public_id FROM tickets WHERE ${col} = $1`, [externalId])
  if (dup.rows[0]) {
    const nums = await getTicketNumbersForPurchase(dup.rows[0].id)
    return {
      ticketId: dup.rows[0].id,
      ticketPublicId: dup.rows[0].ticket_public_id,
      ticketNumbers: nums.length ? nums : ticketNumbers,
      deduped: true,
    }
  }

  let userId = null
  const email = typeof customerEmail === 'string' ? customerEmail.trim() : ''
  if (email.includes('@')) {
    userId = await upsertUserSimple(email, customerFullName || '')
  }

  const ticketId = randomUUID()
  const tid = orderPublicId()
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)
  const stripeSessionId = provider === 'stripe' ? externalId : null
  const stripePaymentIntentId = provider === 'stripe_pi' ? externalId : null
  const paypalOrderId = provider === 'paypal' ? externalId : null

  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, stripe_session_id, stripe_payment_intent_id, paypal_order_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)`,
    [
      ticketId,
      tid,
      userId,
      bundleId || null,
      qty,
      stripeSessionId,
      stripePaymentIntentId,
      paypalOrderId,
    ],
  )

  const nums = await insertPreservedTicketNumbers(ticketId, ticketNumbers)
  return { ticketId, ticketPublicId: tid, ticketNumbers: nums }
}
