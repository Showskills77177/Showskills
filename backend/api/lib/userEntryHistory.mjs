import { query } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { getTicketNumbersForPurchase } from './ticketNumbers.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'
import { resolveSiteUrl } from './resendConfig.mjs'
import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import { DRAW_COMPETITION_LABEL, DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import { buildCompleteQuizUrl } from '../../../shared/quizLinks.mjs'
import { normalizeAccountEmail } from '../../../shared/normalizeAccountEmail.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'
import { SHIRT_GIVEAWAY_PRIZE_TITLE } from '../../../shared/shirtGiveaway.mjs'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_GIVEAWAY_PATH,
} from '../../../shared/worldCupBallGiveaway.mjs'
import { buildWorldCupBallClaimUrl } from '../../../shared/worldCupBallClaim.mjs'
import { ensureWorldCupBallSchema } from './worldCupBallSchema.mjs'
import { ensureShirtEntrySchema } from './shirtEntryNumbers.mjs'
import { prizeRevealUrlForTicket } from './prizeRevealEmailContext.mjs'
import { getTicketPrizeRevealEligibility } from './prizeRevealAuth.mjs'

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

async function getPaymentAmountForTicket(ticketId) {
  const r = await query(
    `SELECT amount_pence, currency, provider, status
     FROM payments
     WHERE ticket_id = $1 AND status IN ('successful', 'completed', 'paid')
     ORDER BY created_at DESC
     LIMIT 1`,
    [ticketId],
  )
  const row = r.rows[0]
  if (!row) return null
  return {
    amountPence: Number(row.amount_pence) || 0,
    currency: row.currency || 'GBP',
    provider: row.provider || null,
    status: row.status,
  }
}

async function getConsolationEntryNumbersForOrder(email, orderRef) {
  const em = normalizeAccountEmail(email)
  const ref = String(orderRef || '').trim()
  if (!em || !ref) return []
  await ensureShirtEntrySchema()
  const r = await query(
    `SELECT entry_number FROM kickup_submissions
     WHERE lower(email) = $1
       AND video_ref = 'consolation:ronaldo-shirt-giveaway'
       AND admin_notes LIKE $2
     ORDER BY created_at ASC`,
    [em, `%Order: ${ref}%`],
  )
  return r.rows.map((row) => row.entry_number).filter(Boolean)
}

async function listPaidTicketEntries(userId, siteUrl) {
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

  const entries = []
  for (const row of r.rows) {
    const competition = row.competition || DRAW_COMPETITION_SLUG
    const ticketNumbers = await getTicketNumbersForPurchase(row.id)
    const outcome = await getQuizOutcomeForTicket(userId, row.id, competition)
    const bundle = getTicketBundleById(row.bundle_id)
    const payment = await getPaymentAmountForTicket(row.id)

    let quizStatus = 'pending'
    let quizUrl = null
    let prizeRevealUrl = null
    let prizeRevealViewed = false
    let consolationEntryNumbers = []

    if (outcome) {
      quizStatus = outcome.allCorrect ? 'qualified' : 'not_qualified'
      if (outcome.allCorrect) {
        const eligibility = await getTicketPrizeRevealEligibility(row.id, competition)
        prizeRevealViewed = Boolean(eligibility.alreadyViewed)
        if (eligibility.qualified && !eligibility.alreadyViewed) {
          prizeRevealUrl = await prizeRevealUrlForTicket(row.id, competition)
        }
      } else {
        const userRow = await query(`SELECT email FROM users WHERE id = $1`, [userId])
        consolationEntryNumbers = await getConsolationEntryNumbersForOrder(
          userRow.rows[0]?.email,
          row.ticket_public_id,
        )
      }
    } else {
      const resumeToken = await ensureQuizResumeToken(row.id)
      quizUrl = buildCompleteQuizUrl(siteUrl, resumeToken)
    }

    const competitionLabel =
      row.period_title ||
      (competition === DRAW_COMPETITION_SLUG ? DRAW_COMPETITION_LABEL : competition)

    entries.push({
      id: row.id,
      kind: 'paid_ticket',
      competitionLabel,
      bundleTitle: bundle?.title || row.bundle_id || 'Ticket bundle',
      orderRef: row.ticket_public_id,
      quantity: row.quantity,
      amountPence: payment?.amountPence ?? bundle?.totalPence ?? null,
      currency: payment?.currency || 'GBP',
      paymentProvider: payment?.provider || null,
      purchasedAt: row.purchased_at || row.created_at,
      ticketNumbers,
      quizStatus,
      quizUrl,
      prizeRevealUrl,
      prizeRevealViewed,
      consolationEntryNumbers,
      canResendEmail: true,
    })
  }
  return entries
}

