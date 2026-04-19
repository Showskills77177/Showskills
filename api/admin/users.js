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
    const url = new URL(req.url || '/', 'http://local')
    const q = (url.searchParams.get('q') || '').trim()
    const limit = Math.min(300, Math.max(1, parseInt(url.searchParams.get('limit') || '120', 10)))
    let sql = `
      SELECT u.*,
        (SELECT COUNT(*)::int FROM competition_entries e WHERE e.user_id = u.id) AS entries_count,
        (SELECT COUNT(*)::int FROM tickets t WHERE t.user_id = u.id) AS tickets_count
      FROM users u
      WHERE 1=1`
    const params = []
    if (q) {
      params.push(`%${q}%`, `%${q}%`)
      sql += ` AND (u.email ILIKE $1 OR u.full_name ILIKE $2)`
    }
    sql += ` ORDER BY u.created_at DESC LIMIT ${limit}`
    const r = await query(sql, params)
    return json(res, 200, { rows: r.rows })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
