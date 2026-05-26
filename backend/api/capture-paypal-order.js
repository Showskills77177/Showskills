import { getPayPalCredentials, paypalAccessToken } from './lib/paypal.js'
import { recordPayPalCapture } from './lib/recordSale.mjs'
import { isDbConfigured, query } from './lib/db.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { assertPayPalCaptureMatchesBundle } from './lib/paymentSecurity.mjs'

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

  const limited = applyRateLimit(req, res, { pathKey: 'capture-paypal-order', max: 20, windowMs: 60_000 })
  if (limited.blocked) {
    return res.status(429).json({ error: 'Too many requests. Please wait and try again.' })
  }

  const creds = getPayPalCredentials()
  if (!creds) {
    return res.status(503).json({ error: 'PayPal is not configured on the server.' })
  }

  const body = parseBody(req)
  const orderID = typeof body.orderID === 'string' ? body.orderID.trim() : ''
  if (!orderID || orderID.length < 8 || orderID.length > 64) {
    return res.status(400).json({ error: 'orderID is required' })
  }

  try {
    const token = await paypalAccessToken(creds)
    const capRes = await fetch(`${creds.apiBase}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await capRes.json().catch(() => ({}))
    if (!capRes.ok) {
      const msg = data.message || data.error || JSON.stringify(data)
      console.error('PayPal capture:', msg)
      return res.status(502).json({ error: typeof msg === 'string' ? msg : 'PayPal capture failed' })
    }

    const status = data.status
    if (status !== 'COMPLETED') {
      return res.status(409).json({ error: `Unexpected order status: ${status || 'unknown'}` })
    }

    if (isDbConfigured()) {
      const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : ''
      const customerFullName = typeof body.customerFullName === 'string' ? body.customerFullName.trim() : ''
      const customerPhone =
        typeof body.customerPhone === 'string'
          ? body.customerPhone
          : typeof body.phone === 'string'
            ? body.phone
            : ''
      const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : ''
      const qty = Math.max(1, parseInt(body.ticketQuantity, 10) || 1)
      if (customerEmail.includes('@')) {
        try {
          const bundleCheck = assertPayPalCaptureMatchesBundle(data, bundleId, qty)
          if (!bundleCheck.ok) {
            return res.status(400).json({ error: bundleCheck.error })
          }
          const ticketMeta = await query(`SELECT period_id FROM tickets WHERE paypal_order_id = $1`, [data.id])
          const recorded = await recordPayPalCapture({
            paypalOrderId: data.id,
            customerEmail,
            customerFullName,
            customerPhone,
            periodId: ticketMeta.rows[0]?.period_id || null,
            bundleId: bundleCheck.bundle.id,
            quantity: bundleCheck.bundle.qty,
            amountPence: bundleCheck.amountPence,
            currency: bundleCheck.currency,
          })
          if (recorded) {
            return res.status(200).json({
              status: 'COMPLETED',
              orderID: data.id,
              orderRef: recorded.ticketPublicId,
              ticketNumbers: recorded.ticketNumbers || [],
              emailSent: Boolean(recorded.emailSent),
              deduped: Boolean(recorded.deduped),
            })
          }
        } catch (dbErr) {
          console.error('PayPal DB record:', dbErr)
        }
      }
    }

    return res.status(200).json({ status: 'COMPLETED', orderID: data.id })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'PayPal error'
    return res.status(502).json({ error: message })
  }
}
