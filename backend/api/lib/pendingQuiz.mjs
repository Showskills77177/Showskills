import { query, dbIsPostgres } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import {
  buildPendingQuizHtml,
  buildPendingQuizText,
  pendingQuizSubject,
  pendingQuizEmailProps,
} from '../../../shared/pendingQuizEmail.mjs'
import { resolveResendFrom, formatResendError, resolveSiteUrl, getResendApiKey } from './resendConfig.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'

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
    orderRef: row.ticket_public_id,
    bundleId: row.bundle_id,
    quantity: row.quantity,
    ticketNumbers,
    customerEmail: u.rows[0].email,
    customerFullName: u.rows[0].full_name || '',
    resumeToken,
  }
}

async function pendingReminderAlreadySent(ticketId) {
  const r = await query(`SELECT pending_quiz_reminder_sent_at FROM tickets WHERE id = $1`, [ticketId])
  return Boolean(r.rows[0]?.pending_quiz_reminder_sent_at)
}

async function markPendingReminderSent(ticketId) {
  const at = new Date().toISOString()
  await query(`UPDATE tickets SET pending_quiz_reminder_sent_at = $2 WHERE id = $1`, [ticketId, at])
}

export async function maybeSendPendingQuizReminderEmail({
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
  if (await pendingReminderAlreadySent(ticketId)) {
    return { ok: false, skipped: true, reason: 'already_sent' }
  }

  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping pending quiz reminder')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const resumeToken = await ensureQuizResumeToken(ticketId)
  const bundle = bundleId ? getTicketBundleById(bundleId) : null
  const siteUrl = resolveSiteUrl()
  const props = pendingQuizEmailProps({
    customerFullName,
    siteUrl,
    orderRef,
    bundleTitle: bundle?.title ?? bundleId,
    quantity: quantity ?? bundle?.qty,
    amountPence: amountPence ?? bundle?.totalPence,
    ticketNumbers,
    resumeToken,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resolveResendFrom(),
      to: [to.trim()],
      subject: pendingQuizSubject(orderRef),
      html: buildPendingQuizHtml(props),
      text: buildPendingQuizText(props),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] Pending quiz reminder failed:', msg)
    return { ok: false, error: msg }
  }

  await markPendingReminderSent(ticketId)
  return { ok: true, id: data.id }
}
