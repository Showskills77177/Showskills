import { query } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'
import { resolveSiteUrl } from './resendConfig.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import { DRAW_COMPETITION_LABEL, DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import { buildCompleteQuizUrl } from '../../../shared/quizLinks.mjs'

async function getQuizOutcomeForTicket(userId, ticketId, competition) {
  if (!userId || !ticketId) return null
  const t = await query(
    `SELECT COALESCE(purchased_at, created_at) AS since_at FROM tickets WHERE id = $1 AND user_id = $2`,
    [ticketId, userId],
  )
  const since = t.rows[0]?.since_at
  if (!since) return null

  const comp = competition || DRAW_COMPETITION_SLUG
  const e = await query(
    `SELECT all_correct FROM competition_entries
     WHERE user_id = $1 AND entry_type = 'paid' AND competition = $2 AND created_at >= $3
     ORDER BY created_at DESC LIMIT 1`,
    [userId, comp, since],
  )
  const row = e.rows[0]
  if (!row) return null
  const allCorrect = row.all_correct === true || row.all_correct === 1
  return { allCorrect }
}

/** Paid ticket purchases and quiz status for a signed-in user. */
export async function listUserEntryHistory(userId) {
  if (!userId) return []

  await ensureTicketSchema()
  const r = await query(
    `SELECT t.id, t.ticket_public_id, t.bundle_id, t.quantity, t.payment_status,
            t.purchased_at, t.created_at, t.competition, t.period_id,
            cp.title AS period_title
     FROM tickets t
     LEFT JOIN competition_periods cp ON cp.id = t.period_id
     WHERE t.user_id = $1 AND t.payment_status = 'paid'
     ORDER BY COALESCE(t.purchased_at, t.created_at) DESC`,
    [userId],
  )

  const siteUrl = resolveSiteUrl()
  const entries = []

  for (const row of r.rows) {
    const competition = row.competition || DRAW_COMPETITION_SLUG
    const ticketNumbers = await getTicketNumbersForPurchase(row.id)
    const outcome = await getQuizOutcomeForTicket(userId, row.id, competition)
    const bundle = getTicketBundleById(row.bundle_id)

    let quizStatus = 'pending'
    let quizUrl = null
    if (outcome) {
      quizStatus = outcome.allCorrect ? 'qualified' : 'not_qualified'
    } else {
      const resumeToken = await ensureQuizResumeToken(row.id)
      quizUrl = buildCompleteQuizUrl(siteUrl, resumeToken)
    }

    const competitionLabel =
      row.period_title ||
      (competition === DRAW_COMPETITION_SLUG ? DRAW_COMPETITION_LABEL : competition)

    entries.push({
      id: row.id,
      orderRef: row.ticket_public_id,
      bundleId: row.bundle_id,
      bundleTitle: bundle?.title || row.bundle_id || 'Ticket bundle',
      quantity: row.quantity,
      purchasedAt: row.purchased_at || row.created_at,
      competition,
      competitionLabel,
      ticketNumbers,
      quizStatus,
      quizUrl,
    })
  }

  return entries
}
