import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation } from './db.mjs'

function ticketPublicId() {
  return `TKT-${randomBytes(4).toString('hex').toUpperCase()}`
}

/** After unique violation on email, fetch id */
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

export async function recordStripeCheckoutCompleted({
  stripeSessionId,
  customerEmail,
  customerFullName,
  bundleId,
  quantity,
  amountPence,
  currency,
  paymentIntentId,
}) {
  if (!isDbConfigured()) return null
  const email = customerEmail?.trim()
  if (!email || !email.includes('@')) return null

  const userId = await upsertUserSimple(email, customerFullName || '')

  const tid = ticketPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, stripe_session_id, purchased_at)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7)`,
    [ticketId, tid, userId, bundleId || null, quantity || 1, stripeSessionId, purchasedAt],
  )

  const txId = paymentIntentId || `stripe_session_${stripeSessionId}`
  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'stripe', 'successful', $7)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [
      payId,
      txId,
      userId,
      ticketId,
      amountPence,
      (currency || 'gbp').toLowerCase(),
      JSON.stringify({ stripe_session_id: stripeSessionId }),
    ],
  )

  return { ticketId, userId, ticketPublicId: tid }
}

export async function recordPayPalCapture({
  paypalOrderId,
  customerEmail,
  customerFullName,
  bundleId,
  quantity,
  amountPence,
  currency,
}) {
  if (!isDbConfigured()) return null
  const email = customerEmail?.trim()
  if (!email || !email.includes('@')) return null

  const existing = await query(`SELECT id FROM tickets WHERE paypal_order_id = $1`, [paypalOrderId])
  if (existing.rows[0]) {
    return { ticketId: existing.rows[0].id, deduped: true }
  }

  const userId = await upsertUserSimple(email, customerFullName || '')

  const tid = ticketPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, paypal_order_id, purchased_at)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7)`,
    [ticketId, tid, userId, bundleId || null, quantity || 1, paypalOrderId, purchasedAt],
  )

  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'paypal', 'successful', $7)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [
      payId,
      `paypal_${paypalOrderId}`,
      userId,
      ticketId,
      amountPence,
      (currency || 'gbp').toLowerCase(),
      JSON.stringify({ paypal_order_id: paypalOrderId }),
    ],
  )

  return { ticketId, userId, ticketPublicId: tid }
}
