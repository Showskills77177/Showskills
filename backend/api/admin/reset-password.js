import {
  clearAdminResetPendingCookieHeader,
  getAdminResetPendingFromReq,
  verifyAdminResetPending,
  isAdminAuthConfigured,
} from '../lib/adminAuth.mjs'
import { verifyAdminOtpCode, isAdminEmailOtpConfigured } from '../lib/adminEmailOtp.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { hashAdminPassword } from '../lib/password.mjs'
import { setStoredAdminPasswordHash } from '../lib/adminPasswordStore.mjs'
import { readJsonBody, json } from '../lib/http.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-reset-password', max: 8, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' })
  }

  if (!isAdminAuthConfigured() || !isAdminEmailOtpConfigured()) {
    return json(res, 503, { error: 'Password reset is not configured on this server.' })
  }
  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured — password reset unavailable.' })
  }

  const pending = getAdminResetPendingFromReq(req)
  const payload = await verifyAdminResetPending(pending)
  if (!payload) {
    res.setHeader('Set-Cookie', clearAdminResetPendingCookieHeader())
    return json(res, 401, { error: 'Reset session expired. Request a new code.' })
  }

  const body = await readJsonBody(req)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!/^\d{6}$/.test(code)) {
    return json(res, 400, { error: 'Enter the 6-digit code from your email.' })
  }
  if (newPassword.length < 8) {
    return json(res, 400, { error: 'New password must be at least 8 characters.' })
  }
  if (newPassword !== confirmPassword) {
    return json(res, 400, { error: 'Passwords do not match.' })
  }

  const expectedHash = typeof payload.otp === 'string' ? payload.otp : ''
  if (!verifyAdminOtpCode(code, expectedHash)) {
    return json(res, 401, { error: 'Invalid or expired code. Request a new reset code.' })
  }

  try {
    const hash = await hashAdminPassword(newPassword)
    await setStoredAdminPasswordHash(hash)
    res.setHeader('Set-Cookie', clearAdminResetPendingCookieHeader())
    return json(res, 200, {
      ok: true,
      message: 'Password updated. Sign in with your new password.',
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not update password'
    return json(res, 500, { error: msg })
  }
}
