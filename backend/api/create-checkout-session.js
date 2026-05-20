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

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return res.status(503).json({ error: 'Stripe is not configured on the server.' })
  }

  const stripe = new Stripe(secret)
  const body = parseBody(req)

  const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : ''
  const bundle = getTicketBundleById(bundleId)
  if (!bundle) {
    return res.status(400).json({ error: 'Invalid or missing bundleId' })
  }

  const currency = (process.env.STRIPE_CURRENCY || 'gbp').toLowerCase()

  const successUrl = typeof body.successUrl === 'string' ? body.successUrl : ''
  const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl : ''
  if (!successUrl.startsWith('http') || !cancelUrl.startsWith('http')) {
    return res.status(400).json({ error: 'successUrl and cancelUrl must be absolute URLs' })
  }

  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 320) : ''
  const customerFullName =
    typeof body.customerFullName === 'string' ? body.customerFullName.trim().slice(0, 200) : ''

  const productName = `Ronaldo Legacy Bundle — ${bundle.qty} ticket${bundle.qty === 1 ? '' : 's'}`
  const ticketNumbers = await reserveTicketNumbers(bundle.qty)
  const description = buildCheckoutDescription({
    bundleSummary: `${bundle.title}: ${bundle.line1} (${bundle.qty} ticket${bundle.qty === 1 ? '' : 's'}). Submit skill answers after payment.`,
    nonRefundNotice: TICKET_PURCHASE_NON_REFUND_NOTICE,
    maxLength: STRIPE_CHECKOUT_DESCRIPTION_MAX,
  })

  try {
    // Apple Pay & Google Pay: Stripe shows eligible wallet buttons on the hosted Checkout page when your
    // site origin is added under Dashboard → Settings → Payment method domains (HTTPS).
    // payment_method_types: ['card'] still allows those wallets; no separate 'apple_pay' type in Checkout.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      ...(customerEmail.includes('@') ? { customer_email: customerEmail } : {}),
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: productName,
              description,
            },
            unit_amount: bundle.totalPence,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      custom_text: {
        submit: { message: TICKET_PURCHASE_NON_REFUND_NOTICE },
      },
      metadata: buildStripePaymentMetadata({
        bundleId: bundle.id,
        qty: bundle.qty,
        customerFullName,
      }),
    })

    try {
      await createPendingTicketCheckout({
        provider: 'stripe',
        externalId: session.id,
        bundleId: bundle.id,
        quantity: bundle.qty,
        ticketNumbers,
        customerEmail,
        customerFullName,
      })
    } catch (pendingErr) {
      console.error('createPendingTicketCheckout (stripe):', pendingErr)
    }

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Stripe error'
    return res.status(502).json({ error: message })
  }
}
