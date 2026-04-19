import Stripe from 'stripe'
import { getTicketBundleById } from '../../shared/ticketBundles.mjs'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'

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
  const description = `${bundle.title}: ${bundle.line1}. Skill-based competition — submit answers after payment. ${TICKET_PURCHASE_NON_REFUND_NOTICE}`

  try {
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
      metadata: {
        competition: 'ronaldo_legacy_bundle',
        bundle_id: bundle.id,
        ticket_quantity: String(bundle.qty),
        customer_full_name: customerFullName || '',
      },
    })

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Stripe error'
    return res.status(502).json({ error: message })
  }
}
