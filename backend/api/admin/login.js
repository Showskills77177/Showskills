import {
  signAdminSession,
  setAdminCookieHeader,
  signAdminSmsPending,
  setAdminSmsPendingCookieHeader,
  isAdminAuthConfigured,
  adminAuthConfigStatus,
} from '../lib/adminAuth.mjs'
import { verifyAdminPassword } from '../lib/password.mjs'
import { sendAdminLoginOtpEmail, isAdminEmailOtpConfigured, maskAdminEmail } from '../lib/adminEmailOtp.mjs'
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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-login', max: 8, windowMs: 900_000 })
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
    if (isAdminEmailOtpConfigured()) {
      const { codeHash } = await sendAdminLoginOtpEmail()
      const pending = await signAdminSmsPending(codeHash)
      res.setHeader('Set-Cookie', setAdminSmsPendingCookieHeader(pending))
      return json(res, 200, {
        ok: true,
        verificationRequired: true,
        channel: 'email',
        maskedDestination: maskAdminEmail(),
      })
    }

    const token = await signAdminSession()
    res.setHeader('Set-Cookie', setAdminCookieHeader(token))
    return json(res, 200, { ok: true, verificationRequired: false })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Could not complete sign in'
    return json(res, 500, { error: msg })
  }
}
