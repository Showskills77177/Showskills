import { json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { checkVpnForRequest } from './lib/vpnDetection.mjs'

/** GET — lets the giveaway UI warn before submit; same rules as POST /api/submissions/kickups. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'vpn-check', max: 30, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  const vpn = await checkVpnForRequest(req)
  if (!vpn.ok) {
    return json(res, 403, { ok: false, error: vpn.error, code: vpn.code })
  }
  return json(res, 200, { ok: true })
}
