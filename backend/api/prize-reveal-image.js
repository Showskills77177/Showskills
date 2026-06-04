import { json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  resolvePrizeRevealTicket,
  verifyPrizeRevealViewGrant,
  prizeRevealAssetBytes,
  PRIZE_REVEAL_ASSETS,
} from './lib/prizeRevealAuth.mjs'
import { PRIZE_REVEAL_ASSET_IDS } from '../../shared/prizeRevealAssets.mjs'

/** GET — stream unblurred bundle imagery; requires resume + short-lived view token. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const limited = applyRateLimit(req, res, { pathKey: 'prize-reveal-image', max: 60, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const url = new URL(req.url || '/', 'http://local')
  const resumeToken = (url.searchParams.get('token') || '').trim()
  const viewToken = (url.searchParams.get('view') || '').trim()
  const assetParam = (url.searchParams.get('asset') || 'poster').trim().toLowerCase()
  const assetId = PRIZE_REVEAL_ASSET_IDS.includes(assetParam) ? assetParam : 'poster'

  if (resumeToken.length < 20 || !viewToken) {
    return json(res, 400, { error: 'Invalid preview request' })
  }

  try {
    const ticket = await resolvePrizeRevealTicket(resumeToken)
    if (!ticket || !verifyPrizeRevealViewGrant(ticket.ticketId, viewToken)) {
      return json(res, 403, { error: 'Preview expired or not authorized' })
    }

    const meta = PRIZE_REVEAL_ASSETS[assetId]
    const bytes = prizeRevealAssetBytes(assetId)
    if (!bytes || !meta) {
      return json(res, 404, { error: 'Preview image not found' })
    }

    res.setHeader('Content-Type', meta.contentType)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('X-Prize-Reveal', 'paid-preview')
    if (typeof res.send === 'function') {
      return res.status(200).send(bytes)
    }
    res.statusCode = 200
    res.end(bytes)
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not load preview' })
  }
}
