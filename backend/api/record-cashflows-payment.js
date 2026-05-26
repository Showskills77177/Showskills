import { applyRateLimit } from './lib/rateLimit.mjs'
import { recordCashflowsPaymentFromVerifiedIntent } from './lib/recordCashflowsFromIntent.mjs'
import { parseJsonBody, json } from './lib/http.mjs'
import { getCashflowsConfig } from './lib/cashflows.mjs'

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
    pathKey: 'record-cashflows-payment',
    max: 24,
    windowMs: 60_000,
  })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  if (!getCashflowsConfig().configured) {
    return json(res, 503, { error: 'Cashflows is not configured on the server.' })
  }

  const body = parseJsonBody(req)
  const paymentJobReference =
    typeof body.paymentJobReference === 'string' ? body.paymentJobReference.trim() : ''

  try {
    const result = await recordCashflowsPaymentFromVerifiedIntent({
      paymentJobReference,
      customerEmail: body.customerEmail,
      customerFullName: body.customerFullName,
      customerPhone: body.customerPhone ?? body.phone,
      bundleId: body.bundleId,
    })
    if (!result.ok) {
      return json(res, result.status, {
        error: result.error,
        paymentStatus: result.paymentStatus,
        lastPaymentStatus: result.lastPaymentStatus,
      })
    }
    return json(res, result.status, result.body)
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: e instanceof Error ? e.message : 'Cashflows error' })
  }
}
