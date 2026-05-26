import { requireAdmin } from '../lib/adminAuth.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
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
    return json(res, 200, { rows: [], ...adminListMeta(0, 1, 50) })
  }

  try {
    const url = new URL(req.url || '/', 'http://local')
    const { q, page, pageSize, offset } = parseAdminListQuery(url)

    let where = 'WHERE 1=1'
    const params = []
    if (q) {
      params.push(`%${q}%`, `%${q}%`)
      where += ` AND (u.email ILIKE $1 OR u.full_name ILIKE $2)`
    }

    const countSql = `SELECT COUNT(*)::int AS c FROM users u ${where}`
    const countRes = await query(countSql, params)
    const total = Number(countRes.rows[0]?.c ?? 0)

    let sql = `
      SELECT u.*,
        (SELECT COUNT(*)::int FROM competition_entries e WHERE e.user_id = u.id) AS entries_count,
        (SELECT COUNT(*)::int FROM tickets t WHERE t.user_id = u.id) AS tickets_count
      FROM users u
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`
    const r = await query(sql, params)
    return json(res, 200, { rows: r.rows, ...adminListMeta(total, page, pageSize) })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
