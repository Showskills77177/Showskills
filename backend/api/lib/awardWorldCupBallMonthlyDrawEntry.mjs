import { randomBytes, randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { logEntryAttempt } from './freeEntryAbuse.mjs'
import { ensureWorldCupBallSchema } from './worldCupBallSchema.mjs'
import { isWorldCupBallLocalDevBypass } from './worldCupBallDev.mjs'
import {
  formatWorldCupBallDrawEntryNumber,
  resolveWorldCupBallMonthlyDrawPeriod,
  WORLD_CUP_BALL_MONTHLY_DRAW_ENTRY_COUNT,
} from '../../../shared/worldCupBallMonthlyDraw.mjs'
import { COMPETITION_WORLD_CUP_BALL } from '../../../shared/freeEntryLimits.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../../shared/worldCupBallGiveaway.mjs'

function monthlyDrawPreviewEnabled() {
  if (isWorldCupBallLocalDevBypass()) return true
  const flag = String(process.env.WC_BALL_MONTHLY_DRAW_ALWAYS || '').trim().toLowerCase()
  if (flag === '1' || flag === 'true') return true
  const siteUrl = String(process.env.SITE_URL || process.env.VERCEL_URL || '').toLowerCase()
  if (siteUrl.includes('vercelshowskillstesteasynow') || siteUrl.includes('localhost')) return true
  return false
}

async function allocateWorldCupBallDrawEntryNumber() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const entryNumber = formatWorldCupBallDrawEntryNumber(randomBytes(4).toString('hex'))
    const exists = await query(
      `SELECT 1 FROM world_cup_ball_monthly_draw_entries WHERE entry_number = $1 LIMIT 1`,
      [entryNumber],
    )
    if (!exists.rows[0]) return entryNumber
  }
  throw new Error('Could not allocate unique World Cup Ball draw entry number')
}

export async function hasWorldCupBallMonthlyDrawEntry(sessionId) {
  if (!sessionId) return false
  await ensureWorldCupBallSchema()
  const r = await query(
    `SELECT 1 FROM world_cup_ball_monthly_draw_entries WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  )
  return Boolean(r.rows[0])
}

/**
 * Award one free monthly draw entry when a quiz attempt ends without an outright win.
 * @param {{ req?: import('http').IncomingMessage, sessionId: string, ip?: string, outcome: string }} params
 */
export async function awardWorldCupBallMonthlyDrawEntry({ req, sessionId, ip, outcome }) {
  if (!sessionId) {
    return { awarded: false, entryCount: 0, entryNumbers: [], reason: 'invalid_session' }
  }

  const period = resolveWorldCupBallMonthlyDrawPeriod(new Date(), {
    promotionalPreview: monthlyDrawPreviewEnabled(),
  })
  if (!period) {
    return { awarded: false, entryCount: 0, entryNumbers: [], reason: 'draw_not_active' }
  }

  if (await hasWorldCupBallMonthlyDrawEntry(sessionId)) {
    const existing = await query(
      `SELECT entry_number, draw_month FROM world_cup_ball_monthly_draw_entries WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    )
    const row = existing.rows[0]
    return {
      awarded: Boolean(row),
      entryCount: row ? WORLD_CUP_BALL_MONTHLY_DRAW_ENTRY_COUNT : 0,
      entryNumbers: row?.entry_number ? [row.entry_number] : [],
      drawMonth: row?.draw_month || period.drawMonth,
      drawMonthLabel: period.label,
      reason: 'already_awarded',
    }
  }

  await ensureWorldCupBallSchema()
  const entryNumber = await allocateWorldCupBallDrawEntryNumber()
  const id = randomUUID()
  const now = new Date().toISOString()

  // Require a contact email on the session before awarding a monthly-draw entry.
  const sRes = await query(
    `SELECT contact_email FROM world_cup_ball_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  )
  const contactEmail = String(sRes.rows[0]?.contact_email || '').trim().toLowerCase()
  if (!contactEmail || !contactEmail.includes('@')) {
    // Log the attempt for audit/analytics and return a clear reason to callers.
    await logEntryAttempt(req, {
      competition: COMPETITION_WORLD_CUP_BALL,
      flow: 'world_cup_ball_monthly_draw',
      ip,
      outcome: 'no_email',
      metadata: { sessionId, drawMonth: period.drawMonth },
    }).catch(() => {})

    return {
      awarded: false,
      entryCount: 0,
      entryNumbers: [],
      drawMonth: period.drawMonth,
      drawMonthLabel: period.label,
      reason: 'email_required',
    }
  }

  await query(
    `INSERT INTO world_cup_ball_monthly_draw_entries (
      id, session_id, draw_month, entry_number, ip_address, outcome, created_at, email
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, sessionId, period.drawMonth, entryNumber, ip || '', outcome || 'lost', now, contactEmail],
  )

  await logEntryAttempt(req, {
    competition: COMPETITION_WORLD_CUP_BALL,
    flow: 'world_cup_ball_monthly_draw',
    ip,
    outcome: 'success',
    metadata: {
      sessionId,
      drawMonth: period.drawMonth,
      entryNumber,
      quizOutcome: outcome,
      preview: Boolean(period.preview),
      contactEmail,
    },
  })

  return {
    awarded: true,
    entryCount: WORLD_CUP_BALL_MONTHLY_DRAW_ENTRY_COUNT,
    entryNumbers: [entryNumber],
    drawMonth: period.drawMonth,
    drawMonthLabel: period.label,
    preview: Boolean(period.preview),
  }
}

export async function maybeAwardWorldCupBallMonthlyDrawEntry({ req, sessionId, ip, status }) {
  if (!sessionId || status === 'won' || status === 'salvage_bonus') {
    return { awarded: false, entryCount: 0, entryNumbers: [] }
  }
  return awardWorldCupBallMonthlyDrawEntry({
    req,
    sessionId,
    ip,
    outcome: status,
  })
}

export function worldCupBallMonthlyDrawAdminLabel() {
  return `${WORLD_CUP_BALL_GIVEAWAY_LABEL} — monthly draw entry`
}
