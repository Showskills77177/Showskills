import { query } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { buildCompleteQuizUrl } from '../../../shared/quizLinks.mjs'
import { resolveSiteUrl, getResendApiKey } from './resendConfig.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'
import { sendPurchaseConfirmationEmail } from './sendPurchaseEmail.mjs'

const COMPETITION = 'ronaldo_legacy_bundle'

export async function hasPaidQuizEntryForTicket(userId, ticketId) {
  if (!userId || !ticketId) return false
  await ensureTicketSchema()
  const t = await query(
    `SELECT COALESCE(purchased_at, created_at) AS since_at FROM tickets WHERE id = $1 AND user_id = $2`,
    [ticketId, userId],
  )
  const since = t.rows[0]?.since_at
  if (!since) return false

  const e = await query(
    `SELECT 1 FROM competition_entries
     WHERE user_id = $1 AND entry_type = 'paid' AND competition = $2
       AND created_at >= $3
     LIMIT 1`,
    [userId, COMPETITION, since],
  )
  return Boolean(e.rows[0])
}

async function getLatestPaidQuizOutcomeForTicket(userId, ticketId) {
  if (!userId || !ticketId) return null
  const t = await query(
    `SELECT COALESCE(purchased_at, created_at) AS since_at FROM tickets WHERE id = $1 AND user_id = $2`,
    [ticketId, userId],
  )
  const since = t.rows[0]?.since_at
  if (!since) return null

  const e = await query(
    `SELECT all_correct FROM competition_entries
     WHERE user_id = $1 AND entry_type = 'paid' AND competition = $2 AND created_at >= $3
     ORDER BY created_at DESC LIMIT 1`,
    [userId, COMPETITION, since],
  )
  const row = e.rows[0]
  if (!row) return null
  const allCorrect = row.all_correct === true || row.all_correct === 1
  return { allCorrect, quizResult: allCorrect ? 'qualified' : 'not_qualified' }
}

/** Resume link target: one ticket, any device, until answers submitted. */
export async function getPendingPaidQuizByResumeToken(resumeToken) {
  const token = typeof resumeToken === 'string' ? resumeToken.trim() : ''
  if (token.length < 20) return null

  await ensureTicketSchema()
  const t = await query(
    `SELECT t.id, t.ticket_public_id, t.bundle_id, t.quantity, t.user_id, u.email, u.full_name
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.quiz_resume_token = $1 AND t.payment_status = 'paid'`,
    [token],
  )
  const row = t.rows[0]
  if (!row) return null

  const ticketNumbers = await getTicketNumbersForPurchase(row.id)
  const outcome = await getLatestPaidQuizOutcomeForTicket(row.user_id, row.id)
  if (outcome) {
    return {
      pending: false,
      alreadyAnswered: true,
      quizResult: outcome.quizResult,
      orderRef: row.ticket_public_id,
      ticketNumbers,
      customerEmail: row.email,
      customerFullName: row.full_name || '',
      bundleId: row.bundle_id,
      resumeToken: token,
    }
  }

  return {
    pending: true,
    alreadyAnswered: false,
    ticketId: row.id,
    userId: row.user_id,
    orderRef: row.ticket_public_id,
    bundleId: row.bundle_id,
    quantity: row.quantity,
    ticketNumbers,
    customerEmail: row.email,
    customerFullName: row.full_name || '',
    resumeToken: token,
  }
}

/** Latest paid ticket with no skill quiz submitted yet. */
export async function getPendingPaidQuizForEmail(email) {
  const e = email?.trim().toLowerCase()
  if (!e || !e.includes('@')) return null

  await ensureTicketSchema()
  const u = await query(`SELECT id, email, full_name FROM users WHERE lower(email) = $1`, [e])
  if (!u.rows[0]) return null

  const t = await query(
    `SELECT id, ticket_public_id, bundle_id, quantity, user_id
     FROM tickets
     WHERE user_id = $1 AND payment_status = 'paid'
     ORDER BY COALESCE(purchased_at, created_at) DESC
     LIMIT 1`,
    [u.rows[0].id],
  )
  const row = t.rows[0]
  if (!row) return null

  const ticketNumbers = await getTicketNumbersForPurchase(row.id)
  const resumeToken = await ensureQuizResumeToken(row.id)
  const already = await hasPaidQuizEntryForTicket(row.user_id, row.id)
  if (already) {
    const outcome = await getLatestPaidQuizOutcomeForTicket(row.user_id, row.id)
    return {
      pending: false,
      alreadyAnswered: true,
      quizResult: outcome?.quizResult ?? 'not_qualified',
      orderRef: row.ticket_public_id,
      ticketNumbers,
      customerEmail: u.rows[0].email,
      customerFullName: u.rows[0].full_name || '',
      bundleId: row.bundle_id,
      resumeToken,
    }
  }

  return {
    pending: true,
    ticketId: row.id,
    userId: row.user_id,
    orderRef: row.ticket_public_id,
    bundleId: row.bundle_id,
    quantity: row.quantity,
    ticketNumbers,
    customerEmail: u.rows[0].email,
    customerFullName: u.rows[0].full_name || '',
    resumeToken,
  }
}

async function unansweredTicketEmailAlreadySent(ticketId) {
  const r = await query(
    `SELECT pending_quiz_reminder_sent_at, confirmation_email_sent_at FROM tickets WHERE id = $1`,
    [ticketId],
  )
  const row = r.rows[0]
  if (!row) return false
  return Boolean(row.pending_quiz_reminder_sent_at || row.confirmation_email_sent_at)
}

async function markUnansweredTicketEmailSent(ticketId) {
  const at = new Date().toISOString()
  await query(`UPDATE tickets SET pending_quiz_reminder_sent_at = $2 WHERE id = $1`, [ticketId, at])
}

/** One ticket email with numbers + answer link — only if they left without submitting the quiz. */
export async function maybeSendUnansweredQuizTicketEmail({
  ticketId,
  userId,
  to,
  customerFullName,
  orderRef,
  ticketNumbers = [],
  bundleId,
  quantity,
  amountPence,
}) {
  if (!ticketId || !to?.includes('@')) return { ok: false, skipped: true, reason: 'invalid_input' }

  if (userId && (await hasPaidQuizEntryForTicket(userId, ticketId))) {
    return { ok: false, skipped: true, reason: 'quiz_already_submitted' }
  }
  if (await unansweredTicketEmailAlreadySent(ticketId)) {
    return { ok: false, skipped: true, reason: 'already_sent' }
  }

  if (!getResendApiKey()) {
    console.warn('[email] RESEND_API_KEY not set — skipping unanswered quiz ticket email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const resumeToken = await ensureQuizResumeToken(ticketId)
  const siteUrl = resolveSiteUrl()
  const completeQuizUrl = buildCompleteQuizUrl(siteUrl, resumeToken)

  const sent = await sendPurchaseConfirmationEmail({
    to,
    customerFullName,
    bundleId,
    quantity,
    amountPence,
    ticketNumbers,
    purchaseRef: orderRef,
    quizPending: true,
    completeQuizUrl,
  })

  if (!sent?.ok) {
    return {
      ok: false,
      skipped: true,
      reason: sent?.reason || sent?.error || 'send_failed',
    }
  }

  await markUnansweredTicketEmailSent(ticketId)
  return { ok: true, emailSent: true, id: sent.id }
}

/** @deprecated Use maybeSendUnansweredQuizTicketEmail — kept for import compatibility. */
export const maybeSendPendingQuizReminderEmail = maybeSendUnansweredQuizTicketEmail
