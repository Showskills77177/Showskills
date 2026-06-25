import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import { adminListMeta } from '../lib/adminPagination.mjs'
import { loadAdminSiteVisitsReport } from '../lib/adminSiteVisits.mjs'

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

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (!isDbConfigured()) {
    return json(res, 200, {
      period: '30d',
      summary: { pageViews: 0, uniqueSessions: 0, countriesReached: 0 },
      visitsByCountry: [],
      topPaths: [],
      topSources: [],
      rows: [],
      ...adminListMeta(0, 1, 40),
    })
  }

  try {
    const url = new URL(req.url || '/', 'http://local')
    const period = url.searchParams.get('period') || '30d'
    const countryCode = url.searchParams.get('country') || ''
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') || '40', 10) || 40))

    const report = await loadAdminSiteVisitsReport({ period, countryCode, page, pageSize })
    return json(res, 200, {
      ...report,
      ...adminListMeta(report.total, report.page, report.pageSize),
    })
  } catch (e) {
    console.error('[admin/site-visits]', e)
    return json(res, 500, { error: 'Database error' })
  }
}
