import { randomBytes } from 'node:crypto'
import { query } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'

/** Stable secret link for one paid ticket until skill answers are submitted. */
export async function ensureQuizResumeToken(ticketId) {
  if (!ticketId) return null
  await ensureTicketSchema()

  const existing = await query(`SELECT quiz_resume_token FROM tickets WHERE id = $1`, [ticketId])
  const current = existing.rows[0]?.quiz_resume_token
  if (typeof current === 'string' && current.length >= 20) return current

  const token = randomBytes(24).toString('base64url')
  await query(`UPDATE tickets SET quiz_resume_token = $2 WHERE id = $1`, [ticketId, token])
  return token
}
