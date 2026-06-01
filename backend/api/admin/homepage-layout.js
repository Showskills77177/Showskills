import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import { getHomepageLayout, saveHomepageLayout } from '../lib/homepageLayout.mjs'

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
      const layout = await getHomepageLayout()
      return json(res, 200, { ok: true, layout })
    }

    if (req.method === 'PATCH') {
      const body = parseJsonBody(req)
      const layout = await saveHomepageLayout(body.layout || body)
      return json(res, 200, { ok: true, layout })
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Homepage layout update failed.' })
  }
}
