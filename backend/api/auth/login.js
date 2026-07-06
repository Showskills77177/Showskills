import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { authenticateUser } from '../lib/userAccounts.mjs'
import {
  isUserAuthConfigured,
  signUserSession,
  setUserCookieHeader,
} from '../lib/userAuth.mjs'

/** POST { email, password } */
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
      : applyRateLimit(req, res, { pathKey: 'auth-login', max: 10, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many login attempts. Try again later.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Sign-in is temporarily unavailable. Please try again later.' })
  }
  if (!isUserAuthConfigured()) {
    return json(res, 503, { error: 'Account sign-in is not configured on the server.' })
  }

  const body = await readJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const result = await authenticateUser({ email, password })
  if (!result.ok) {
    return json(res, 401, { error: result.error })
  }

  const token = await signUserSession({ sub: result.user.id, email: result.user.email })
  res.setHeader('Set-Cookie', setUserCookieHeader(token))

  return json(res, 200, { ok: true, user: result.user })
}
