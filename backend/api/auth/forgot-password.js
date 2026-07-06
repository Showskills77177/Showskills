import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import {
  isUserAuthConfigured,
  signUserResetPending,
  setUserResetPendingCookieHeader,
} from '../lib/userAuth.mjs'
import {
  getUserPasswordResetSetupHint,
  isUserPasswordResetEmailConfigured,
  requestUserPasswordReset,
  userResetVerificationPayload,
} from '../lib/userPasswordReset.mjs'

/** POST { email } */
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
      : applyRateLimit(req, res, { pathKey: 'auth-forgot-password', max: 5, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many reset requests. Try again later.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Password reset is temporarily unavailable.' })
  }
  if (!isUserAuthConfigured()) {
    return json(res, 503, { error: 'Account sign-in is not configured on the server.' })
  }
  if (!isUserPasswordResetEmailConfigured()) {
    return json(res, 503, {
      error:
        'Password reset requires email. Set RESEND_API_KEY on the server, then redeploy.',
    })
  }

  const hint = getUserPasswordResetSetupHint()
  if (hint) {
    return json(res, 503, { error: hint })
  }

  const body = await readJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim() : ''

  try {
    const result = await requestUserPasswordReset(email)
    if (!result.ok) {
      return json(res, 400, { error: result.error })
    }

    if (result.sent && result.sentResult) {
      const pending = await signUserResetPending({
        codeHash: result.sentResult.codeHash,
        email: result.email,
      })
      res.setHeader('Set-Cookie', setUserResetPendingCookieHeader(pending))
      return json(res, 200, {
        ...userResetVerificationPayload(result.sentResult, { email: result.email }),
        message: result.message,
      })
    }

    return json(res, 200, {
      ok: true,
      verificationRequired: true,
      message: result.message,
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not send reset code'
    return json(res, 500, { error: msg })
  }
}
