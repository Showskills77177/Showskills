import { requireAdmin } from '../lib/adminAuth.mjs'
import { ensureTicketSchema } from '../lib/ensureTicketSchema.mjs'
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
    return json(res, 200, { rows: [], ...adminListMeta(0, 1, 40) })
  }

  try {
    await ensureTicketSchema()
    const pathAndQuery = req.originalUrl || req.url || '/'
    const url = new URL(pathAndQuery, 'http://local')
    const { q, page, pageSize, offset, competition } = parseAdminListQuery(url, {
      competitionKind: 'mainDraw',
    })

    let where = 'WHERE 1=1'
    const params = []
    if (competition) {
      params.push(competition)
      where += ` AND COALESCE(t.competition, 'ronaldo_legacy_bundle') = $${params.length}`
    }
    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
      where += ` AND (t.ticket_public_id ILIKE $${params.length - 2} OR u.email ILIKE $${params.length - 1} OR u.full_name ILIKE $${params.length})`
    }

    const countSql = `
      SELECT COUNT(*)::int AS c
      FROM tickets t
      LEFT JOIN users u ON u.id = t.user_id
      ${where}`
    const countRes = await query(countSql, params)
    const total = Number(countRes.rows[0]?.c ?? 0)

    let sql = `
      SELECT t.*, u.email, u.full_name,
        cp.title AS period_title
      FROM tickets t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN competition_periods cp ON cp.id = t.period_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`
    const r = await query(sql, params)
    const rows = r.rows
    if (rows.length) {
      const ids = rows.map((row) => row.id)
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
      const numRes = await query(
        `SELECT ticket_id, ticket_number, slot_index FROM ticket_numbers WHERE ticket_id IN (${placeholders}) ORDER BY slot_index ASC`,
        ids,
      )
      const byTicket = new Map()
      for (const n of numRes.rows) {
        if (!byTicket.has(n.ticket_id)) byTicket.set(n.ticket_id, [])
        byTicket.get(n.ticket_id).push(n.ticket_number)
      }
      for (const row of rows) {
        row.ticket_numbers = byTicket.get(row.id) || []
      }
    }
    return json(res, 200, { rows, competition: competition || null, ...adminListMeta(total, page, pageSize) })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
