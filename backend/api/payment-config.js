import { getCashflowsConfig } from './lib/cashflows.mjs'
import { getOpenCompetitionPeriodForEntry } from './lib/competitionPeriods.mjs'
import { json } from './lib/http.mjs'

/** GET — tells the frontend which payment backends are configured (no secrets). */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const cfg = getCashflowsConfig()
  const entry = await getOpenCompetitionPeriodForEntry()
  const googlePayMerchantId = (
    process.env.CASHFLOWS_GOOGLE_PAY_MERCHANT_ID ||
    process.env.GOOGLE_PAY_MERCHANT_ID ||
    ''
  ).trim()

  return json(res, 200, {
    cashflows: cfg.configured,
    cashflowsIntegration: cfg.isIntegration,
    /** Embedded checkout supports Google Pay (not Samsung Pay — separate Cashflows + Samsung integration). */
    googlePay: cfg.configured,
    googlePayMerchantId: googlePayMerchantId || null,
    paypal: Boolean((process.env.PAYPAL_CLIENT_ID || '').trim()),
    entriesOpen: entry.ok,
    ...(entry.ok ? {} : { entriesClosedMessage: entry.error }),
  })
}
