import { parseJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { getPendingPaidQuizForEmail, getPendingPaidQuizByResumeToken } from '../lib/pendingQuiz.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'

function formatResumeResponse(info) {
  if (!info) {
    return { ok: true, pending: false, alreadyAnswered: false }
  }
  const bundle = info.bundleId ? getTicketBundleById(info.bundleId) : null
  return {
    ok: true,
    pending: Boolean(info.pending),
    alreadyAnswered: Boolean(info.alreadyAnswered),
    quizResult: info.quizResult || null,
    orderRef: info.orderRef,
    ticketNumbers: info.ticketNumbers ?? [],
    customerEmail: info.customerEmail,
    customerFullName: info.customerFullName,
    bundleId: info.bundleId,
    bundleTitle: bundle?.title ?? info.bundleId,
    resumeToken: info.resumeToken || null,
    ticketId: info.ticketId || null,
  }
}

/** Look up unpaid skill quiz by email or per-ticket resume token (no login). */
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

  const limited = applyRateLimit(req, res, { pathKey: 'resume-paid-quiz', max: 30, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const resumeToken =
    typeof body.resumeToken === 'string'
      ? body.resumeToken.trim()
      : typeof body.resume === 'string'
        ? body.resume.trim()
        : ''

  try {
    if (resumeToken.length >= 20) {
      const byToken = await getPendingPaidQuizByResumeToken(resumeToken)
      if (!byToken) {
        return json(res, 404, { error: 'This link is invalid or has expired.' })
      }
      return json(res, 200, formatResumeResponse(byToken))
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
    if (!email.includes('@')) {
      return json(res, 400, { error: 'Valid email or resume link required' })
    }

    const info = await getPendingPaidQuizForEmail(email)
    return json(res, 200, formatResumeResponse(info))
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not look up entry' })
  }
}
