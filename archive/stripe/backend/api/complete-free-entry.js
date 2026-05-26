import { parseJsonBody, json } from './lib/http.mjs'
import { applyRateLimit } from './lib/rateLimit.mjs'
import { isDbConfigured } from './lib/db.mjs'
import {
  checkLegacyFreeNameAddressLimits,
  logEntryAttempt,
  parsePostalAddress,
} from './lib/freeEntryAbuse.mjs'
import { recordFreeOnlineEntry } from './lib/recordFreeOnlineEntry.mjs'
import { ensureFreeEntrySchema } from './lib/ensureFreeEntrySchema.mjs'
import { query } from './lib/db.mjs'
import { COMPETITION_LEGACY_BUNDLE } from '../../shared/freeEntryLimits.mjs'
import { validateContactPhone } from '../../shared/contactPhone.mjs'
import { sendQuizResultEmail } from './lib/sendQuizResultEmail.mjs'

/** Step 2 — submit skill answers after card was verified. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'complete-free-entry', max: 8, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many attempts. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const setupIntentId =
    typeof body.setupIntentId === 'string' ? body.setupIntentId.trim() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  const addr = parsePostalAddress(body)

  if (!setupIntentId.startsWith('seti_')) {
    return json(res, 400, { error: 'Invalid verification session.' })
  }
  const customerPhone =
    typeof body.phone === 'string'
      ? body.phone
      : typeof body.customerPhone === 'string'
        ? body.customerPhone
        : ''
  const phoneCheck = validateContactPhone(customerPhone)
  if (!phoneCheck.ok) {
    return json(res, 400, { error: phoneCheck.error })
  }
  if (!fullName || !email.includes('@') || !addr.ok) {
    return json(res, 400, { error: 'Missing name, email, or address.' })
  }

  const limits = await checkLegacyFreeNameAddressLimits(req, {
    fullName,
    email,
    address: addr,
  })
  if (!limits.ok) {
    return json(res, 403, { error: limits.error, code: limits.code })
  }

  try {
    await ensureFreeEntrySchema()
    const pending = await query(
      `SELECT setup_intent_id, completed_at, ip_address FROM free_online_pending WHERE setup_intent_id = $1`,
      [setupIntentId],
    )
    if (!pending.rows[0]) {
      return json(res, 400, {
        error: 'Card verification is required first. Verify your card, then answer the questions.',
      })
    }
    if (pending.rows[0].completed_at) {
      return json(res, 400, { error: 'This free entry has already been submitted.' })
    }

    const recorded = await recordFreeOnlineEntry({
      setupIntentId,
      customerEmail: email,
      customerFullName: fullName,
      customerPhone: phoneCheck.phone,
      address: addr,
      nameAddressKey: limits.nameAddressKey,
      ipAddress: pending.rows[0].ip_address || limits.ip,
      answers,
    })

    if (!recorded.ok) {
      return json(res, 500, { error: recorded.error || 'Could not save entry' })
    }

    await query(`UPDATE free_online_pending SET completed_at = $2 WHERE setup_intent_id = $1`, [
      setupIntentId,
      new Date().toISOString(),
    ])

    let quizEmailSent = false
    if (!recorded.duplicate) {
      const emailResult = await sendQuizResultEmail({
        to: email,
        customerFullName: fullName,
        allCorrect: recorded.allCorrect,
        orderRef: recorded.orderRef,
        bundleId: 'free_online',
        quantity: 1,
        amountPence: 0,
        ticketNumbers: recorded.ticketNumbers ?? [],
      })
      quizEmailSent = Boolean(emailResult?.ok)
    }

    await logEntryAttempt(req, {
      competition: COMPETITION_LEGACY_BUNDLE,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: limits.nameAddressKey,
      outcome: 'success',
      metadata: {
        setup_intent_id: setupIntentId,
        all_correct: recorded.allCorrect,
        ticket_number: recorded.ticketNumbers?.[0],
      },
    })

    return json(res, 200, {
      ok: true,
      validation: recorded.validation,
      allCorrect: recorded.allCorrect,
      orderRef: recorded.orderRef,
      ticketNumbers: recorded.ticketNumbers,
      quizEmailSent,
      message: recorded.allCorrect
        ? 'Free entry complete — you qualify for the draw. Your ticket number is in your email.'
        : 'Free entry saved — your skill answers did not all qualify for the draw.',
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
      blockReason: 'server_error',
    })
    return json(res, 500, { error: 'Could not complete your free entry. Please try again.' })
  }
}
