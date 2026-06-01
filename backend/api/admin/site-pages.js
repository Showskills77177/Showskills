import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import {
  getAllSitePageLayouts,
  saveSitePageLayout,
} from '../lib/siteLayoutStore.mjs'
import { EDITABLE_PAGE_IDS } from '../../../shared/sitePageLayout.mjs'

const ALLOWED_PAGE_IDS = new Set(['homepage', ...EDITABLE_PAGE_IDS])

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  try {
    if (req.method === 'GET') {
      const pages = await getAllSitePageLayouts()
      return json(res, 200, { ok: true, pages })
    }

    if (req.method === 'PATCH') {
      const body = parseJsonBody(req)
      const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : ''
      if (!ALLOWED_PAGE_IDS.has(pageId)) {
        return json(res, 400, { error: 'Invalid pageId' })
      }
      const layout = body.layout ?? body
      const saved = await saveSitePageLayout(pageId, layout)
      return json(res, 200, { ok: true, pageId, layout: saved })
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    const detail = e instanceof Error ? e.message : String(e)
    return json(res, 500, {
      error: 'Site pages update failed.',
      ...(process.env.NODE_ENV !== 'production' ? { detail } : {}),
    })
  }
}
