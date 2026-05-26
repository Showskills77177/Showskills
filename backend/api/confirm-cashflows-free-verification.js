import { randomUUID } from 'node:crypto'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured, query } from './lib/db.mjs'
import {
  checkLegacyFreeIpLimits,
  clientIp,
  logEntryAttempt,
  parsePostalAddress,
} from './lib/freeEntryAbuse.mjs'
import { ensureFreeEntrySchema } from './lib/ensureFreeEntrySchema.mjs'
import { COMPETITION_LEGACY_BUNDLE } from '../../shared/freeEntryLimits.mjs'
import {
  getCashflowsConfig,
  isCashflowsPaymentSuccessful,
  parseCashflowsAmountPence,
  retrieveCashflowsPaymentIntent,
} from './lib/cashflows.mjs'
import { parseJsonBody, json } from './lib/http.mjs'

/** POST — after £0 Cashflows card authorisation succeeds; unlocks the skill quiz step. */
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
    pathKey: 'confirm-cashflows-free-verification',
    max: 8,
    windowMs: 60_000,
  })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Please wait and try again.' })
  }

  if (!getCashflowsConfig().configured) {
    return json(res, 503, { error: 'Card verification is not available right now.' })
  }
  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const paymentJobReference =
    typeof body.paymentJobReference === 'string' ? body.paymentJobReference.trim() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const addr = parsePostalAddress(body)
  const token = typeof body.token === 'string' ? body.token.trim() : ''

  if (!paymentJobReference) {
    return json(res, 400, { error: 'Invalid verification session.' })
  }
  if (!fullName || !email.includes('@') || !addr.ok) {
    return json(res, 400, { error: 'Missing name, email, or address.' })
  }

  const limits = await checkLegacyFreeIpLimits(req, { fullName, email, address: addr })
  if (!limits.ok) {
    return json(res, 403, { error: limits.error, code: limits.code })
  }

  try {
    if (!token) {
      return json(res, 400, { error: 'Missing verification token.' })
    }

    const intentData = await retrieveCashflowsPaymentIntent(token)
    if (intentData?.paymentJobReference && String(intentData.paymentJobReference) !== paymentJobReference) {
      return json(res, 400, { error: 'Verification session mismatch.' })
    }

    const intentPence = parseCashflowsAmountPence(intentData?.amountToCollect)
    if (intentPence != null && intentPence !== 0) {
      return json(res, 400, { error: 'Invalid verification amount.' })
    }

    if (!isCashflowsPaymentSuccessful(intentData)) {
      return json(res, 400, {
        error: 'Card verification was not completed. Please verify your card and try again.',
        paymentStatus: intentData?.paymentStatus,
        lastPaymentStatus: intentData?.lastPaymentStatus,
      })
    }

    await ensureFreeEntrySchema()
    const ip = clientIp(req)
    const verifiedAt = new Date().toISOString()

    const existing = await query(
      `SELECT setup_intent_id, completed_at FROM free_online_pending WHERE setup_intent_id = $1`,
      [paymentJobReference],
    )
    if (!existing.rows[0]) {
      await query(
        `INSERT INTO free_online_pending (
          id, setup_intent_id, name_address_key, full_name, email,
          address_line1, address_line2, city, postcode, ip_address, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          randomUUID(),
          paymentJobReference,
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

    await logEntryAttempt(req, {
      competition: COMPETITION_LEGACY_BUNDLE,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: limits.nameAddressKey,
      outcome: 'verified',
      metadata: { payment_job_reference: paymentJobReference },
    })

    return json(res, 200, {
      ok: true,
      verified: true,
      paymentJobReference,
      message: 'Card verified. Now answer the three skill questions below.',
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not confirm card verification.' })
  }
}
