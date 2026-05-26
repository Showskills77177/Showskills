import Stripe from 'stripe'
import { readRawBody } from './lib/readRawBody.mjs'
import { json } from './lib/http.mjs'
import { applyCors } from './lib/cors.mjs'
import { recordStripePaymentIntentCompleted } from '../lib/recordSaleStripe.mjs'
import { assertPaymentIntentMatchesBundle } from './lib/paymentSecurity.mjs'
import { isDbConfigured } from './lib/db.mjs'

/**
 * Stripe webhook — authoritative backup when the browser never calls record-stripe-payment.
 * Configure in Stripe Dashboard → Developers → Webhooks → payment_intent.succeeded
 * Set STRIPE_WEBHOOK_SECRET to the signing secret (whsec_...).
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(req, res)
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret || !webhookSecret) {
    return json(res, 503, { error: 'Stripe webhook not configured' })
  }

  const sig = req.headers['stripe-signature'] || req.headers['Stripe-Signature']
  if (typeof sig !== 'string' || !sig) {
    return json(res, 400, { error: 'Missing Stripe-Signature' })
  }

  let event
  try {
    const raw = await readRawBody(req)
    const stripe = new Stripe(secret)
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret)
  } catch (e) {
    console.error('Stripe webhook signature:', e)
    return json(res, 400, { error: 'Invalid signature' })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return json(res, 200, { received: true, ignored: event.type })
  }

  const intent = event.data?.object
  if (!intent?.id?.startsWith('pi_')) {
    return json(res, 200, { received: true, ignored: 'not_payment_intent' })
  }

  if (!isDbConfigured()) {
    return json(res, 200, { received: true, skipped: 'no_database' })
  }

  const bundleId = typeof intent.metadata?.bundle_id === 'string' ? intent.metadata.bundle_id.trim() : ''
  const bundleCheck = assertPaymentIntentMatchesBundle(intent, bundleId)
  if (!bundleCheck.ok) {
    console.error('Stripe webhook bundle check failed:', bundleCheck.error, intent.id)
    return json(res, 200, { received: true, skipped: bundleCheck.error })
  }

  const email = (intent.receipt_email || intent.metadata?.customer_email || '').trim()
  if (!email.includes('@')) {
    return json(res, 200, { received: true, skipped: 'no_email' })
  }

  try {
    const recorded = await recordStripePaymentIntentCompleted({
      paymentIntentId: intent.id,
      customerEmail: email,
      customerFullName: intent.metadata?.customer_full_name || '',
      bundleId: bundleCheck.bundle.id,
      quantity: bundleCheck.bundle.qty,
      amountPence: intent.amount_received ?? intent.amount,
      currency: intent.currency || 'gbp',
      reservedTicketNumbers: [],
    })
    return json(res, 200, {
      received: true,
      recorded: Boolean(recorded),
      deduped: Boolean(recorded?.deduped),
    })
  } catch (e) {
    console.error('Stripe webhook record:', e)
    return json(res, 500, { error: 'Webhook processing failed' })
  }
}
