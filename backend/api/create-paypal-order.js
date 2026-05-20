import { getPayPalCredentials, getCheckoutCurrency, paypalAccessToken } from './lib/paypal.js'
import { getTicketBundleById } from '../../shared/ticketBundles.mjs'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import {
  buildCheckoutDescription,
  PAYPAL_CHECKOUT_DESCRIPTION_MAX,
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

  const creds = getPayPalCredentials()
  if (!creds) {
    return res.status(503).json({ error: 'PayPal is not configured on the server.' })
  }

  const body = parseBody(req)
  const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : ''
  const bundle = getTicketBundleById(bundleId)
  if (!bundle) {
    return res.status(400).json({ error: 'Invalid or missing bundleId' })
  }

  const currency = getCheckoutCurrency()
  const value = (bundle.totalPence / 100).toFixed(2)
  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 320) : ''
  const customerFullName =
    typeof body.customerFullName === 'string' ? body.customerFullName.trim().slice(0, 200) : ''

  const ticketNumbers = await reserveTicketNumbers(bundle.qty)
  const description = buildCheckoutDescription({
    bundleSummary: `Ronaldo Legacy Bundle — ${bundle.qty} ticket(s). Submit skill answers after payment.`,
    nonRefundNotice: TICKET_PURCHASE_NON_REFUND_NOTICE,
    maxLength: PAYPAL_CHECKOUT_DESCRIPTION_MAX,
  })

  try {
    const token = await paypalAccessToken(creds)
    const createRes = await fetch(`${creds.apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value,
            },
            description,
            custom_id: `ronaldo_legacy_bundle|${bundle.id}|qty:${bundle.qty}|tickets:${ticketNumbers.length}`,
          },
        ],
        application_context: {
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      }),
    })

    const data = await createRes.json().catch(() => ({}))
    if (!createRes.ok) {
      const msg = data.message || data.error || JSON.stringify(data)
      console.error('PayPal create order:', msg)
      return res.status(502).json({ error: typeof msg === 'string' ? msg : 'PayPal create order failed' })
    }

    try {
      await createPendingTicketCheckout({
        provider: 'paypal',
        externalId: data.id,
        bundleId: bundle.id,
        quantity: bundle.qty,
        ticketNumbers,
        customerEmail,
        customerFullName,
      })
    } catch (pendingErr) {
      console.error('createPendingTicketCheckout (paypal):', pendingErr)
    }

    return res.status(200).json({ orderID: data.id })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'PayPal error'
    return res.status(502).json({ error: message })
  }
}
