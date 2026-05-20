import Stripe from 'stripe'
import { parseJsonBody, json } from './lib/http.mjs'
import { recordStripePaymentIntentCompleted } from './lib/recordSale.mjs'
import { isDbConfigured } from './lib/db.mjs'

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

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return json(res, 503, { error: 'Stripe not configured' })
  }

  const body = parseJsonBody(req)
  const paymentIntentId =
    typeof body.paymentIntentId === 'string' ? body.paymentIntentId.trim() : ''
  if (!paymentIntentId.startsWith('pi_')) {
    return json(res, 400, { error: 'Invalid paymentIntentId' })
  }

  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 320) : ''
  const customerFullName =
    typeof body.customerFullName === 'string' ? body.customerFullName.trim().slice(0, 200) : ''
  const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : ''

  try {
    const stripe = new Stripe(secret)
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (intent.status !== 'succeeded') {
      return json(res, 400, { error: 'Payment not completed', status: intent.status })
    }

    if (!isDbConfigured()) {
      return json(res, 200, {
        ok: true,
        skipped: true,
        reason: 'no_database',
        paymentIntentId: intent.id,
      })
    }

    const md = intent.metadata || {}
    const qty = Math.max(1, parseInt(md.ticket_quantity, 10) || 1)
    const email = customerEmail || intent.receipt_email || ''
    const fullName = customerFullName || md.customer_full_name || ''

    const recorded = await recordStripePaymentIntentCompleted({
      paymentIntentId: intent.id,
      customerEmail: email,
      customerFullName: fullName,
      bundleId: bundleId || md.bundle_id,
      quantity: qty,
      amountPence: intent.amount_received || intent.amount,
      currency: intent.currency || 'gbp',
    })

    if (!recorded) {
      return json(res, 200, { ok: true, skipped: true, reason: 'not_recorded' })
    }

    return json(res, 200, {
      ok: true,
      deduped: Boolean(recorded.deduped),
      orderRef: recorded.ticketPublicId,
      ticketNumbers: recorded.ticketNumbers || [],
      emailSent: Boolean(recorded.emailSent),
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: e instanceof Error ? e.message : 'Stripe error' })
  }
}
