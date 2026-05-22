import { randomBytes, randomUUID } from 'node:crypto'
import { query, isDbConfigured, isUniqueViolation, dbIsPostgres } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { ensureFreeEntrySchema } from './ensureFreeEntrySchema.mjs'
import { reserveTicketNumbers } from './ticketNumbers.mjs'
import { validatePaidSkillAnswers } from '../../../shared/paidSkillQuestions.mjs'
import { COMPETITION_LEGACY_BUNDLE } from '../../../shared/freeEntryLimits.mjs'

async function upsertUserSimple(email, fullName) {
  const newUserId = randomUUID()
  try {
    await query(`INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) RETURNING id`, [
      newUserId,
      email,
      fullName,
    ])
    return newUserId
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const u = await query(`SELECT id FROM users WHERE lower(email) = $1`, [email])
    const userId = u.rows[0].id
    await query(`UPDATE users SET full_name = $2 WHERE id = $1`, [userId, fullName])
    return userId
  }
}

/**
 * After SetupIntent succeeds: one free draw slot (ticket number), quiz entry, audit row.
 */
export async function recordFreeOnlineEntry({
  setupIntentId,
  customerEmail,
  customerFullName,
  address,
  nameAddressKey,
  ipAddress,
  answers,
}) {
  if (!isDbConfigured()) return { ok: false, error: 'Database not configured' }

  await ensureTicketSchema()
  await ensureFreeEntrySchema()

  const validation = validatePaidSkillAnswers(answers?.q1, answers?.q2, answers?.q3)
  const allCorrect = validation.allCorrect

  const dup = await query(`SELECT id FROM free_online_entries WHERE setup_intent_id = $1`, [setupIntentId])
  if (dup.rows[0]) {
    return { ok: true, duplicate: true, allCorrect, validation }
  }

  const userId = await upsertUserSimple(customerEmail, customerFullName)
  const ticketNumbers = await reserveTicketNumbers(1)
  const ticketId = randomUUID()
  const ticketPublicId = `ORD-${randomBytes(4).toString('hex').toUpperCase()}`
  const payId = randomUUID()
  const purchasedAt = new Date().toISOString()

  await query(
    `INSERT INTO tickets (
      id, ticket_public_id, user_id, bundle_id, quantity, payment_status,
      stripe_payment_intent_id, purchased_at
    ) VALUES ($1, $2, $3, 'free_online', 1, 'free_verified', $4, $5)`,
    [ticketId, ticketPublicId, userId, setupIntentId, purchasedAt],
  )

  const tnId = randomUUID()
  await query(
    `INSERT INTO ticket_numbers (id, ticket_id, ticket_number, slot_index) VALUES ($1, $2, $3, 1)`,
    [tnId, ticketId, ticketNumbers[0]],
  )

  await query(
    `INSERT INTO payments (id, transaction_id, user_id, ticket_id, amount_pence, currency, provider, status, raw_metadata)
     VALUES ($1, $2, $3, $4, 0, 'gbp', 'stripe_setup', 'successful', $5)`,
    [
      payId,
      `setup_${setupIntentId}`,
      userId,
      ticketId,
      JSON.stringify({ setup_intent_id: setupIntentId, free_entry: true }),
    ],
  )

  const entryId = randomUUID()
  const allVal = dbIsPostgres() ? allCorrect : allCorrect ? 1 : 0
  await query(
    `INSERT INTO competition_entries (id, user_id, competition, entry_type, answers_json, all_correct)
     VALUES ($1, $2, $3, 'free', $4, $5)`,
    [entryId, userId, COMPETITION_LEGACY_BUNDLE, JSON.stringify(answers), allVal],
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
      COMPETITION_LEGACY_BUNDLE,
      nameAddressKey,
      customerFullName,
      customerEmail,
      address.addressLine1,
      address.addressLine2 || null,
      address.city,
      address.postcode,
      setupIntentId,
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
