import { json } from './lib/http.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  ensureCompetitionCatalogSchema,
  getPublicGiveawayDetail,
  listPublishedGiveawayCompetitions,
} from './lib/competitionCatalog.mjs'

function siteOriginFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'
  return `${proto}://${host}`.replace(/\/$/, '')
}

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

  if (!isDbConfigured()) {
    return json(res, 200, { ok: true, giveaways: [] })
  }

  try {
    await ensureCompetitionCatalogSchema()
    const url = new URL(req.url || '/', 'http://local')
    const slug = (url.searchParams.get('slug') || '').trim()
    const siteOrigin = siteOriginFromReq(req)

    if (slug) {
      const detail = await getPublicGiveawayDetail(slug, { siteOrigin })
      if (!detail) return json(res, 404, { error: 'Giveaway not found or not published.' })
      return json(res, 200, { ok: true, giveaway: detail })
    }

    const giveaways = await listPublishedGiveawayCompetitions({ siteOrigin })
    return json(res, 200, { ok: true, giveaways })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not load giveaways.' })
  }
}
