import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation } from './db.mjs'
import {
  insertTicketNumbers,
  insertPreservedTicketNumbers,
  ensureTicketNumbersForPurchase,
} from './ticketNumbers.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { upsertUserContact } from './userContact.mjs'

function orderPublicId() {
  return `ORD-${randomBytes(4).toString('hex').toUpperCase()}`
}

/** No email on payment — one confirmation email is sent after skill answers (payment providers may send their own receipt). */
function paymentEmailDeferred() {
  return { emailSent: false, emailSkipped: true, reason: 'deferred_until_quiz' }
}

async function finalizePendingTicket({
  row,
  customerEmail,
  customerFullName,
  customerPhone,
  periodId,
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

  const userId = await upsertUserContact({
    email: customerEmail,
    fullName: customerFullName || '',
    phone: customerPhone,
  })
  const purchasedAt = new Date().toISOString()
  await query(
    `UPDATE tickets SET payment_status = 'paid', purchased_at = $2, user_id = $3, period_id = COALESCE(period_id, $4) WHERE id = $1`,
    [row.id, purchasedAt, userId, periodId || null],
  )

  const payId = randomUUID()
  const txId =
    paymentIntentId ||
    (provider === 'stripe'
      ? `stripe_session_${externalId}`
      : provider === 'cashflows'
        ? `cashflows_${externalId}`
        : `paypal_${externalId}`)
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
            : provider === 'cashflows'
              ? { cashflows_payment_job_reference: externalId }
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

export async function recordPayPalCapture({
  paypalOrderId,
  customerEmail,
  customerFullName,
  customerPhone,
  periodId,
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
      customerPhone,
      periodId,
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

  const userId = await upsertUserContact({
    email,
    fullName: customerFullName || '',
    phone: customerPhone,
  })
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)

  const tid = orderPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, paypal_order_id, purchased_at, period_id)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7, $8)`,
    [ticketId, tid, userId, bundleId || null, qty, paypalOrderId, purchasedAt, periodId || null],
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

export async function recordCashflowsPaymentCompleted({
  paymentJobReference,
  customerEmail,
  customerFullName,
  customerPhone,
  periodId,
  bundleId,
  quantity,
  amountPence,
  currency,
  reservedTicketNumbers,
}) {
  if (!isDbConfigured()) return null
  const email = customerEmail?.trim()
  if (!email || !email.includes('@')) return null
  const jobRef = typeof paymentJobReference === 'string' ? paymentJobReference.trim() : ''
  if (!jobRef) return null

  await ensureTicketSchema()

  const dup = await query(
    `SELECT id, ticket_public_id, payment_status, quantity, confirmation_email_sent_at FROM tickets WHERE cashflows_payment_job_reference = $1`,
    [jobRef],
  )
  if (dup.rows[0]) {
    const finalized = await finalizePendingTicket({
      row: dup.rows[0],
      customerEmail: email,
      customerFullName,
      customerPhone,
      periodId,
      amountPence,
      currency,
      provider: 'cashflows',
      externalId: jobRef,
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

  const userId = await upsertUserContact({
    email,
    fullName: customerFullName || '',
    phone: customerPhone,
  })
  const tid = orderPublicId()
  const ticketId = randomUUID()
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)

  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, cashflows_payment_job_reference, purchased_at, period_id)
     VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7, $8)`,
    [ticketId, tid, userId, bundleId || null, qty, jobRef, purchasedAt, periodId || null],
  )

  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'cashflows', 'successful', $7)
     ON CONFLICT (transaction_id) DO NOTHING`,
    [
      payId,
      `cashflows_${jobRef}`,
      userId,
      ticketId,
      amountPence,
      (currency || 'gbp').toLowerCase(),
      JSON.stringify({ cashflows_payment_job_reference: jobRef }),
    ],
  )

  const reserved = Array.isArray(reservedTicketNumbers) ? reservedTicketNumbers.filter(Boolean) : []
  const ticketNumbers =
    reserved.length === qty
      ? await insertPreservedTicketNumbers(ticketId, reserved)
      : await insertTicketNumbers(ticketId, qty)
  return { ticketId, userId, ticketPublicId: tid, ticketNumbers, ...paymentEmailDeferred() }
}
