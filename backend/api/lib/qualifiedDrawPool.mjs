import { randomInt, randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { pickDrawWinner } from '../../../shared/drawWinner.mjs'

export const DEFAULT_DRAW_COMPETITION = 'ronaldo_legacy_bundle'

let drawSchemaEnsured = false

export async function ensureDrawSchema() {
  if (drawSchemaEnsured) return
  await ensureTicketSchema()
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS draw_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competition TEXT NOT NULL,
        pool_size INTEGER NOT NULL CHECK (pool_size >= 0),
        random_index INTEGER NOT NULL CHECK (random_index >= 0),
        winning_ticket_number TEXT NOT NULL,
        ticket_id UUID,
        winner_user_id UUID,
        winner_email TEXT NOT NULL,
        winner_full_name TEXT,
        drawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_draw_runs_competition ON draw_runs (competition, drawn_at DESC)`)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS draw_runs (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        pool_size INTEGER NOT NULL,
        random_index INTEGER NOT NULL,
        winning_ticket_number TEXT NOT NULL,
        ticket_id TEXT,
        winner_user_id TEXT,
        winner_email TEXT NOT NULL,
        winner_full_name TEXT,
        drawn_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_draw_runs_competition ON draw_runs (competition, drawn_at)`)
  }
  drawSchemaEnsured = true
}

/**
 * Paid online entries only: each ticket_number is one draw slot when the purchaser
 * submitted a correct skill quiz for that purchase window.
 * Postal entries are not in the database — add manually if needed.
 */
export async function fetchQualifiedDrawPool(competition = DEFAULT_DRAW_COMPETITION) {
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
      u.full_name
    FROM ticket_numbers tn
    INNER JOIN tickets t ON t.id = tn.ticket_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.payment_status IN ('paid', 'free_verified')
      AND EXISTS (
        SELECT 1
        FROM competition_entries e
        WHERE e.user_id = t.user_id
          AND e.competition = $1
          AND e.entry_type = 'paid'
          AND ${correctClause}
          AND e.created_at >= COALESCE(t.purchased_at, t.created_at)
          AND e.created_at < COALESCE(
            (
              SELECT MIN(COALESCE(t2.purchased_at, t2.created_at))
              FROM tickets t2
              WHERE t2.user_id = t.user_id
                AND t2.payment_status = 'paid'
                AND COALESCE(t2.purchased_at, t2.created_at) > COALESCE(t.purchased_at, t.created_at)
            ),
            $2
          )
      )
    ORDER BY tn.ticket_number ASC`

  const r = await query(sql, [competition, farFuture])
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
  }))
}

export async function fetchDrawPoolSummary(competition = DEFAULT_DRAW_COMPETITION) {
  const pool = await fetchQualifiedDrawPool(competition)
  const uniqueEntrants = new Set(pool.map((s) => s.userId || s.email).filter(Boolean))
  return {
    competition,
    poolSize: pool.length,
    uniqueEntrants: uniqueEntrants.size,
    entrantBreakdown: buildEntrantBreakdown(pool),
  }
}

/** Slots per person — explains why someone with more tickets wins more often. */
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

export async function listDrawRuns(competition = DEFAULT_DRAW_COMPETITION, limit = 20) {
  await ensureDrawSchema()
  const lim = Math.min(50, Math.max(1, limit))
  const r = await query(
    `SELECT id, competition, pool_size, random_index, winning_ticket_number, winner_email, winner_full_name, drawn_at
     FROM draw_runs
     WHERE competition = $1
     ORDER BY drawn_at DESC
     LIMIT ${lim}`,
    [competition],
  )
  return r.rows
}

export async function runFairDraw({ competition = DEFAULT_DRAW_COMPETITION, pool: presetPool } = {}) {
  await ensureDrawSchema()
  const pool = presetPool ?? (await fetchQualifiedDrawPool(competition))
  if (!pool.length) {
    return { ok: false, error: 'No qualified ticket numbers in the pool. Check paid purchases and correct quizzes.' }
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
  await query(
    `INSERT INTO draw_runs (
      id, competition, pool_size, random_index, winning_ticket_number,
      ticket_id, winner_user_id, winner_email, winner_full_name, drawn_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      drawId,
      competition,
      pool.length,
      randomIndex,
      winner.ticketNumber,
      winner.ticketId || null,
      winner.userId || null,
      winner.email,
      winner.fullName,
      drawnAt,
    ],
  )

  return {
    ok: true,
    drawId,
    drawnAt,
    poolSize: pool.length,
    randomIndex,
    winner: {
      ticketNumber: winner.ticketNumber,
      ticketPublicId: winner.ticketPublicId,
      email: winner.email,
      fullName: winner.fullName,
      bundleId: winner.bundleId,
      quantity: winner.quantity,
    },
  }
}
