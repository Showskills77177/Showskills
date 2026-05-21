import { parseJsonBody, json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { sendContactFormEmail } from './lib/sendContactEmail.mjs'
import { isValidContactTopic } from '../../shared/siteContact.mjs'

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

  const limited = applyRateLimit(req, res, {
    pathKey: 'contact-form',
    max: 6,
    windowMs: 60_000,
  })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many requests. Please wait and try again.' })
  }

  const body = parseJsonBody(req)
  if (typeof body.company === 'string' && body.company.trim()) {
    return json(res, 200, { ok: true })
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const topic = typeof body.topic === 'string' ? body.topic.trim() : 'general'
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''

  if (!name || name.length < 2) {
    return json(res, 400, { error: 'Please enter your name.' })
  }
  if (!email.includes('@') || !email.includes('.')) {
    return json(res, 400, { error: 'Please enter a valid email address.' })
  }
  if (!isValidContactTopic(topic)) {
    return json(res, 400, { error: 'Please choose a valid topic.' })
  }
  if (!message || message.length < 10) {
    return json(res, 400, { error: 'Please enter a message (at least 10 characters).' })
  }

  try {
    const result = await sendContactFormEmail({ name, email, topic, message })
    if (result.skipped) {
      return json(res, 503, {
        ok: false,
        error: 'Contact form is temporarily unavailable. Please email us directly.',
        contactEmail: 'contact@showskills.co.uk',
      })
    }
    if (!result.ok) {
      return json(res, 502, { error: result.error || 'Could not send your message. Please try again.' })
    }
    return json(res, 200, { ok: true, deliveredTo: result.deliveredTo })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not send your message. Please try again.' })
  }
}
