import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { insertPreservedTicketNumbers, getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { upsertUserContact } from './userContact.mjs'

function orderPublicId() {
  return `ORD-${randomBytes(4).toString('hex').toUpperCase()}`
}

function providerColumn(provider) {
  if (provider === 'stripe') return 'stripe_session_id'
  if (provider === 'stripe_pi') return 'stripe_payment_intent_id'
  if (provider === 'cashflows') return 'cashflows_payment_job_reference'
  return 'paypal_order_id'
}

/**
 * Reserve ticket numbers on a pending ticket row before payment completes.
 * @param {'stripe'|'stripe_pi'|'paypal'|'cashflows'} provider
 */
export async function createPendingTicketCheckout({
  provider,
  externalId,
  bundleId,
  quantity,
  ticketNumbers,
  customerEmail,
  customerFullName,
  customerPhone,
  periodId,
  cashflowsIntentToken,
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
    userId = await upsertUserContact({
      email,
      fullName: customerFullName || '',
      phone: customerPhone,
    })
  }

  const ticketId = randomUUID()
  const tid = orderPublicId()
  const qty = Math.max(1, parseInt(String(quantity), 10) || 1)
  const stripeSessionId = provider === 'stripe' ? externalId : null
  const stripePaymentIntentId = provider === 'stripe_pi' ? externalId : null
  const paypalOrderId = provider === 'paypal' ? externalId : null
  const cashflowsJobRef = provider === 'cashflows' ? externalId : null
  const cashflowsToken =
    provider === 'cashflows' && typeof cashflowsIntentToken === 'string'
      ? cashflowsIntentToken.trim()
      : null

  await query(
    `INSERT INTO tickets (id, ticket_public_id, user_id, bundle_id, quantity, payment_status, stripe_session_id, stripe_payment_intent_id, paypal_order_id, cashflows_payment_job_reference, cashflows_intent_token, period_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11)`,
    [
      ticketId,
      tid,
      userId,
      bundleId || null,
      qty,
      stripeSessionId,
      stripePaymentIntentId,
      paypalOrderId,
      cashflowsJobRef,
      cashflowsToken,
      periodId || null,
    ],
  )

  const nums = await insertPreservedTicketNumbers(ticketId, ticketNumbers)
  return { ticketId, ticketPublicId: tid, ticketNumbers: nums, periodId }
}
