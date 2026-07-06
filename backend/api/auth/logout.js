import { json } from '../lib/http.mjs'
import { clearUserCookieHeader } from '../lib/userAuth.mjs'

/** POST — clear user session cookie. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', clearUserCookieHeader())
  return json(res, 200, { ok: true })
}
