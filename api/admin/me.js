import { requireAdmin } from '../lib/adminAuth.mjs'
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
    return json(res, 200, { ok: true, role: 'admin' })
  } catch (e) {
    const code = e.statusCode || 401
    return json(res, code, { error: 'Unauthorized' })
  }
}
