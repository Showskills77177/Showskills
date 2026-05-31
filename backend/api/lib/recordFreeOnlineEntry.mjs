import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, dbIsPostgres } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { ensureFreeEntrySchema } from './ensureFreeEntrySchema.mjs'
import { reserveTicketNumbers } from './ticketNumbers.mjs'
import { resolveSkillValidation } from './competitionSkillQuestions.mjs'
import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import { upsertUserContact } from './userContact.mjs'
import { getOpenCompetitionPeriodForEntry } from './competitionPeriods.mjs'
import { assertCompetitionEntryMethod } from './competitionCatalog.mjs'

/**
 * After £0 card verification succeeds: one free draw slot (ticket number), quiz entry, audit row.
 * @param {string} verificationId — Stripe setup intent id or Cashflows paymentJobReference
 */
export async function recordFreeOnlineEntry({
  verificationId,
  setupIntentId,
  customerEmail,
  customerFullName,
  customerPhone,
  address,
  nameAddressKey,
  ipAddress,
  answers,
  competition: competitionParam,
}) {
  if (!isDbConfigured()) return { ok: false, error: 'Database not configured' }

  const sessionId = (verificationId || setupIntentId || '').trim()
  if (!sessionId) return { ok: false, error: 'Missing verification session' }

  const competition = String(competitionParam || DRAW_COMPETITION_SLUG).trim()
  const methodCheck = await assertCompetitionEntryMethod(competition, 'free_online')
  if (!methodCheck.ok) return { ok: false, error: methodCheck.error }

  await ensureTicketSchema()
  await ensureFreeEntrySchema()

  const periodResult = await getOpenCompetitionPeriodForEntry(competition)
  if (!periodResult.ok) {
    return { ok: false, error: periodResult.error || 'No open competition period' }
  }

  const validation = await resolveSkillValidation(competition, answers || {})
  const allCorrect = validation.allCorrect
  if (validation.error) return { ok: false, error: validation.error }

  const dup = await query(`SELECT id FROM free_online_entries WHERE setup_intent_id = $1`, [sessionId])
  if (dup.rows[0]) {
    return { ok: true, duplicate: true, allCorrect, validation }
  }

  const userId = await upsertUserContact({
    email: customerEmail,
    fullName: customerFullName,
    phone: customerPhone,
  })
  const ticketNumbers = await reserveTicketNumbers(1)
  const ticketId = randomUUID()
  const ticketPublicId = `ORD-${randomBytes(4).toString('hex').toUpperCase()}`
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()

  await query(
    `INSERT INTO tickets (
      id, ticket_public_id, user_id, bundle_id, quantity, payment_status,
      stripe_payment_intent_id, purchased_at, period_id, competition
    ) VALUES ($1, $2, $3, 'free_online', 1, 'free_verified', $4, $5, $6, $7)`,
    [ticketId, ticketPublicId, userId, sessionId, purchasedAt, periodResult.period.id, competition],
  )

  const tnId = randomUUID()
  await query(
    `INSERT INTO ticket_numbers (id, ticket_id, ticket_number, slot_index) VALUES ($1, $2, $3, 1)`,
    [tnId, ticketId, ticketNumbers[0]],
  )

  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, 0, 'gbp', $5, 'successful', $6)`,
    [
      payId,
      sessionId.startsWith('seti_') ? `setup_${sessionId}` : `cf_free_${sessionId}`,
      userId,
      ticketId,
      sessionId.startsWith('seti_') ? 'stripe_setup' : 'cashflows',
      JSON.stringify({
        verification_id: sessionId,
        free_entry: true,
        ...(sessionId.startsWith('seti_') ? { setup_intent_id: sessionId } : { payment_job_reference: sessionId }),
      }),
    ],
  )

  const entryId = randomUUID()
  const allVal = dbIsPostgres() ? allCorrect : allCorrect ? 1 : 0
  await query(
    `INSERT INTO competition_entries (id, user_id, competition, entry_type, answers_json, all_correct)
     VALUES ($1, $2, $3, 'free', $4, $5)`,
    [entryId, userId, competition, JSON.stringify(answers), allVal],
  )

  const freeRowId = randomUUID()
  await query(
    `INSERT INTO free_online_entries (
      id, user_id, competition, name_address_key, full_name, email,
      address_line1, address_line2, city, postcode,
      setup_intent_id, ticket_id, entry_id, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      freeRowId,
      userId,
      competition,
      nameAddressKey,
      customerFullName,
      customerEmail,
      address.addressLine1,
      address.addressLine2 || null,
      address.city,
      address.postcode,
      sessionId,
      ticketId,
      entryId,
      ipAddress || null,
    ],
  )

  return {
    ok: true,
    allCorrect,
    validation,
    orderRef: ticketPublicId,
    ticketNumbers,
    ticketId,
    entryId,
  }
}
