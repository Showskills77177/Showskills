import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import { isDbConfigured, query } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import {
  isCashflowsPaymentSuccessful,
  parseCashflowsAmountPence,
  retrieveCashflowsPaymentIntent,
} from './cashflows.mjs'
import { recordCashflowsPaymentCompleted } from './recordSale.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'
import { getTicketNumbersForPurchase } from './ticketNumbers.mjs'

/**
 * Verify Cashflows intent status server-side and record the ticket sale.
 * @param {{ paymentJobReference: string, customerEmail?: string, customerFullName?: string, customerPhone?: string, bundleId?: string }} input
 */
export async function recordCashflowsPaymentFromVerifiedIntent(input) {
  const paymentJobReference =
    typeof input.paymentJobReference === 'string' ? input.paymentJobReference.trim() : ''
  if (!paymentJobReference) {
    return { ok: false, status: 400, error: 'paymentJobReference is required' }
  }

  if (!isDbConfigured()) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, skipped: true, reason: 'no_database', paymentJobReference },
    }
  }

  await ensureTicketSchema()

  const ticketRow = await query(
    `SELECT id, bundle_id, quantity, period_id, cashflows_intent_token, payment_status
     FROM tickets WHERE cashflows_payment_job_reference = $1`,
    [paymentJobReference],
  )
  const row = ticketRow.rows[0]
  if (!row) {
    return { ok: false, status: 404, error: 'No pending order found for this payment' }
  }

  const token = typeof row.cashflows_intent_token === 'string' ? row.cashflows_intent_token.trim() : ''
  if (!token) {
    return { ok: false, status: 400, error: 'Payment session is missing verification token' }
  }

  let intentData
  try {
    intentData = await retrieveCashflowsPaymentIntent(token)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not verify payment with Cashflows'
    return { ok: false, status: 502, error: message }
  }

  if (!isCashflowsPaymentSuccessful(intentData)) {
    return {
      ok: false,
      status: 400,
      error: 'Payment not completed',
      paymentStatus: intentData?.paymentStatus,
      lastPaymentStatus: intentData?.lastPaymentStatus,
    }
  }

  const bundleId =
    (typeof input.bundleId === 'string' ? input.bundleId.trim() : '') ||
    (typeof row.bundle_id === 'string' ? row.bundle_id.trim() : '')
  const bundle = getTicketBundleById(bundleId)
  if (!bundle) {
    return { ok: false, status: 400, error: 'Invalid bundle on pending order' }
  }

  const intentPence = parseCashflowsAmountPence(intentData.amountToCollect)
  if (intentPence != null && intentPence !== bundle.totalPence) {
    return { ok: false, status: 400, error: 'Payment amount does not match ticket bundle' }
  }

  const customerEmail =
    typeof input.customerEmail === 'string' ? input.customerEmail.trim().slice(0, 320) : ''
  const customerFullName =
    typeof input.customerFullName === 'string' ? input.customerFullName.trim().slice(0, 200) : ''
  const customerPhone =
    typeof input.customerPhone === 'string'
      ? input.customerPhone
      : typeof input.phone === 'string'
        ? input.phone
        : ''

  if (!customerEmail.includes('@')) {
    return { ok: false, status: 400, error: 'Valid customerEmail required' }
  }

  const reservedTicketNumbers = await getTicketNumbersForPurchase(row.id)

  const recorded = await recordCashflowsPaymentCompleted({
    paymentJobReference,
    customerEmail,
    customerFullName,
    customerPhone,
    periodId: row.period_id || null,
    bundleId: bundle.id,
    quantity: row.quantity || bundle.qty,
    amountPence: bundle.totalPence,
    currency: (process.env.CASHFLOWS_CURRENCY || 'gbp').toLowerCase(),
    reservedTicketNumbers,
    countryCode: input.countryCode || null,
  })

  if (!recorded) {
    return { ok: true, status: 200, body: { ok: true, skipped: true, reason: 'not_recorded' } }
  }

  const resumeToken = await ensureQuizResumeToken(recorded.ticketId)

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      deduped: Boolean(recorded.deduped),
      orderRef: recorded.ticketPublicId,
      ticketNumbers: recorded.ticketNumbers || [],
      emailSent: Boolean(recorded.emailSent),
      customerEmail: customerEmail.toLowerCase(),
      customerFullName: (customerFullName || '').trim(),
      resumeToken,
    },
  }
}
