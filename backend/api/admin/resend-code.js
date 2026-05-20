import {
  signAdminSmsPending,
  setAdminSmsPendingCookieHeader,
  getAdminSmsPendingFromReq,
  verifyAdminSmsPending,
  clearAdminSmsPendingCookieHeader,
  isAdminAuthConfigured,
} from '../lib/adminAuth.mjs'
import {
  sendAdminLoginOtpEmail,
  isAdminEmailOtpConfigured,
  getAdminEmailSetupHint,
  adminOtpVerificationPayload,
} from '../lib/adminEmailOtp.mjs'
import { json } from '../lib/http.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

/** Resend admin email OTP while password step cookie is still valid (no password re-entry). */
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

  const limited = applyRateLimit(req, res, {
    pathKey: 'admin-resend-code',
    max: 5,
    windowMs: 900_000,
  })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many code requests. Wait a few minutes and try again.' })
  }

  if (!isAdminAuthConfigured() || !isAdminEmailOtpConfigured()) {
    return json(res, 503, { error: 'Admin email verification is not configured.' })
  }

  const hint = getAdminEmailSetupHint()
  if (hint) {
    return json(res, 503, { error: hint })
  }

  const pending = getAdminSmsPendingFromReq(req)
  const payload = await verifyAdminSmsPending(pending)
  if (!payload) {
    res.setHeader('Set-Cookie', clearAdminSmsPendingCookieHeader())
    return json(res, 401, {
      error: 'Session expired. Sign in with password again to request a new code.',
    })
  }

  try {
    const sent = await sendAdminLoginOtpEmail()
    const token = await signAdminSmsPending(sent.codeHash)
    res.setHeader('Set-Cookie', setAdminSmsPendingCookieHeader(token))
    return json(res, 200, {
      ...adminOtpVerificationPayload(sent),
      resent: true,
      message: 'A new sign-in code has been sent.',
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not resend code'
    return json(res, 500, { error: msg })
  }
}
