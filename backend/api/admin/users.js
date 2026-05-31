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
    const { q, page, pageSize, offset, competition } = parseAdminListQuery(url, {
      competitionKind: 'mainDraw',
    })

    let where = 'WHERE 1=1'
    const params = []
    let compIdx = 0
    if (competition) {
      params.push(competition)
      compIdx = params.length
      where += ` AND (
        EXISTS (
          SELECT 1 FROM tickets t
          WHERE t.user_id = u.id
            AND COALESCE(t.competition, 'ronaldo_legacy_bundle') = $${compIdx}
        )
        OR EXISTS (
          SELECT 1 FROM competition_entries e
          WHERE e.user_id = u.id AND e.competition = $${compIdx}
        )
      )`
    }
    if (q) {
      params.push(`%${q}%`, `%${q}%`)
      where += ` AND (u.email ILIKE $${params.length - 1} OR u.full_name ILIKE $${params.length})`
    }

    const countSql = `SELECT COUNT(*)::int AS c FROM users u ${where}`
    const countRes = await query(countSql, params)
    const total = Number(countRes.rows[0]?.c ?? 0)

    const entriesCountSql = competition
      ? `(SELECT COUNT(*)::int FROM competition_entries e WHERE e.user_id = u.id AND e.competition = $${compIdx})`
      : `(SELECT COUNT(*)::int FROM competition_entries e WHERE e.user_id = u.id)`
    const ticketsCountSql = competition
      ? `(SELECT COUNT(*)::int FROM tickets t WHERE t.user_id = u.id AND COALESCE(t.competition, 'ronaldo_legacy_bundle') = $${compIdx})`
      : `(SELECT COUNT(*)::int FROM tickets t WHERE t.user_id = u.id)`

    const sql = `
      SELECT u.*,
        ${entriesCountSql} AS entries_count,
        ${ticketsCountSql} AS tickets_count
      FROM users u
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`
    const r = await query(sql, params)
    return json(res, 200, { rows: r.rows, competition: competition || null, ...adminListMeta(total, page, pageSize) })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
