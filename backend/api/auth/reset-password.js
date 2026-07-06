import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import {
  isUserAuthConfigured,
  getUserResetPendingFromReq,
  verifyUserResetPending,
  clearUserResetPendingCookieHeader,
} from '../lib/userAuth.mjs'
import { completeUserPasswordReset } from '../lib/userPasswordReset.mjs'

/** POST { code, newPassword, confirmPassword } */
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
      : applyRateLimit(req, res, { pathKey: 'auth-reset-password', max: 8, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' })
  }

  if (!isDbConfigured() || !isUserAuthConfigured()) {
    return json(res, 503, { error: 'Password reset is not configured on this server.' })
  }

  const pending = getUserResetPendingFromReq(req)
  const payload = await verifyUserResetPending(pending)
  if (!payload) {
    res.setHeader('Set-Cookie', clearUserResetPendingCookieHeader())
    return json(res, 401, { error: 'Reset session expired. Request a new code.' })
  }

  const body = await readJsonBody(req)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  const result = await completeUserPasswordReset({
    email: payload.email,
    code,
    newPassword,
    confirmPassword,
    expectedOtpHash: payload.otp,
  })

  if (!result.ok) {
    const status = result.error?.includes('Invalid or expired') ? 401 : 400
    return json(res, status, { error: result.error })
  }

  res.setHeader('Set-Cookie', clearUserResetPendingCookieHeader())
  return json(res, 200, { ok: true, message: result.message })
}
