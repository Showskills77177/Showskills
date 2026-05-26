import Stripe from 'stripe'
import { parseJsonBody, json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  checkLegacyFreeIpLimits,
  logEntryAttempt,
  parsePostalAddress,
} from './lib/freeEntryAbuse.mjs'
import { COMPETITION_LEGACY_BUNDLE } from '../../shared/freeEntryLimits.mjs'

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

  const limited = applyRateLimit(req, res, { pathKey: 'free-setup-intent', max: 8, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Please wait and try again.' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return json(res, 503, { error: 'Card verification is not available right now. Please try again later.' })
  }
  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const addr = parsePostalAddress(body)

  if (!fullName || fullName.length < 2) {
    return json(res, 400, { error: 'Please enter your full name.' })
  }
  if (!email.includes('@') || !email.includes('.')) {
    return json(res, 400, { error: 'Please enter a valid email address.' })
  }
  if (!addr.ok) {
    return json(res, 400, { error: addr.error })
  }

  const limits = await checkLegacyFreeIpLimits(req, {
    fullName,
    email,
    address: addr,
  })
  if (!limits.ok) {
    return json(res, 403, { error: limits.error, code: limits.code })
  }

  try {
    const stripe = new Stripe(secret)
    const intent = await stripe.setupIntents.create({
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      metadata: {
        flow: 'legacy_free_online',
        competition: COMPETITION_LEGACY_BUNDLE,
        email,
        name_address_key: limits.nameAddressKey.slice(0, 500),
      },
    })

    await logEntryAttempt(req, {
      competition: COMPETITION_LEGACY_BUNDLE,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: limits.nameAddressKey,
      outcome: 'setup_created',
      metadata: { setup_intent_id: intent.id },
    })

    return json(res, 200, {
      ok: true,
      clientSecret: intent.client_secret,
      setupIntentId: intent.id,
      message: 'Verify your card to complete your free entry. You will not be charged.',
    })
  } catch (e) {
    console.error(e)
    await logEntryAttempt(req, {
      competition: COMPETITION_LEGACY_BUNDLE,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: limits.nameAddressKey,
      outcome: 'failed',
      blockReason: 'stripe_error',
    })
    return json(res, 502, { error: 'Could not start card verification. Please try again.' })
  }
}
