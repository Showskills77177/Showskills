import { randomUUID } from 'node:crypto'
import { parseJsonBody, json } from '../lib/http.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import {
  SHIRT_GIVEAWAY_QUESTION,
  isCorrectShirtGiveawayAnswer,
} from '../../../shared/shirtGiveaway.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { checkShirtGiveawayLimits, logEntryAttempt } from '../lib/freeEntryAbuse.mjs'
import { checkVpnForRequest } from '../lib/vpnDetection.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'
import { validateContactPhone } from '../../../shared/contactPhone.mjs'
import { upsertUserContact } from '../lib/userContact.mjs'
import { allocateShirtEntryNumber } from '../lib/shirtEntryNumbers.mjs'

/** Public: Ronaldo shirt giveaway submission. Also keeps legacy video-link support for old archived flows. */
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

  const limited = applyRateLimit(req, res, { pathKey: 'kickups-submit', max: 10, windowMs: 60_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many submissions. Please wait and try again.' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const videoRef = typeof body.videoUrl === 'string' ? body.videoUrl.trim().slice(0, 2000) : ''
  const videoFilename = typeof body.videoFilename === 'string' ? body.videoFilename.trim().slice(0, 500) : ''
  const qualificationAnswer =
    typeof body.qualificationAnswer === 'string' ? body.qualificationAnswer.trim().slice(0, 500) : ''

  const phone =
    typeof body.phone === 'string'
      ? body.phone
      : typeof body.customerPhone === 'string'
        ? body.customerPhone
        : ''
  const phoneCheck = validateContactPhone(phone)
  if (!phoneCheck.ok) {
    return json(res, 400, { error: phoneCheck.error })
  }
  if (!fullName || !email.includes('@')) {
    return json(res, 400, { error: 'fullName and valid email required' })
  }
  if (qualificationAnswer) {
    if (!isCorrectShirtGiveawayAnswer(qualificationAnswer)) {
      return json(res, 400, { error: 'Qualification answer is incorrect' })
    }
  } else if (!videoRef.startsWith('https://')) {
    return json(res, 400, { error: 'qualificationAnswer required' })
  }

  const vpn = await checkVpnForRequest(req)
  if (!vpn.ok) {
    await logEntryAttempt(req, {
      competition: COMPETITION_SHIRT_GIVEAWAY,
      flow: 'shirt_giveaway',
      fullName,
      email,
      outcome: 'blocked',
      blockReason: 'vpn_not_allowed',
    })
    return json(res, 403, { error: vpn.error, code: vpn.code })
  }

  const shirtLimits = await checkShirtGiveawayLimits(req, { fullName, email })
  if (!shirtLimits.ok) {
    return json(res, 403, { error: shirtLimits.error, code: shirtLimits.code })
  }

  try {
    await upsertUserContact({ email, fullName, phone: phoneCheck.phone })
    const id = randomUUID()
    const entryNumber = await allocateShirtEntryNumber()
    const storedRef = qualificationAnswer ? 'answer:ronaldo-shirt-giveaway' : videoRef
    const storedFilename = qualificationAnswer ? `Answer: ${qualificationAnswer}` : videoFilename || null
    const adminNotes = qualificationAnswer
      ? `Question: ${SHIRT_GIVEAWAY_QUESTION}\nAnswer: ${qualificationAnswer}\nEntry number: ${entryNumber}`
      : `Entry number: ${entryNumber}`
    const r = await query(
      `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename, admin_notes, entry_number, competition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, entry_number`,
      [id, fullName, email, storedRef || null, storedFilename, adminNotes, entryNumber, COMPETITION_SHIRT_GIVEAWAY],
    )
    await logEntryAttempt(req, {
      competition: COMPETITION_SHIRT_GIVEAWAY,
      flow: 'shirt_giveaway',
      fullName,
      email,
      addressKey: shirtLimits.identityKey,
      outcome: 'success',
      metadata: { submission_id: r.rows[0].id, entry_number: r.rows[0].entry_number },
    })
    return json(res, 201, { ok: true, id: r.rows[0].id, entryNumber: r.rows[0].entry_number })
  } catch (e) {
    console.error(e)
    await logEntryAttempt(req, {
      competition: COMPETITION_SHIRT_GIVEAWAY,
      flow: 'shirt_giveaway',
      fullName,
      email,
      outcome: 'failed',
      blockReason: 'db_error',
    })
    return json(res, 500, { error: 'Could not save submission' })
  }
}
