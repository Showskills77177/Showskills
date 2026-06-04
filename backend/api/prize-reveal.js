import { json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  createPrizeRevealViewGrant,
  resolvePrizeRevealTicket,
  prizeRevealAssetsReady,
  markPrizeRevealViewed,
} from './lib/prizeRevealAuth.mjs'
import { PRIZE_REVEAL_ASSET_IDS, PRIZE_REVEAL_ASSET_LABELS } from '../../shared/prizeRevealAssets.mjs'
/** POST — validate purchaser resume token; return short-lived view grant. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'prize-reveal', max: 40, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const resumeToken =
    typeof body.token === 'string'
      ? body.token.trim()
      : typeof body.resumeToken === 'string'
        ? body.resumeToken.trim()
        : ''

  try {
    const ticket = await resolvePrizeRevealTicket(resumeToken)
    if (!ticket) {
      return json(res, 403, { error: 'This preview link is invalid or not available.' })
    }

    if (!ticket.qualified) {
      return json(res, 403, {
        error: 'Prize preview is only available when all three skill answers are correct.',
      })
    }

    if (ticket.alreadyViewed) {
      return json(res, 403, {
        error: 'You have already used your one-time prize preview for this order.',
      })
    }

    if (!ticket.isDevPreview) {
      await markPrizeRevealViewed(ticket.ticketId)
    }

    const grant = createPrizeRevealViewGrant(ticket.ticketId)
    if (!grant) {
      return json(res, 500, { error: 'Could not start preview' })
    }

    if (!prizeRevealAssetsReady()) {
      return json(res, 503, { error: 'Preview imagery is temporarily unavailable.' })
    }

    return json(res, 200, {
      ok: true,
      viewSeconds: grant.viewSeconds,
      viewToken: grant.viewToken,
      orderRef: ticket.orderRef,
      imagePath: '/api/prize-reveal/image',
      assets: PRIZE_REVEAL_ASSET_IDS.map((id) => ({
        id,
        label: PRIZE_REVEAL_ASSET_LABELS[id] || id,
      })),
      notice:
        'One-time bundle prize preview for qualified entrants. Viewing is limited to a short timed window.',
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not authorize preview' })
  }
}
