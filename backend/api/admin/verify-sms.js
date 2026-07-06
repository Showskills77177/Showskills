import {
  signAdminSession,
  setAdminCookieHeader,
  clearAdminSmsPendingCookieHeader,
  getAdminSmsPendingFromReq,
  verifyAdminSmsPending,
  isAdminAuthConfigured,
} from '../lib/adminAuth.mjs'
import { verifyAdminOtpCode, isAdminEmailOtpConfigured } from '../lib/adminEmailOtp.mjs'
import { readJsonBody, json } from '../lib/http.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

/** Step 2 after password — verify email OTP (Resend). Route name kept for compatibility. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-verify-sms', max: 10, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' })
  }

  if (!isAdminAuthConfigured() || !isAdminEmailOtpConfigured()) {
    return json(res, 503, { error: 'Admin email verification is not configured.' })
  }

  const pending = getAdminSmsPendingFromReq(req)
  const payload = await verifyAdminSmsPending(pending)
  if (!payload) {
    res.setHeader('Set-Cookie', clearAdminSmsPendingCookieHeader())
    return json(res, 401, { error: 'Session expired. Sign in with password again.' })
  }

  const body = await readJsonBody(req)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return json(res, 400, { error: 'Enter the 6-digit code from your email.' })
  }

  const expectedHash = typeof payload.otp === 'string' ? payload.otp : ''
  if (!verifyAdminOtpCode(code, expectedHash)) {
    return json(res, 401, { error: 'Invalid or expired code. Sign in again to receive a new code.' })
  }

  try {
    const token = await signAdminSession()
    res.setHeader('Set-Cookie', setAdminCookieHeader(token))
    if (typeof res.appendHeader === 'function') {
      res.appendHeader('Set-Cookie', clearAdminSmsPendingCookieHeader())
    } else {
      res.setHeader('Set-Cookie', [setAdminCookieHeader(token), clearAdminSmsPendingCookieHeader()])
    }
    return json(res, 200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not create session' })
  }
}
