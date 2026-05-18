import {
  signAdminSession,
  setAdminCookieHeader,
  isAdminAuthConfigured,
  adminAuthConfigStatus,
} from '../lib/adminAuth.mjs'
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
    const status = adminAuthConfigStatus()
    return json(res, 503, {
      error: 'Admin auth is not configured on the server.',
      missing: status.missing,
      hint: 'Vercel → Project → Settings → Environment Variables → enable Production → Redeploy.',
    })
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
