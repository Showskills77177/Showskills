import { query } from './db.mjs'
import { getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import { buildCompleteQuizUrl } from '../../../shared/quizLinks.mjs'
import { resolveSiteUrl, getResendApiKey } from './resendConfig.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'
import { sendPurchaseConfirmationEmail } from './sendPurchaseEmail.mjs'
import { sendQuizResultEmail } from './sendQuizResultEmail.mjs'
import { prizeRevealUrlForTicket } from './prizeRevealEmailContext.mjs'
import { getPaidTicketEntryForUser } from './userEntryHistory.mjs'
import { hasPaidQuizEntryForTicket } from './pendingQuiz.mjs'
import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'

async function loadTicketEmailContext(userId, ticketId) {
  const r = await query(
    `SELECT t.id, t.ticket_public_id, t.bundle_id, t.quantity, t.competition, u.email, u.full_name
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1 AND t.user_id = $2 AND t.payment_status = 'paid'`,
    [ticketId, userId],
  )
  return r.rows[0] || null
}

/**
 * Resend purchase or quiz-result email for a paid ticket owned by the user.
 * @param {{ userId: string, ticketId: string, force?: boolean }} opts
 */
export async function resendPaidTicketEmailForUser({ userId, ticketId, force = true }) {
  if (!userId || !ticketId) {
    return { ok: false, error: 'Invalid request.' }
  }
  if (!getResendApiKey()) {
    return { ok: false, error: 'Email is not configured on this server.' }
  }

  const row = await loadTicketEmailContext(userId, ticketId)
  if (!row) {
    return { ok: false, error: 'Entry not found.' }
  }

  const entry = await getPaidTicketEntryForUser(userId, ticketId)
  if (!entry) {
    return { ok: false, error: 'Entry not found.' }
  }

  const ticketNumbers = await getTicketNumbersForPurchase(ticketId)
  const bundle = getTicketBundleById(row.bundle_id)
  const siteUrl = resolveSiteUrl()
  const competition = row.competition || DRAW_COMPETITION_SLUG

  if (entry.quizStatus === 'pending') {
    const resumeToken = await ensureQuizResumeToken(ticketId)
    const completeQuizUrl = buildCompleteQuizUrl(siteUrl, resumeToken)
    const sent = await sendPurchaseConfirmationEmail({
      to: row.email,
      customerFullName: row.full_name,
      bundleId: row.bundle_id,
      quantity: row.quantity,
      amountPence: entry.amountPence ?? bundle?.totalPence,
      ticketNumbers,
      purchaseRef: row.ticket_public_id,
      quizPending: true,
      completeQuizUrl,
    })
    if (!sent?.ok) {
      return { ok: false, error: sent?.error || 'Could not send email.' }
    }
    if (force) {
      await query(`UPDATE tickets SET pending_quiz_reminder_sent_at = $2 WHERE id = $1`, [
        ticketId,
        new Date().toISOString(),
      ])
    }
    return { ok: true, emailSent: true, type: 'quiz_pending' }
  }

  if (!(await hasPaidQuizEntryForTicket(userId, ticketId, competition))) {
    return { ok: false, error: 'No quiz result to resend yet.' }
  }

  const allCorrect = entry.quizStatus === 'qualified'
  const prizeRevealUrl =
    allCorrect && !entry.prizeRevealViewed
      ? await prizeRevealUrlForTicket(ticketId, competition)
      : entry.prizeRevealUrl || ''

  const sent = await sendQuizResultEmail({
    to: row.email,
    customerFullName: row.full_name,
    allCorrect,
    orderRef: row.ticket_public_id,
    bundleId: row.bundle_id,
    quantity: row.quantity,
    amountPence: entry.amountPence ?? bundle?.totalPence,
    ticketNumbers,
    consolationShirtEntries: entry.consolationEntryNumbers?.length || 0,
    consolationShirtEntryNumbers: entry.consolationEntryNumbers || [],
    prizeRevealUrl: prizeRevealUrl || '',
  })

  if (!sent?.ok) {
    return { ok: false, error: sent?.error || 'Could not send email.' }
  }
  return { ok: true, emailSent: true, type: 'quiz_result' }
}
