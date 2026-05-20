import Stripe from 'stripe'
import { getTicketBundleById } from '../../shared/ticketBundles.mjs'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import {
  buildCheckoutDescription,
  buildStripePaymentMetadata,
  STRIPE_CHECKOUT_DESCRIPTION_MAX,
} from '../../shared/checkoutTicketDescription.mjs'
import { reserveTicketNumbers } from './lib/ticketNumbers.mjs'
import { createPendingTicketCheckout } from './lib/pendingCheckout.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'

function parseBody(req) {
  const b = req.body
  if (b == null) return {}
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return {}
    }
  }
  if (typeof b === 'object') return b
  return {}
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const limited = applyRateLimit(req, res, { pathKey: 'create-payment-intent', max: 12, windowMs: 60_000 })
  if (limited.blocked) {
    return res.status(429).json({ error: 'Too many payment attempts. Please wait and try again.' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return res.status(503).json({ error: 'Stripe is not configured on the server.' })
  }

  const body = parseBody(req)
  const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : ''
  const bundle = getTicketBundleById(bundleId)
  if (!bundle) {
    return res.status(400).json({ error: 'Invalid or missing bundleId' })
  }

  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 320) : ''
  const customerFullName =
    typeof body.customerFullName === 'string' ? body.customerFullName.trim().slice(0, 200) : ''
  if (!customerEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid customerEmail required' })
  }
  if (!customerFullName) {
    return res.status(400).json({ error: 'customerFullName required' })
  }

  const currency = (process.env.STRIPE_CURRENCY || 'gbp').toLowerCase()
  const stripe = new Stripe(secret)

  try {
    const ticketNumbers = await reserveTicketNumbers(bundle.qty)
    const description = buildCheckoutDescription({
      bundleSummary: `${bundle.title}: ${bundle.line1} (${bundle.qty} ticket${bundle.qty === 1 ? '' : 's'}). Submit skill answers after payment.`,
      nonRefundNotice: TICKET_PURCHASE_NON_REFUND_NOTICE,
      maxLength: STRIPE_CHECKOUT_DESCRIPTION_MAX,
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: bundle.totalPence,
      currency,
      description,
      receipt_email: customerEmail,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: buildStripePaymentMetadata({
        bundleId: bundle.id,
        qty: bundle.qty,
        customerFullName,
      }),
    })

    if (!paymentIntent.client_secret) {
      return res.status(502).json({ error: 'Stripe did not return a client secret' })
    }

    let pending = null
    try {
      pending = await createPendingTicketCheckout({
        provider: 'stripe_pi',
        externalId: paymentIntent.id,
        bundleId: bundle.id,
        quantity: bundle.qty,
        ticketNumbers,
        customerEmail,
        customerFullName,
      })
    } catch (pendingErr) {
      console.error('createPendingTicketCheckout (stripe_pi):', pendingErr)
    }

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderRef: pending?.ticketPublicId ?? null,
      ticketNumbers: pending?.ticketNumbers ?? ticketNumbers,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Stripe error'
    return res.status(502).json({ error: message })
  }
}
