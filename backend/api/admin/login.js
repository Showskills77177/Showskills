import {
  signAdminSession,
  setAdminCookieHeader,
  signAdminSmsPending,
  setAdminSmsPendingCookieHeader,
  isAdminAuthConfigured,
  adminAuthConfigStatus,
} from '../lib/adminAuth.mjs'
import { verifyAdminPassword } from '../lib/password.mjs'
import {
  sendAdminLoginOtpEmail,
  isAdminEmailOtpConfigured,
  isAdminEmailOtpBypassed,
  getAdminEmailSetupHint,
  adminOtpVerificationPayload,
} from '../lib/adminEmailOtp.mjs'
import { getResendApiKey } from '../lib/resendConfig.mjs'
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

  const limited =
    process.env.E2E_MODE === '1'
      ? { blocked: false }
      : applyRateLimit(req, res, { pathKey: 'admin-login', max: 8, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many login attempts. Try again later.' })
  }

  if (!isAdminAuthConfigured()) {
    const status = adminAuthConfigStatus()
    return json(res, 503, {
      error: 'Admin auth is not configured on the server.',
      missing: status.missing,
      hint: 'Vercel → Project → Settings → Environment Variables → enable Production → Redeploy.',
    })
  }

  const body = await readJsonBody(req)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const adminUser = (process.env.ADMIN_USER || '').trim()
  if (!adminUser || username !== adminUser) {
    return json(res, 401, { error: 'Invalid credentials' })
  }
  const ok = await verifyAdminPassword(password)
  if (!ok) {
    return json(res, 401, { error: 'Invalid credentials' })
  }

  try {
    if (isAdminEmailOtpBypassed()) {
      const token = await signAdminSession()
      res.setHeader('Set-Cookie', setAdminCookieHeader(token))
      return json(res, 200, { ok: true, verificationRequired: false })
    }

    if (isAdminEmailOtpConfigured()) {
      const hint = getAdminEmailSetupHint()
      if (hint) {
        return json(res, 503, { error: hint })
      }
      const sent = await sendAdminLoginOtpEmail()
      const pending = await signAdminSmsPending(sent.codeHash)
      res.setHeader('Set-Cookie', setAdminSmsPendingCookieHeader(pending))
      return json(res, 200, adminOtpVerificationPayload(sent))
    }

    const missingEmail = []
    if (!getResendApiKey()) missingEmail.push('RESEND_API_KEY')
    if (!process.env.ADMIN_EMAIL?.trim()) missingEmail.push('ADMIN_EMAIL')

    return json(res, 503, {
      error:
        'Email verification is not enabled on this server. Add RESEND_API_KEY and ADMIN_EMAIL in Vercel → Production, then redeploy.',
      missing: missingEmail,
      hint: 'After redeploy, sign in again — you should see the 6-digit code step.',
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not complete sign in'
    return json(res, 500, { error: msg })
  }
}
