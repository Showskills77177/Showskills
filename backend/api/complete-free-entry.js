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
import { validateContactPhone } from '../../shared/contactPhone.mjs'
import { sendQuizResultEmail } from './lib/sendQuizResultEmail.mjs'
import { awardConsolationShirtEntries } from './lib/awardConsolationShirtEntries.mjs'
import { assertCompetitionEntryMethod } from './lib/competitionCatalog.mjs'
import { parseCheckoutCompetition } from './lib/checkoutBundle.mjs'

/** Step 2 — submit skill answers after £0 card verification. */
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
  const competition = await parseCheckoutCompetition(body)
  const methodCheck = await assertCompetitionEntryMethod(competition, 'free_online')
  if (!methodCheck.ok) {
    return json(res, 403, { error: methodCheck.error })
  }

  const verificationId =
    (typeof body.paymentJobReference === 'string' ? body.paymentJobReference.trim() : '') ||
    (typeof body.setupIntentId === 'string' ? body.setupIntentId.trim() : '')
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  const addr = parsePostalAddress(body)

  if (!verificationId) {
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
    competition,
  })
  if (!limits.ok) {
    return json(res, 403, { error: limits.error, code: limits.code })
  }

  try {
    await ensureFreeEntrySchema()
    const pending = await query(
      `SELECT setup_intent_id, completed_at, ip_address FROM free_online_pending WHERE setup_intent_id = $1`,
      [verificationId],
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
      verificationId,
      customerEmail: email,
      customerFullName: fullName,
      customerPhone: phoneCheck.phone,
      address: addr,
      nameAddressKey: limits.nameAddressKey,
      ipAddress: pending.rows[0].ip_address || limits.ip,
      answers,
      competition,
    })

    if (!recorded.ok) {
      return json(res, 500, { error: recorded.error || 'Could not save entry' })
    }

    await query(`UPDATE free_online_pending SET completed_at = $2 WHERE setup_intent_id = $1`, [
      verificationId,
      new Date().toISOString(),
    ])

    let consolationShirtEntries = 0
    let consolationShirtEntryNumbers = []
    if (!recorded.duplicate && !recorded.allCorrect && recorded.entryId) {
      const consolation = await awardConsolationShirtEntries({
        req,
        fullName,
        email,
        competitionEntryId: recorded.entryId,
        source: 'free',
        amountPence: 0,
        orderRef: recorded.orderRef,
      })
      if (consolation.awarded) {
        consolationShirtEntries = consolation.entryCount
        consolationShirtEntryNumbers = consolation.entryNumbers ?? []
      }
    }

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
        consolationShirtEntries,
        consolationShirtEntryNumbers,
      })
      quizEmailSent = Boolean(emailResult?.ok)
    }

    await logEntryAttempt(req, {
      competition,
      flow: 'legacy_free_online',
      fullName,
      email,
      addressKey: limits.nameAddressKey,
      outcome: 'success',
      metadata: {
        payment_job_reference: verificationId,
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
      consolationShirtEntries,
      consolationShirtEntryNumbers,
      message: recorded.allCorrect
        ? 'Free entry complete — you qualify for the draw. Your ticket number is in your email.'
        : consolationShirtEntries
          ? `Free entry saved — you did not qualify for the Signed Football Legend Bundle draw, but you received ${consolationShirtEntries} automatic entries into the separate Free Ronaldo Shirt Giveaway.`
          : 'Free entry saved — your skill answers did not all qualify for the draw.',
    })
  } catch (e) {
    console.error(e)
    await logEntryAttempt(req, {
      competition,
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
