import { json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import {
  isUserAuthConfigured,
  getUserResetPendingFromReq,
  verifyUserResetPending,
  clearUserResetPendingCookieHeader,
  signUserResetPending,
  setUserResetPendingCookieHeader,
} from '../lib/userAuth.mjs'
import {
  getUserPasswordResetSetupHint,
  isUserPasswordResetEmailConfigured,
  sendUserPasswordResetEmail,
  userResetVerificationPayload,
} from '../lib/userPasswordReset.mjs'
import { getUserAuthRowByEmail } from '../lib/userAccounts.mjs'

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

  const limited =
    process.env.E2E_MODE === '1'
      ? { blocked: false }
      : applyRateLimit(req, res, { pathKey: 'auth-resend-reset', max: 5, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many code requests. Wait a few minutes and try again.' })
  }

  if (!isDbConfigured() || !isUserAuthConfigured() || !isUserPasswordResetEmailConfigured()) {
    return json(res, 503, { error: 'Password reset is not configured on this server.' })
  }

  const hint = getUserPasswordResetSetupHint()
  if (hint) {
    return json(res, 503, { error: hint })
  }

  const pending = getUserResetPendingFromReq(req)
  const payload = await verifyUserResetPending(pending)
  if (!payload) {
    res.setHeader('Set-Cookie', clearUserResetPendingCookieHeader())
    return json(res, 401, { error: 'Reset session expired. Start again from Forgot password.' })
  }

  try {
    const row = await getUserAuthRowByEmail(payload.email)
    if (!row?.password_hash) {
      res.setHeader('Set-Cookie', clearUserResetPendingCookieHeader())
      return json(res, 401, { error: 'Reset session expired. Start again from Forgot password.' })
    }

    const sent = await sendUserPasswordResetEmail({
      to: row.email,
      fullName: row.full_name,
    })
    const token = await signUserResetPending({
      codeHash: sent.codeHash,
      email: row.email,
    })
    res.setHeader('Set-Cookie', setUserResetPendingCookieHeader(token))
    return json(res, 200, {
      ...userResetVerificationPayload(sent, { email: row.email }),
      resent: true,
      message: 'A new reset code has been sent.',
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not resend reset code'
    return json(res, 500, { error: msg })
  }
}
