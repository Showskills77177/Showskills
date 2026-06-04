import { json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  createShirtPrizeRevealViewGrant,
  resolveShirtPrizeRevealSubmission,
  shirtPrizeRevealJerseyReady,
  markShirtPrizeRevealViewed,
} from './lib/shirtPrizeRevealAuth.mjs'

/** POST — validate shirt giveaway preview token; return short-lived view grant. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'shirt-prize-reveal', max: 40, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const previewToken =
    typeof body.token === 'string'
      ? body.token.trim()
      : typeof body.previewToken === 'string'
        ? body.previewToken.trim()
        : ''

  try {
    const submission = await resolveShirtPrizeRevealSubmission(previewToken)
    if (!submission) {
      return json(res, 403, { error: 'This preview link is invalid or not available.' })
    }

    if (submission.alreadyViewed) {
      return json(res, 403, {
        error: 'You have already used your one-time shirt prize preview for this entry.',
      })
    }

    if (!submission.isDevPreview) {
      await markShirtPrizeRevealViewed(submission.submissionId)
    }

    const grant = createShirtPrizeRevealViewGrant(submission.submissionId)
    if (!grant) {
      return json(res, 500, { error: 'Could not start preview' })
    }

    if (!shirtPrizeRevealJerseyReady()) {
      return json(res, 503, { error: 'Shirt preview imagery is temporarily unavailable.' })
    }

    return json(res, 200, {
      ok: true,
      viewSeconds: grant.viewSeconds,
      viewToken: grant.viewToken,
      entryNumber: submission.entryNumber,
      notice:
        'One-time shirt prize preview. Sponsor, league, and signature marks remain blurred. Viewing is limited to a short timed window.',
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not authorize preview' })
  }
}
