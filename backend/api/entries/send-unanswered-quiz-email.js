import { parseJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import {
  getPendingPaidQuizForEmail,
  getPendingPaidQuizByResumeToken,
  maybeSendUnansweredQuizTicketEmail,
} from '../lib/pendingQuiz.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'

/** Send ticket email with answer link only when quiz was not completed after payment. */
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
    pathKey: 'send-unanswered-quiz-email',
    max: 8,
    windowMs: 60_000,
  })
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
    let info = null
    if (resumeToken.length >= 20) {
      info = await getPendingPaidQuizByResumeToken(resumeToken)
    } else {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
      if (!email.includes('@')) {
        return json(res, 400, { error: 'Valid email required' })
      }
      info = await getPendingPaidQuizForEmail(email)
    }

    if (!info) {
      return json(res, 404, { error: 'No matching purchase found' })
    }
    if (!info.pending || info.alreadyAnswered) {
      return json(res, 200, { ok: true, emailSent: false, skipped: true, reason: 'quiz_already_done' })
    }

    const bundle = info.bundleId ? getTicketBundleById(info.bundleId) : null
    const result = await maybeSendUnansweredQuizTicketEmail({
      ticketId: info.ticketId,
      userId: info.userId,
      to: info.customerEmail,
      customerFullName: info.customerFullName,
      orderRef: info.orderRef,
      ticketNumbers: info.ticketNumbers ?? [],
      bundleId: info.bundleId,
      quantity: info.quantity ?? bundle?.qty,
      amountPence: bundle?.totalPence,
    })

    return json(res, 200, {
      ok: true,
      emailSent: Boolean(result?.emailSent),
      skipped: Boolean(result?.skipped || !result?.emailSent),
      reason: result?.reason || result?.error || null,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not send email' })
  }
}
