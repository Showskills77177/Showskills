import { randomInt, randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { pickDrawWinner } from '../../../shared/drawWinner.mjs'
import { ensureCompetitionPeriodsSchema } from './competitionPeriods.mjs'
import {
  countDrawRunsForPeriod,
  markPeriodDrawn,
  validatePeriodForDraw,
} from './competitionPeriods.mjs'
import { sendWinnerNotificationEmail } from './sendWinnerEmail.mjs'

export const DEFAULT_DRAW_COMPETITION = 'ronaldo_legacy_bundle'

let drawSchemaEnsured = false

async function ensureDrawRunsPeriodColumns() {
  if (dbIsPostgres()) {
    await query(`ALTER TABLE draw_runs ADD COLUMN IF NOT EXISTS period_id TEXT`)
    await query(`ALTER TABLE draw_runs ADD COLUMN IF NOT EXISTS winner_email_sent_at TIMESTAMPTZ`)
    await query(`ALTER TABLE draw_runs ADD COLUMN IF NOT EXISTS winner_email_resend_id TEXT`)
    await query(`ALTER TABLE draw_runs ADD COLUMN IF NOT EXISTS winner_phone TEXT`)
  } else {
    try {
      await query(`ALTER TABLE draw_runs ADD COLUMN period_id TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE draw_runs ADD COLUMN winner_email_sent_at TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE draw_runs ADD COLUMN winner_email_resend_id TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE draw_runs ADD COLUMN winner_phone TEXT`)
    } catch {
      /* column exists */
    }
  }
}

export async function ensureDrawSchema() {
  if (drawSchemaEnsured) return
  await ensureTicketSchema()
  await ensureCompetitionPeriodsSchema()
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS draw_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competition TEXT NOT NULL,
        period_id TEXT,
        pool_size INTEGER NOT NULL CHECK (pool_size >= 0),
        random_index INTEGER NOT NULL CHECK (random_index >= 0),
        winning_ticket_number TEXT NOT NULL,
        ticket_id UUID,
        winner_user_id UUID,
        winner_email TEXT NOT NULL,
        winner_full_name TEXT,
        winner_email_sent_at TIMESTAMPTZ,
        winner_email_resend_id TEXT,
        drawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_draw_runs_competition ON draw_runs (competition, drawn_at DESC)`)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS draw_runs (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        period_id TEXT,
        pool_size INTEGER NOT NULL,
        random_index INTEGER NOT NULL,
        winning_ticket_number TEXT NOT NULL,
        ticket_id TEXT,
        winner_user_id TEXT,
        winner_email TEXT NOT NULL,
        winner_full_name TEXT,
        winner_email_sent_at TEXT,
        winner_email_resend_id TEXT,
        drawn_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_draw_runs_competition ON draw_runs (competition, drawn_at)`)
  }
  await ensureDrawRunsPeriodColumns()
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_draw_runs_period ON draw_runs (period_id, drawn_at DESC)`)
  } catch {
    try {
      await query(`CREATE INDEX IF NOT EXISTS idx_draw_runs_period ON draw_runs (period_id, drawn_at)`)
    } catch {
      /* ignore */
    }
  }
  drawSchemaEnsured = true
}

/**
 * Qualified ticket numbers for one competition period only.
 * Paid and free online entries with a correct skill quiz tied to that purchase window.
 */
export async function fetchQualifiedDrawPool(competition = DEFAULT_DRAW_COMPETITION, period) {
  if (!period?.id || !period.entryOpensAt || !period.entryClosesAt) {
    return []
  }
  await ensureDrawSchema()
  const correctClause = dbIsPostgres() ? 'e.all_correct IS TRUE' : 'e.all_correct = 1'
  const farFuture = '9999-12-31T23:59:59.999Z'

  const sql = `
    SELECT
      tn.ticket_number,
      tn.id AS ticket_number_id,
      t.id AS ticket_id,
      t.ticket_public_id,
      t.bundle_id,
      t.quantity,
      u.id AS user_id,
      u.email,
      u.full_name,
      u.phone
    FROM ticket_numbers tn
    INNER JOIN tickets t ON t.id = tn.ticket_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.payment_status IN ('paid', 'free_verified')
      AND (
        t.period_id = $4
        OR (
          t.period_id IS NULL
          AND COALESCE(t.purchased_at, t.created_at) >= $2
          AND COALESCE(t.purchased_at, t.created_at) < $3
        )
      )
      AND EXISTS (
        SELECT 1
        FROM competition_entries e
        WHERE e.user_id = t.user_id
          AND e.competition = $1
          AND e.entry_type IN ('paid', 'free')
          AND ${correctClause}
          AND e.created_at >= COALESCE(t.purchased_at, t.created_at)
          AND e.created_at < COALESCE(
            (
              SELECT MIN(COALESCE(t2.purchased_at, t2.created_at))
              FROM tickets t2
              WHERE t2.user_id = t.user_id
                AND t2.payment_status IN ('paid', 'free_verified')
                AND COALESCE(t2.purchased_at, t2.created_at) > COALESCE(t.purchased_at, t.created_at)
            ),
            $5
          )
      )
    ORDER BY tn.ticket_number ASC`

  const r = await query(sql, [
    competition,
    period.entryOpensAt,
    period.entryClosesAt,
    period.id,
    farFuture,
  ])
  return r.rows.map((row) => ({
    ticketNumber: row.ticket_number,
    ticketNumberId: row.ticket_number_id,
    ticketId: row.ticket_id,
    ticketPublicId: row.ticket_public_id,
    bundleId: row.bundle_id,
    quantity: row.quantity,
    userId: row.user_id,
    email: row.email || '',
    fullName: row.full_name || '',
    phone: row.phone || '',
  }))
}

export async function fetchDrawPoolSummary(competition = DEFAULT_DRAW_COMPETITION, period) {
  const pool = await fetchQualifiedDrawPool(competition, period)
  const uniqueEntrants = new Set(pool.map((s) => s.userId || s.email).filter(Boolean))
  return {
    competition,
    periodId: period?.id,
    periodTitle: period?.title,
    periodStatus: period?.status,
    entryOpensAt: period?.entryOpensAt,
    entryClosesAt: period?.entryClosesAt,
    poolSize: pool.length,
    uniqueEntrants: uniqueEntrants.size,
    entrantBreakdown: buildEntrantBreakdown(pool),
  }
}

export function buildEntrantBreakdown(pool) {
  const byKey = new Map()
  for (const slot of pool) {
    const key = slot.userId || slot.email || slot.ticketNumber
    const existing = byKey.get(key)
    if (existing) {
      existing.slots += 1
    } else {
      byKey.set(key, {
        fullName: slot.fullName || '—',
        email: slot.email || '',
        slots: 1,
      })
    }
  }
  const total = pool.length || 1
  return [...byKey.values()]
    .map((row) => ({
      ...row,
      winChancePercent: Math.round((row.slots / total) * 1000) / 10,
    }))
    .sort((a, b) => b.slots - a.slots)
}

export async function listDrawRuns(competition = DEFAULT_DRAW_COMPETITION, { periodId, limit = 20 } = {}) {
  await ensureDrawSchema()
  const lim = Math.min(50, Math.max(1, limit))
  const params = [competition]
  let where = 'WHERE competition = $1'
  if (periodId) {
    params.push(periodId)
    where += ` AND period_id = $${params.length}`
  }
  const r = await query(
    `SELECT id, competition, period_id, pool_size, random_index, winning_ticket_number,
            winner_email, winner_full_name, winner_email_sent_at, drawn_at
     FROM draw_runs
     ${where}
     ORDER BY drawn_at DESC
     LIMIT ${lim}`,
    params,
  )
  return r.rows
}

export async function runFairDraw({
  competition = DEFAULT_DRAW_COMPETITION,
  period,
  pool: presetPool,
  sendWinnerEmail = true,
} = {}) {
  await ensureDrawSchema()

  const periodCheck = validatePeriodForDraw(period)
  if (!periodCheck.ok) return periodCheck

  const priorDraws = await countDrawRunsForPeriod(period.id)
  if (priorDraws > 0) {
    return {
      ok: false,
      error:
        'A winner has already been recorded for this competition period. The audit log preserves that result — create a new period for a separate draw cycle.',
    }
  }

  const pool = presetPool ?? (await fetchQualifiedDrawPool(competition, period))
  if (!pool.length) {
    return {
      ok: false,
      error:
        'No qualified ticket numbers fall within this competition period. Confirm the entry window dates, paid/free entries, and correct skill quizzes.',
    }
  }

  let randomIndex = -1
  const winner = pickDrawWinner(pool, (max) => {
    randomIndex = randomInt(0, max)
    return randomIndex
  })
  if (!winner || randomIndex < 0) {
    return { ok: false, error: 'Draw failed — empty pool.' }
  }

  const drawId = randomUUID()
  const drawnAt = new Date().toISOString()

  let emailResult = { ok: false, skipped: true, reason: 'not_requested' }
  if (sendWinnerEmail && winner.email) {
      emailResult = await sendWinnerNotificationEmail({
      to: winner.email,
      customerFullName: winner.fullName,
      customerPhone: winner.phone,
      winningTicketNumber: winner.ticketNumber,
      periodTitle: period.title,
      orderRef: winner.ticketPublicId,
      drawnAt,
    })
  } else if (sendWinnerEmail && !winner.email) {
    emailResult = { ok: false, skipped: true, reason: 'no_winner_email' }
  }

  const emailSentAt = emailResult.ok ? drawnAt : null

  await query(
    `INSERT INTO draw_runs (
      id, competition, period_id, pool_size, random_index, winning_ticket_number,
      ticket_id, winner_user_id, winner_email, winner_full_name, winner_phone,
      winner_email_sent_at, winner_email_resend_id, drawn_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      drawId,
      competition,
      period.id,
      pool.length,
      randomIndex,
      winner.ticketNumber,
      winner.ticketId || null,
      winner.userId || null,
      winner.email,
      winner.fullName,
      winner.phone || null,
      emailSentAt,
      emailResult.id || null,
      drawnAt,
    ],
  )

  await markPeriodDrawn(period.id)

  return {
    ok: true,
    drawId,
    drawnAt,
    periodId: period.id,
    periodTitle: period.title,
    poolSize: pool.length,
    randomIndex,
    winner: {
      ticketNumber: winner.ticketNumber,
      ticketPublicId: winner.ticketPublicId,
      email: winner.email,
      phone: winner.phone,
      fullName: winner.fullName,
      bundleId: winner.bundleId,
      quantity: winner.quantity,
    },
    winnerEmail: {
      sent: Boolean(emailResult.ok),
      skipped: Boolean(emailResult.skipped),
      error: emailResult.error || null,
      resendId: emailResult.id || null,
    },
  }
}
