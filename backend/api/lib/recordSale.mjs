import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation } from './db.mjs'
import {
  insertTicketNumbers,
  insertPreservedTicketNumbers,
  ensureTicketNumbersForPurchase,
} from './ticketNumbers.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'

function orderPublicId() {
  return `ORD-${randomBytes(4).toString('hex').toUpperCase()}`
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

/** No email on payment — one confirmation email is sent after skill answers (Stripe/PayPal may send their own receipt). */
function paymentEmailDeferred() {
  return { emailSent: false, emailSkipped: true, reason: 'deferred_until_quiz' }
}

async function finalizePendingTicket({
  row,
  customerEmail,
  customerFullName,
  amountPence,
  currency,
  provider,
  externalId,
  paymentIntentId,
}) {
  const qty = Math.max(1, parseInt(String(row.quantity), 10) || 1)
  if (row.payment_status === 'paid') {
    const ticketNumbers = await ensureTicketNumbersForPurchase(row.id, qty)
    return {
      ticketId: row.id,
      ticketPublicId: row.ticket_public_id,
      ticketNumbers,
      deduped: true,
    }
  }

  let ticketNumbers = await ensureTicketNumbersForPurchase(row.id, qty)

  const userId = await upsertUserSimple(customerEmail, customerFullName || '')
  const purchasedAt = new Date().toISOString()
  await query(`UPDATE tickets SET payment_status = 'paid', purchased_at = $2, user_id = $3 WHERE id = $1`, [
    row.id,
    purchasedAt,
    userId,
  ])

  const payId = randomUUID()
  const txId =
    paymentIntentId ||
    (provider === 'stripe' ? `stripe_session_${externalId}` : `paypal_${externalId}`)
  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'successful', $8)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [
      payId,
      txId,
      userId,
      row.id,
      amountPence,
      (currency || 'gbp').toLowerCase(),
      provider,
      JSON.stringify(
        paymentIntentId
          ? { stripe_payment_intent_id: paymentIntentId }
          : provider === 'stripe'
            ? { stripe_session_id: externalId }
            : { paypal_order_id: externalId },
      ),
    ],
  )

  return {
    ticketId: row.id,
    ticketPublicId: row.ticket_public_id,
    ticketNumbers,
    ...paymentEmailDeferred(),
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
  reservedTicketNumbers,
}) {
  if (!isDbConfigured()) return null
  const email = customerEmail?.trim()
  if (!email || !email.includes('@')) return null

  await ensureTicketSchema()

  const dup = await query(
    `SELECT id, ticket_public_id, payment_status, quantity, confirmation_email_sent_at FROM tickets WHERE stripe_session_id = $1`,
    [stripeSessionId],
  )
  if (dup.rows[0]) {
    return finalizePendingTicket({
      row: dup.rows[0],
      customerEmail: email,
      customerFullName,
      amountPence,
      currency,
      provider: 'stripe',
      externalId: stripeSessionId,
      paymentIntentId,
    })
  }

  const userId = await upsertUserSimple(email, customerFullName || '')

  const tid = orderPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)

  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, stripe_session_id, purchased_at)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7)`,
    [ticketId, tid, userId, bundleId || null, qty, stripeSessionId, purchasedAt],
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

  const reserved = Array.isArray(reservedTicketNumbers) ? reservedTicketNumbers.filter(Boolean) : []
  const ticketNumbers =
    reserved.length === qty
      ? await insertPreservedTicketNumbers(ticketId, reserved)
      : await insertTicketNumbers(ticketId, qty)
  return { ticketId, userId, ticketPublicId: tid, ticketNumbers, ...paymentEmailDeferred() }
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

  await ensureTicketSchema()

  const existing = await query(
    `SELECT id, ticket_public_id, quantity, payment_status, confirmation_email_sent_at FROM tickets WHERE paypal_order_id = $1`,
    [paypalOrderId],
  )
  if (existing.rows[0]) {
    const finalized = await finalizePendingTicket({
      row: existing.rows[0],
      customerEmail: email,
      customerFullName,
      amountPence,
      currency,
      provider: 'paypal',
      externalId: paypalOrderId,
    })
    if (!finalized.ticketNumbers?.length) {
      const nums = await insertTicketNumbers(
        existing.rows[0].id,
        existing.rows[0].quantity || quantity || 1,
      )
      return { ...finalized, ticketNumbers: nums }
    }
    return finalized
  }

  const userId = await upsertUserSimple(email, customerFullName || '')
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)

  const tid = orderPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, paypal_order_id, purchased_at)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7)`,
    [ticketId, tid, userId, bundleId || null, qty, paypalOrderId, purchasedAt],
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

  const ticketNumbers = await insertTicketNumbers(ticketId, qty)
  return { ticketId, userId, ticketPublicId: tid, ticketNumbers, ...paymentEmailDeferred() }
}

export async function recordStripePaymentIntentCompleted({
  paymentIntentId,
  customerEmail,
  customerFullName,
  bundleId,
  quantity,
  amountPence,
  currency,
  reservedTicketNumbers,
}) {
  if (!isDbConfigured()) return null
  const email = customerEmail?.trim()
  if (!email || !email.includes('@')) return null

  await ensureTicketSchema()

  const dup = await query(
    `SELECT id, ticket_public_id, payment_status, quantity, confirmation_email_sent_at FROM tickets WHERE stripe_payment_intent_id = $1`,
    [paymentIntentId],
  )
  if (dup.rows[0]) {
    const finalized = await finalizePendingTicket({
      row: dup.rows[0],
      customerEmail: email,
      customerFullName,
      amountPence,
      currency,
      provider: 'stripe',
      externalId: paymentIntentId,
      paymentIntentId,
    })
    if (!finalized.ticketNumbers?.length) {
      const nums = await ensureTicketNumbersForPurchase(
        dup.rows[0].id,
        dup.rows[0].quantity || quantity || 1,
      )
      return { ...finalized, ticketNumbers: nums }
    }
    return finalized
  }

  const userId = await upsertUserSimple(email, customerFullName || '')
  const tid = orderPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)

  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, stripe_payment_intent_id, purchased_at)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7)`,
    [ticketId, tid, userId, bundleId || null, qty, paymentIntentId, purchasedAt],
  )

  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'stripe', 'successful', $7)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [
      payId,
      paymentIntentId,
      userId,
      ticketId,
      amountPence,
      (currency || 'gbp').toLowerCase(),
      JSON.stringify({ stripe_payment_intent_id: paymentIntentId }),
    ],
  )

  const reserved = Array.isArray(reservedTicketNumbers) ? reservedTicketNumbers.filter(Boolean) : []
  const ticketNumbers =
    reserved.length === qty
      ? await insertPreservedTicketNumbers(ticketId, reserved)
      : await insertTicketNumbers(ticketId, qty)
  return { ticketId, userId, ticketPublicId: tid, ticketNumbers, ...paymentEmailDeferred() }
}

/** Parse comma-separated ticket numbers from Stripe session metadata. */
export function parseReservedTicketNumbersMetadata(metadata) {
  const raw = metadata?.ticket_numbers
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
