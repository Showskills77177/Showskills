import {
  signAdminResetPending,
  setAdminResetPendingCookieHeader,
  getAdminResetPendingFromReq,
  verifyAdminResetPending,
  clearAdminResetPendingCookieHeader,
  isAdminAuthConfigured,
} from '../lib/adminAuth.mjs'
import {
  sendAdminPasswordResetOtpEmail,
  isAdminEmailOtpConfigured,
  getAdminEmailSetupHint,
  adminOtpVerificationPayload,
} from '../lib/adminEmailOtp.mjs'
import { json } from '../lib/http.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

/** Resend password-reset OTP while reset cookie is still valid. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-resend-reset', max: 5, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many code requests. Wait a few minutes and try again.' })
  }

  if (!isAdminAuthConfigured() || !isAdminEmailOtpConfigured()) {
    return json(res, 503, { error: 'Password reset is not configured on this server.' })
  }

  const hint = getAdminEmailSetupHint()
  if (hint) {
    return json(res, 503, { error: hint })
  }

  const pending = getAdminResetPendingFromReq(req)
  const payload = await verifyAdminResetPending(pending)
  if (!payload) {
    res.setHeader('Set-Cookie', clearAdminResetPendingCookieHeader())
    return json(res, 401, { error: 'Reset session expired. Start again from Forgot password.' })
  }

  try {
    const sent = await sendAdminPasswordResetOtpEmail()
    const token = await signAdminResetPending(sent.codeHash)
    res.setHeader('Set-Cookie', setAdminResetPendingCookieHeader(token))
    return json(res, 200, {
      ...adminOtpVerificationPayload(sent, { purpose: 'reset' }),
      resent: true,
      message: 'A new reset code has been sent.',
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not resend reset code'
    return json(res, 500, { error: msg })
  }
}
