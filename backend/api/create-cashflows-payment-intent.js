import { reserveTicketNumbers } from './lib/ticketNumbers.mjs'
import { createPendingTicketCheckout } from './lib/pendingCheckout.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { validateContactPhone } from '../../shared/contactPhone.mjs'
import { getOpenCompetitionPeriodForEntry } from './lib/competitionPeriods.mjs'
import { parseCheckoutCompetition, resolveCheckoutBundle } from './lib/checkoutBundle.mjs'
import { createCashflowsPaymentIntent, getCashflowsConfig } from './lib/cashflows.mjs'
import { parseJsonBody, json } from './lib/http.mjs'
import { requireUkForPaidTickets } from './lib/requireUkForPaidTickets.mjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const limited = applyRateLimit(req, res, {
    pathKey: 'create-cashflows-payment-intent',
    max: 12,
    windowMs: 60_000,
  })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many payment attempts. Please wait and try again.' })
  }

  if (!getCashflowsConfig().configured) {
    return json(res, 503, { error: 'Cashflows is not configured on the server.' })
  }

  const ukBlock = requireUkForPaidTickets(req)
  if (ukBlock) return json(res, 403, { error: ukBlock.error, code: ukBlock.code })

  const body = parseJsonBody(req)
  const competition = await parseCheckoutCompetition(body)
  const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : ''
  const bundleResult = await resolveCheckoutBundle(competition, bundleId)
  if (!bundleResult.ok) {
    return json(res, 400, { error: bundleResult.error })
  }
  const { bundle } = bundleResult

  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 320) : ''
  const customerFullName =
    typeof body.customerFullName === 'string' ? body.customerFullName.trim().slice(0, 200) : ''
  if (!customerEmail.includes('@')) {
    return json(res, 400, { error: 'Valid customerEmail required' })
  }
  if (!customerFullName) {
    return json(res, 400, { error: 'customerFullName required' })
  }

  const newsletterOptIn = body.newsletterOptIn === true || body.newsletterOptIn === 'true'
  const customerPhone =
    typeof body.customerPhone === 'string'
      ? body.customerPhone
      : typeof body.phone === 'string'
        ? body.phone
        : ''
  const phoneCheck = validateContactPhone(customerPhone)
  if (!phoneCheck.ok) {
    return json(res, 400, { error: phoneCheck.error })
  }

  const periodResult = await getOpenCompetitionPeriodForEntry(competition)
  if (!periodResult.ok) {
    return json(res, 403, { error: periodResult.error })
  }

  const currency = (process.env.CASHFLOWS_CURRENCY || process.env.STRIPE_CURRENCY || 'GBP')
    .trim()
    .toUpperCase()

  try {
    const ticketNumbers = await reserveTicketNumbers(bundle.qty)
    let pending = null
    const orderNumber = `SS-${Date.now().toString(36).toUpperCase()}`

    const intent = await createCashflowsPaymentIntent({
      amountPence: bundle.totalPence,
      currency,
      orderNumber,
    })

    try {
      pending = await createPendingTicketCheckout({
        provider: 'cashflows',
        externalId: intent.paymentJobReference,
        bundleId: bundle.id,
        quantity: bundle.qty,
        ticketNumbers,
        customerEmail,
        customerFullName,
        customerPhone: phoneCheck.phone,
        periodId: periodResult.period.id,
        competition,
        cashflowsIntentToken: intent.token,
        newsletterOptIn,
      })
    } catch (pendingErr) {
      console.error('createPendingTicketCheckout (cashflows):', pendingErr)
    }

    const cfg = getCashflowsConfig()
    return json(res, 200, {
      token: intent.token,
      paymentJobReference: intent.paymentJobReference,
      orderRef: pending?.ticketPublicId ?? null,
      ticketNumbers: pending?.ticketNumbers ?? ticketNumbers,
      isIntegration: cfg.isIntegration,
      amountPence: bundle.totalPence,
      currency,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Cashflows error'
    return json(res, 502, { error: message })
  }
}
