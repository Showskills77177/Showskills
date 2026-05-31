import {
  signAdminResetPending,
  setAdminResetPendingCookieHeader,
  isAdminAuthConfigured,
} from '../lib/adminAuth.mjs'
import {
  sendAdminPasswordResetOtpEmail,
  isAdminEmailOtpConfigured,
  getAdminEmailSetupHint,
  adminOtpVerificationPayload,
  matchesAdminLoginIdentity,
} from '../lib/adminEmailOtp.mjs'
import { isDbConfigured } from '../lib/db.mjs'
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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-forgot-password', max: 5, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many reset requests. Try again later.' })
  }

  if (!isAdminAuthConfigured()) {
    return json(res, 503, { error: 'Admin auth is not configured on the server.' })
  }
  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured — password reset unavailable.' })
  }
  if (!isAdminEmailOtpConfigured()) {
    return json(res, 503, {
      error:
        'Password reset requires email. Set RESEND_API_KEY and ADMIN_EMAIL on the server, then redeploy. Locally, edit ADMIN_PASSWORD in .env.local instead.',
    })
  }

  const hint = getAdminEmailSetupHint()
  if (hint) {
    return json(res, 503, { error: hint })
  }

  const body = await readJsonBody(req)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!matchesAdminLoginIdentity(username)) {
    return json(res, 401, {
      error:
        'Unknown admin username. Use your admin username (set in Vercel as ADMIN_USER — often "admin"), not your personal email unless that is ADMIN_EMAIL.',
    })
  }

  try {
    const sent = await sendAdminPasswordResetOtpEmail()
    const pending = await signAdminResetPending(sent.codeHash)
    res.setHeader('Set-Cookie', setAdminResetPendingCookieHeader(pending))
    return json(res, 200, {
      ...adminOtpVerificationPayload(sent, { purpose: 'reset' }),
      message: 'Reset code sent. Enter it below with your new password.',
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not send reset code'
    return json(res, 500, { error: msg })
  }
}
