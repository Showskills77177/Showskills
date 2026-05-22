import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import { ensureFreeEntrySchema } from '../lib/ensureFreeEntrySchema.mjs'
import { query } from '../lib/db.mjs'

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
    return json(res, 200, { rows: [] })
  }

  try {
    await ensureFreeEntrySchema()
    const url = new URL(req.url || '/', 'http://local')
    const outcome = (url.searchParams.get('outcome') || '').trim()
    const flow = (url.searchParams.get('flow') || '').trim()
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))

    let sql = `
      SELECT id, competition, flow, ip_address, full_name, email, address_key,
             outcome, block_reason, metadata, created_at
      FROM entry_attempt_logs
      WHERE 1=1`
    const params = []
    if (flow) {
      params.push(flow)
      sql += ` AND flow = $${params.length}`
    }
    if (outcome) {
      params.push(outcome)
      sql += ` AND outcome = $${params.length}`
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`
    const r = await query(sql, params)
    return json(res, 200, { rows: r.rows })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
