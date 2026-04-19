import { signAdminSession, setAdminCookieHeader, isAdminAuthConfigured } from '../lib/adminAuth.mjs'
import { verifyAdminPassword } from '../lib/password.mjs'
import { readJsonBody, json } from '../lib/http.mjs'

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

  if (!isAdminAuthConfigured()) {
    return json(res, 503, { error: 'Admin auth is not configured (set ADMIN_USER, ADMIN_PASSWORD or ADMIN_PASSWORD_HASH, ADMIN_JWT_SECRET).' })
  }

  const body = await readJsonBody(req)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const adminUser = (process.env.ADMIN_USER || '').trim()
  if (!adminUser || username !== adminUser) {
    return json(res, 401, { error: 'Invalid credentials' })
  }
  const ok = await verifyAdminPassword(password)
  if (!ok) {
    return json(res, 401, { error: 'Invalid credentials' })
  }

  try {
    const token = await signAdminSession()
    res.setHeader('Set-Cookie', setAdminCookieHeader(token))
    return json(res, 200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not create session' })
  }
}
