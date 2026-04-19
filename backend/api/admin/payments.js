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
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)))
    const r = await query(
      `SELECT p.*, u.email, u.full_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT ${limit}`,
    )
    return json(res, 200, { rows: r.rows })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Database error' })
  }
}
