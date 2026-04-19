import { requireAdmin } from '../lib/adminAuth.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'

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
    const pathAndQuery = req.originalUrl || req.url || '/'
    const url = new URL(pathAndQuery, 'http://local')
    const q = (url.searchParams.get('q') || '').trim()
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
    let sql = `
      SELECT t.*, u.email, u.full_name
      FROM tickets t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE 1=1`
    const params = []
    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
      sql += ` AND (t.ticket_public_id ILIKE $1 OR u.email ILIKE $2 OR u.full_name ILIKE $3)`
    }
    sql += ` ORDER BY t.created_at DESC LIMIT ${limit}`
    const r = await query(sql, params)
    return json(res, 200, { rows: r.rows })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
