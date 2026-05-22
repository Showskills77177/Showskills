import Stripe from 'stripe'
import { parseJsonBody, json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured } from './lib/db.mjs'
import { randomUUID } from 'node:crypto'
import {
  checkLegacyFreeIpLimits,
  logEntryAttempt,
  parsePostalAddress,
  clientIp,
} from './lib/freeEntryAbuse.mjs'
import { ensureFreeEntrySchema } from './lib/ensureFreeEntrySchema.mjs'
import { query } from './lib/db.mjs'
import { COMPETITION_LEGACY_BUNDLE } from '../../shared/freeEntryLimits.mjs'

/** Step 1 after Stripe SetupIntent succeeds — card verified; quiz comes next on the client. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'confirm-free-verification', max: 8, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Please wait and try again.' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return json(res, 503, { error: 'Card verification is not available right now.' })
  }
  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const setupIntentId =
    typeof body.setupIntentId === 'string' ? body.setupIntentId.trim() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const addr = parsePostalAddress(body)

  if (!setupIntentId.startsWith('seti_')) {
    return json(res, 400, { error: 'Invalid verification session.' })
  }
  if (!fullName || !email.includes('@') || !addr.ok) {
    return json(res, 400, { error: 'Missing name, email, or address.' })
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
    const intent = await stripe.setupIntents.retrieve(setupIntentId)
    if (intent.status !== 'succeeded') {
      return json(res, 400, {
        error: 'Card verification was not completed. Please verify your card and try again.',
      })
    }
    if (intent.metadata?.flow !== 'legacy_free_online') {
      return json(res, 400, { error: 'Invalid verification session.' })
    }

    await ensureFreeEntrySchema()
    const ip = clientIp(req)
    const verifiedAt = new Date().toISOString()

    const existing = await query(
      `SELECT setup_intent_id, completed_at FROM free_online_pending WHERE setup_intent_id = $1`,
      [setupIntentId],
    )
    if (!existing.rows[0]) {
      await query(
        `INSERT INTO free_online_pending (
          id, setup_intent_id, name_address_key, full_name, email,
          address_line1, address_line2, city, postcode, ip_address, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          randomUUID(),
          setupIntentId,
          limits.nameAddressKey,
          fullName,
          email,
          addr.addressLine1,
          addr.addressLine2 || null,
          addr.city,
          addr.postcode,
          ip,
          verifiedAt,
        ],
      )
    } else if (existing.rows[0].completed_at) {
      return json(res, 400, { error: 'This verification has already been used for an entry.' })
    }

    try {
      await query(
        `INSERT INTO stripe_card_verifications (id, competition, ip_address, setup_intent_id, email, name_address_key)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), COMPETITION_LEGACY_BUNDLE, ip, setupIntentId, email, limits.nameAddressKey],
      )
    } catch (err) {
      if (!String(err?.message || '').includes('UNIQUE') && err?.code !== '23505') throw err
    }

    await logEntryAttempt(req, {
      competition: COMPETITION_LEGACY_BUNDLE,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: limits.nameAddressKey,
      outcome: 'verified',
      metadata: { setup_intent_id: setupIntentId },
    })

    return json(res, 200, {
      ok: true,
      verified: true,
      setupIntentId,
      message: 'Card verified. Now answer the three skill questions below.',
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not confirm card verification.' })
  }
}
