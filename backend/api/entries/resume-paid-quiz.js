import { parseJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { getPendingPaidQuizForEmail } from '../lib/pendingQuiz.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'

/** Look up unpaid skill quiz for an email (no login). */
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

  const limited = applyRateLimit(req, res, { pathKey: 'resume-paid-quiz', max: 20, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  if (!email.includes('@')) {
    return json(res, 400, { error: 'Valid email required' })
  }

  try {
    const info = await getPendingPaidQuizForEmail(email)
    if (!info?.pending) {
      return json(res, 200, { ok: true, pending: false })
    }
    const bundle = info.bundleId ? getTicketBundleById(info.bundleId) : null
    return json(res, 200, {
      ok: true,
      pending: true,
      orderRef: info.orderRef,
      ticketNumbers: info.ticketNumbers ?? [],
      customerEmail: info.customerEmail,
      customerFullName: info.customerFullName,
      bundleId: info.bundleId,
      bundleTitle: bundle?.title ?? info.bundleId,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not look up entry' })
  }
}
