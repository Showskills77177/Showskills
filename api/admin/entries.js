import { requireAdmin } from '../lib/adminAuth.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'

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
    if (req.method === 'GET') return json(res, 200, { rows: [] })
    return json(res, 503, { error: 'Database not configured' })
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://local')
      const q = (url.searchParams.get('q') || '').trim()
      const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '80', 10)))
      let sql = `
        SELECT e.id, e.competition, e.entry_type, e.answers_json, e.all_correct, e.reviewed_valid, e.created_at,
               u.email, u.full_name
        FROM competition_entries e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE 1=1`
      const params = []
      if (q) {
        params.push(`%${q}%`, `%${q}%`)
        sql += ` AND (u.email ILIKE $1 OR u.full_name ILIKE $2)`
      }
      sql += ` ORDER BY e.created_at DESC LIMIT ${limit}`
      const r = await query(sql, params)
      return json(res, 200, { rows: r.rows })
    }

    if (req.method === 'PATCH') {
      const body = parseJsonBody(req)
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return json(res, 400, { error: 'id required' })
      const patches = []
      const vals = []
      let i = 1
      if (typeof body.reviewed_valid === 'boolean') {
        patches.push(`reviewed_valid = $${i++}`)
        vals.push(body.reviewed_valid)
      }
      if (typeof body.all_correct === 'boolean') {
        patches.push(`all_correct = $${i++}`)
        vals.push(body.all_correct)
      }
      if (!patches.length) return json(res, 400, { error: 'No valid fields' })
      vals.push(id)
      await query(`UPDATE competition_entries SET ${patches.join(', ')} WHERE id = $${i}`, vals)
      return json(res, 200, { ok: true })
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Server error' })
  }
}
