import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { getUserById } from '../lib/userAccounts.mjs'
import { changeUserPassword } from '../lib/userProfile.mjs'
import { getUserTokenFromReq, verifyUserSession } from '../lib/userAuth.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

/** POST { currentPassword, newPassword } */
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

  const limited =
    process.env.E2E_MODE === '1'
      ? { blocked: false }
      : applyRateLimit(req, res, { pathKey: 'auth-change-password', max: 6, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Unavailable' })
  }

  const token = getUserTokenFromReq(req)
  const payload = await verifyUserSession(token)
  if (!payload) {
    return json(res, 401, { error: 'Not signed in' })
  }

  const user = await getUserById(payload.sub)
  if (!user) {
    return json(res, 401, { error: 'Not signed in' })
  }

  const body = await readJsonBody(req)
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  const result = await changeUserPassword(user.id, { currentPassword, newPassword })
  if (!result.ok) return json(res, 400, { error: result.error })

  return json(res, 200, { ok: true, message: 'Password updated.' })
}
