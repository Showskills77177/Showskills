import { json } from './lib/http.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  ensureCompetitionCatalogSchema,
  getFeaturedHomepageCompetition,
  getPublicCompetitionDetail,
  listPublishedMainDrawCompetitions,
} from './lib/competitionCatalog.mjs'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

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
    return json(res, 200, { ok: true, competitions: [] })
  }

  try {
    await ensureCompetitionCatalogSchema()
    const url = new URL(req.url || '/', 'http://local')
    const slug = (url.searchParams.get('slug') || '').trim()
    const featured = (url.searchParams.get('featured') || '').trim()
    const siteOrigin = siteOriginFromReq(req)

    if (featured === 'homepage') {
      const competition = await getFeaturedHomepageCompetition({ siteOrigin })
      if (!competition) return json(res, 200, { ok: true, competition: null })
      return json(res, 200, { ok: true, competition })
    }

    if (slug) {
      const detail = await getPublicCompetitionDetail(slug, { siteOrigin })
      if (!detail) return json(res, 404, { error: 'Competition not found or not published.' })
      return json(res, 200, { ok: true, competition: detail })
    }

    const competitions = await listPublishedMainDrawCompetitions({ siteOrigin })
    return json(res, 200, { ok: true, competitions, featuredSlug: DRAW_COMPETITION_SLUG })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not load competitions.' })
  }
}
