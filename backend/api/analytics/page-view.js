import { recordPageView } from '../lib/recordPageView.mjs'
import { json, readJsonBody } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'

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

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Analytics unavailable' })
  }

  try {
    const body = await readJsonBody(req)
    const result = await recordPageView(req, body)
    return json(res, 200, result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Invalid analytics')) {
      return json(res, 400, { error: msg })
    }
    console.error('[analytics/page-view]', e)
    return json(res, 500, { error: 'Could not record visit' })
  }
}
