import { randomBytes, randomUUID } from 'node:crypto'
import { query, isUniqueViolation, isDbConfigured } from './db.mjs'
import { formatTicketNumber } from '../../../shared/ticketNumber.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'

function randomSerial() {
  return randomBytes(4).toString('hex').toUpperCase()
}

async function generateUniqueTicketNumber() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const num = formatTicketNumber(randomSerial())
    const exists = await query(`SELECT 1 FROM ticket_numbers WHERE ticket_number = $1 LIMIT 1`, [num])
    if (!exists.rows[0]) return num
  }
  throw new Error('Could not allocate unique ticket number')
}

/** Allocate unique ticket numbers before checkout (for Stripe/PayPal descriptions). */
export async function reserveTicketNumbers(quantity) {
  const qty = Math.max(1, Math.min(500, parseInt(String(quantity), 10) || 1))
  if (!isDbConfigured()) {
    return Array.from({ length: qty }, () => formatTicketNumber(randomSerial()))
  }
  await ensureTicketSchema()
  const numbers = []
  for (let i = 0; i < qty; i++) {
    numbers.push(await generateUniqueTicketNumber())
  }
  return numbers
}

/** Insert pre-reserved numbers (checkout pending row). Skips if rows already exist. */
export async function insertPreservedTicketNumbers(ticketId, ticketNumbers) {
  await ensureTicketSchema()
  const list = Array.isArray(ticketNumbers) ? ticketNumbers.filter(Boolean) : []
  const existing = await query(
    `SELECT ticket_number FROM ticket_numbers WHERE ticket_id = $1 ORDER BY slot_index ASC`,
    [ticketId],
  )
  if (existing.rows.length >= list.length && list.length > 0) {
    return existing.rows.map((r) => r.ticket_number)
  }

  const numbers = []
  for (let slot = 0; slot < list.length; slot++) {
    const ticketNumber = list[slot]
    const id = randomUUID()
    try {
      await query(
        `INSERT INTO ticket_numbers (id, ticket_id, ticket_number, slot_index) VALUES ($1, $2, $3, $4)`,
        [id, ticketId, ticketNumber, slot + 1],
      )
      numbers.push(ticketNumber)
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      throw new Error('Reserved ticket number already in use')
    }
  }
  return numbers
}

/** Create one row per entry slot (bundle quantity). Returns sorted ticket numbers. */
export async function insertTicketNumbers(ticketId, quantity) {
  await ensureTicketSchema()
  const qty = Math.max(1, Math.min(500, parseInt(String(quantity), 10) || 1))
  const existing = await query(
    `SELECT ticket_number FROM ticket_numbers WHERE ticket_id = $1 ORDER BY slot_index ASC`,
    [ticketId],
  )
  if (existing.rows.length >= qty) {
    return existing.rows.map((r) => r.ticket_number)
  }

  const numbers = []
  const startSlot = existing.rows.length + 1
  for (let slot = startSlot; slot <= qty; slot++) {
    let inserted = false
    for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
      const ticketNumber = await generateUniqueTicketNumber()
      const id = randomUUID()
      try {
        await query(
          `INSERT INTO ticket_numbers (id, ticket_id, ticket_number, slot_index) VALUES ($1, $2, $3, $4)`,
          [id, ticketId, ticketNumber, slot],
        )
        numbers.push(ticketNumber)
        inserted = true
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
      }
    }
    if (!inserted) throw new Error('Could not insert ticket number')
  }

  const all = await query(
    `SELECT ticket_number FROM ticket_numbers WHERE ticket_id = $1 ORDER BY slot_index ASC`,
    [ticketId],
  )
  return all.rows.map((r) => r.ticket_number)
}

export async function getTicketNumbersForPurchase(ticketId) {
  await ensureTicketSchema()
  const r = await query(
    `SELECT ticket_number FROM ticket_numbers WHERE ticket_id = $1 ORDER BY slot_index ASC`,
    [ticketId],
  )
  return r.rows.map((row) => row.ticket_number)
}

/** After payment, guarantee one ticket number per bundle slot (idempotent). */
export async function ensureTicketNumbersForPurchase(ticketId, quantity) {
  const qty = Math.max(1, Math.min(500, parseInt(String(quantity), 10) || 1))
  const existing = await getTicketNumbersForPurchase(ticketId)
  if (existing.length >= qty) return existing.slice(0, qty)
  return insertTicketNumbers(ticketId, qty)
}

/** Latest paid purchase for an email (for qualified draw confirmation email). */
export async function getLatestPaidPurchaseForEmail(email) {
  await ensureTicketSchema()
  const e = email.trim().toLowerCase()
  const u = await query(`SELECT id FROM users WHERE lower(email) = $1`, [e])
  if (!u.rows[0]) return null

  const t = await query(
    `SELECT id, ticket_public_id, bundle_id, quantity, competition
     FROM tickets
     WHERE user_id = $1 AND payment_status = 'paid'
     ORDER BY COALESCE(purchased_at, created_at) DESC
     LIMIT 1`,
    [u.rows[0].id],
  )
  const row = t.rows[0]
  if (!row) return null

  const ticketNumbers = await getTicketNumbersForPurchase(row.id)
  return {
    ticketId: row.id,
    orderRef: row.ticket_public_id,
    bundleId: row.bundle_id,
    quantity: row.quantity,
    competition: row.competition || null,
    ticketNumbers,
  }
}