async function listShirtGiveawayEntries(email) {
  const em = normalizeAccountEmail(email)
  if (!em) return []
  await ensureShirtEntrySchema()
  const r = await query(
    `SELECT id, entry_number, created_at, review_status
     FROM kickup_submissions
     WHERE lower(email) = $1
       AND competition = $2
       AND video_ref != 'consolation:ronaldo-shirt-giveaway'
     ORDER BY created_at DESC`,
    [em, COMPETITION_SHIRT_GIVEAWAY],
  )
  return r.rows.map((row) => ({
    id: row.id,
    kind: 'shirt_giveaway',
    competitionLabel: SHIRT_GIVEAWAY_PRIZE_TITLE,
    bundleTitle: SHIRT_GIVEAWAY_PRIZE_TITLE,
    orderRef: row.entry_number || null,
    quantity: 1,
    amountPence: 0,
    currency: 'GBP',
    purchasedAt: row.created_at,
    entryNumbers: row.entry_number ? [row.entry_number] : [],
    quizStatus: 'n/a',
    reviewStatus: row.review_status || null,
    canResendEmail: false,
  }))
}

async function listWorldCupBallEntries(email, siteUrl) {
  const em = normalizeAccountEmail(email)
  if (!em) return []
  await ensureWorldCupBallSchema()
  const r = await query(
    `SELECT s.id, s.status, s.started_at, s.submitted_at, s.claim_token, s.claimed_at,
            w.id AS winner_id,
            mde.entry_number AS monthly_draw_entry
     FROM world_cup_ball_sessions s
     LEFT JOIN world_cup_ball_winners w ON w.session_id = s.id
     LEFT JOIN world_cup_ball_monthly_draw_entries mde ON mde.session_id = s.id
     WHERE lower(COALESCE(s.contact_email, w.email, '')) = $1
        OR lower(COALESCE(w.email, '')) = $1
     ORDER BY s.started_at DESC`,
    [em],
  )

  return r.rows.map((row) => {
    const status = String(row.status || 'in_progress')
    const claimUrl =
      row.claim_token && ['won', 'claimed'].includes(status)
        ? buildWorldCupBallClaimUrl(siteUrl, row.claim_token)
        : null
    const wcStatus =
      status === 'claimed'
        ? 'claimed'
        : status === 'won'
          ? 'won'
          : status === 'in_progress'
            ? 'in_progress'
            : 'lost'

    return {
      id: row.id,
      kind: 'world_cup_ball',
      competitionLabel: WORLD_CUP_BALL_GIVEAWAY_LABEL,
      bundleTitle: WORLD_CUP_BALL_GIVEAWAY_LABEL,
      orderRef: row.monthly_draw_entry || null,
      quantity: 1,
      amountPence: 0,
      currency: 'GBP',
      purchasedAt: row.submitted_at || row.started_at,
      entryNumbers: row.monthly_draw_entry ? [row.monthly_draw_entry] : [],
      quizStatus: wcStatus === 'won' || wcStatus === 'claimed' ? 'qualified' : wcStatus === 'in_progress' ? 'pending' : 'not_qualified',
      wcBallStatus: wcStatus,
      claimUrl,
      giveawayPath: WORLD_CUP_BALL_GIVEAWAY_PATH,
      canResendEmail: false,
    }
  })
}

/** Paid tickets, free giveaways, and consolation entries for a signed-in user. */
export async function listUserEntryHistory(userId, email) {
  if (!userId) return []
  const siteUrl = resolveSiteUrl()
  const [paid, shirts, wc] = await Promise.all([
    listPaidTicketEntries(userId, siteUrl),
    listShirtGiveawayEntries(email),
    listWorldCupBallEntries(email, siteUrl),
  ])
  const combined = [...paid, ...shirts, ...wc]
  combined.sort((a, b) => {
    const ta = new Date(a.purchasedAt || 0).getTime()
    const tb = new Date(b.purchasedAt || 0).getTime()
    return tb - ta
  })
  return combined
}

/** @param {string} userId @param {string} ticketId */
export async function getPaidTicketEntryForUser(userId, ticketId) {
  const rows = await listPaidTicketEntries(userId, resolveSiteUrl())
  return rows.find((e) => e.id === ticketId && e.kind === 'paid_ticket') || null
}
