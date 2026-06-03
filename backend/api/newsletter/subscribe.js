import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { subscribeNewsletter, sendWelcomeEmail } from '../lib/newsletter.mjs'
import { NEWSLETTER_SOURCES } from '../../../shared/newsletter.mjs'

/** POST { email, source?, preferences? } — public newsletter signup. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'newsletter-subscribe', max: 8, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Newsletter signup is temporarily unavailable. Please try again later.' })
  }

  const body = await readJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const sourceRaw = typeof body.source === 'string' ? body.source.trim() : NEWSLETTER_SOURCES.footer
  const source = Object.values(NEWSLETTER_SOURCES).includes(sourceRaw) ? sourceRaw : NEWSLETTER_SOURCES.footer

  const result = await subscribeNewsletter(email, { source, preferences: body.preferences })
  if (!result.ok) return json(res, 400, { error: result.error })

  if (process.env.NEWSLETTER_SEND_WELCOME !== '0' && result.subscriber?.unsubscribeToken) {
    const welcome = await sendWelcomeEmail({
      to: result.email,
      unsubscribeToken: result.subscriber.unsubscribeToken,
    })
    if (!welcome.ok && !welcome.skipped) {
      console.warn('[newsletter] welcome email failed:', welcome.error)
    }
  }

  return json(res, 200, {
    ok: true,
    email: result.email,
    message: 'You are subscribed to ShowSkills Rewards.',
    preferencesUrl: result.preferencesUrl,
  })
}
