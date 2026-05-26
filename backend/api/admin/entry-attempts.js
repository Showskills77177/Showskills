import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import { ensureFreeEntrySchema } from '../lib/ensureFreeEntrySchema.mjs'
import { query } from '../lib/db.mjs'
import { parseAdminListQuery, adminListMeta } from '../lib/adminPagination.mjs'

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
    return json(res, 200, { rows: [], ...adminListMeta(0, 1, 40) })
  }

  try {
    await ensureFreeEntrySchema()
    const url = new URL(req.url || '/', 'http://local')
    const { page, pageSize, offset } = parseAdminListQuery(url)
    const outcome = (url.searchParams.get('outcome') || '').trim()
    const flow = (url.searchParams.get('flow') || '').trim()

    let where = 'WHERE 1=1'
    const params = []
    if (flow) {
      params.push(flow)
      where += ` AND flow = $${params.length}`
    }
    if (outcome) {
      params.push(outcome)
      where += ` AND outcome = $${params.length}`
    }

    const countRes = await query(`SELECT COUNT(*)::int AS c FROM entry_attempt_logs ${where}`, params)
    const total = Number(countRes.rows[0]?.c ?? 0)

    let sql = `
      SELECT id, competition, flow, ip_address, full_name, email, address_key,
             outcome, block_reason, metadata, created_at
      FROM entry_attempt_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`
    const r = await query(sql, params)
    return json(res, 200, { rows: r.rows, ...adminListMeta(total, page, pageSize) })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
