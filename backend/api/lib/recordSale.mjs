import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation } from './db.mjs'
import { insertTicketNumbers, getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { sendPurchaseConfirmationEmail } from './sendPurchaseEmail.mjs'
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

async function maybeSendPurchaseEmail({
  ticketId,
  ticketPublicId,
  customerEmail,
  customerFullName,
  bundleId,
  quantity,
  amountPence,
}) {
  const sentRow = await query(`SELECT confirmation_email_sent_at FROM tickets WHERE id = $1`, [ticketId])
  if (sentRow.rows[0]?.confirmation_email_sent_at) {
    return { emailSent: false, emailSkipped: true, reason: 'already_sent' }
  }

  const result = await sendPurchaseConfirmationEmail({
    to: customerEmail,
    customerFullName,
    bundleId,
    quantity,
    amountPence,
    ticketNumbers: [],
    purchaseRef: ticketPublicId,
  })

  if (result.ok) {
    const ts = new Date().toISOString()
    await query(`UPDATE tickets SET confirmation_email_sent_at = $2 WHERE id = $1`, [ticketId, ts])
    return { emailSent: true, emailId: result.id }
  }

  return { emailSent: false, emailSkipped: result.skipped, emailError: result.error || result.reason }
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

  await ensureTicketSchema()

  const dup = await query(
    `SELECT id, ticket_public_id, confirmation_email_sent_at FROM tickets WHERE stripe_session_id = $1`,
    [stripeSessionId],
  )
  if (dup.rows[0]) {
    const ticketNumbers = await getTicketNumbersForPurchase(dup.rows[0].id)
    return {
      ticketId: dup.rows[0].id,
      ticketPublicId: dup.rows[0].ticket_public_id,
      ticketNumbers,
      deduped: true,
    }
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

  const ticketNumbers = await insertTicketNumbers(ticketId, qty)
  const emailMeta = await maybeSendPurchaseEmail({
    ticketId,
    ticketPublicId: tid,
    customerEmail: email,
    customerFullName,
    bundleId,
    quantity: qty,
    amountPence,
  })

  return { ticketId, userId, ticketPublicId: tid, ticketNumbers, ...emailMeta }
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
    `SELECT id, ticket_public_id, quantity, confirmation_email_sent_at FROM tickets WHERE paypal_order_id = $1`,
    [paypalOrderId],
  )
  if (existing.rows[0]) {
    const row = existing.rows[0]
    let ticketNumbers = await getTicketNumbersForPurchase(row.id)
    if (!ticketNumbers.length) {
      ticketNumbers = await insertTicketNumbers(row.id, row.quantity || quantity || 1)
    }
    return {
      ticketId: row.id,
      ticketPublicId: row.ticket_public_id,
      ticketNumbers,
      deduped: true,
    }
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
  const emailMeta = await maybeSendPurchaseEmail({
    ticketId,
    ticketPublicId: tid,
    customerEmail: email,
    customerFullName,
    bundleId,
    quantity: qty,
    amountPence,
  })

  return { ticketId, userId, ticketPublicId: tid, ticketNumbers, ...emailMeta }
}
