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
import {
  adminResetSecretConfigured,
  verifyAdminResetSecretAnswer,
} from '../lib/adminResetSecret.mjs'
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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-forgot-password', max: 12, windowMs: 900_000 })
  if (limited.blocked) {
    const mins = Math.max(1, Math.ceil((limited.retryAfterSec || 900) / 60))
    return json(res, 429, {
      error: `Too many reset requests. Wait about ${mins} minute(s), then try Forgot password again.`,
      retryAfterSec: limited.retryAfterSec,
    })
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
  if (!adminResetSecretConfigured()) {
    return json(res, 503, {
      error:
        'Password reset secret is not configured. Set ADMIN_RESET_SECRET_ANSWER on the server (Production), then redeploy.',
    })
  }

  const hint = getAdminEmailSetupHint()
  if (hint) {
    return json(res, 503, { error: hint })
  }

  const body = await readJsonBody(req)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const secretAnswer = typeof body.secretAnswer === 'string' ? body.secretAnswer : ''
  if (!matchesAdminLoginIdentity(username)) {
    return json(res, 401, {
      error: 'Unknown admin username. Contact the site owner if you need the username.',
    })
  }
  if (!verifyAdminResetSecretAnswer(secretAnswer)) {
    return json(res, 401, { error: 'Incorrect answer to the security question.' })
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
