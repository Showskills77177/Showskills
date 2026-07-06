import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { registerUser } from '../lib/userAccounts.mjs'
import { subscribeNewsletter, sendWelcomeEmail } from '../lib/newsletter.mjs'
import { NEWSLETTER_SOURCES } from '../../../shared/newsletter.mjs'
import {
  isUserAuthConfigured,
  signUserSession,
  setUserCookieHeader,
} from '../lib/userAuth.mjs'

/** POST { email, password, fullName } — create account + newsletter subscribe. */
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
      : applyRateLimit(req, res, { pathKey: 'auth-register', max: 6, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many registration attempts. Try again later.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Registration is temporarily unavailable. Please try again later.' })
  }
  if (!isUserAuthConfigured()) {
    return json(res, 503, { error: 'Account sign-up is not configured on the server.' })
  }

  const body = await readJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''

  const result = await registerUser({ email, password, fullName })
  if (!result.ok) {
    const status = result.error?.includes('already exists') ? 409 : 400
    return json(res, status, { error: result.error })
  }

  const newsletter = await subscribeNewsletter(result.user.email, {
    source: NEWSLETTER_SOURCES.account_registration,
    resubscribe: true,
  })
  if (!newsletter.ok) {
    console.warn('[auth/register] newsletter subscribe failed:', newsletter.error)
  }

  if (
    newsletter.ok &&
    process.env.NEWSLETTER_SEND_WELCOME !== '0' &&
    newsletter.subscriber?.unsubscribeToken
  ) {
    const welcome = await sendWelcomeEmail({
      to: newsletter.email,
      unsubscribeToken: newsletter.subscriber.unsubscribeToken,
    })
    if (!welcome.ok && !welcome.skipped) {
      console.warn('[auth/register] welcome email failed:', welcome.error)
    }
  }

  const token = await signUserSession({ sub: result.user.id, email: result.user.email })
  res.setHeader('Set-Cookie', setUserCookieHeader(token))

  return json(res, 201, {
    ok: true,
    user: result.user,
    newsletterSubscribed: newsletter.ok,
    message: 'Account created. You are signed in and subscribed to ShowSkills Rewards.',
  })
}
