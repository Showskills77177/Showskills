import { randomInt, randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'
import { ensureWorldCupBallSchema } from './worldCupBallSchema.mjs'
import { pickDrawWinner } from '../../../shared/drawWinner.mjs'
import {
  WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS,
  formatWorldCupBallDrawMonthLabel,
} from '../../../shared/worldCupBallMonthlyDraw.mjs'

let drawRunsEnsured = false

export async function ensureWorldCupBallMonthlyDrawRunsSchema() {
  if (drawRunsEnsured) return
  await ensureWorldCupBallSchema()

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_monthly_draw_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        draw_month TEXT NOT NULL,
        pool_size INTEGER NOT NULL CHECK (pool_size >= 0),
        random_index INTEGER NOT NULL CHECK (random_index >= 0),
        winning_entry_id UUID NOT NULL,
        winning_entry_number TEXT NOT NULL,
        session_id UUID,
        ip_address TEXT NOT NULL DEFAULT '',
        admin_notes TEXT,
        drawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_wc_ball_draw_runs_month ON world_cup_ball_monthly_draw_runs (draw_month)`,
    )
    await query(
      `CREATE INDEX IF NOT EXISTS idx_wc_ball_draw_runs_drawn ON world_cup_ball_monthly_draw_runs (drawn_at DESC)`,
    )
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_monthly_draw_runs (
        id TEXT PRIMARY KEY NOT NULL,
        draw_month TEXT NOT NULL,
        pool_size INTEGER NOT NULL,
        random_index INTEGER NOT NULL,
        winning_entry_id TEXT NOT NULL,
        winning_entry_number TEXT NOT NULL,
        session_id TEXT,
        ip_address TEXT NOT NULL DEFAULT '',
        admin_notes TEXT,
        drawn_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_wc_ball_draw_runs_month ON world_cup_ball_monthly_draw_runs (draw_month)`,
    )
  }

  drawRunsEnsured = true
}

/** @param {string} drawMonth */
export async function countWorldCupBallMonthlyDrawRuns(drawMonth) {
  if (!drawMonth) return 0
  await ensureWorldCupBallMonthlyDrawRunsSchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM world_cup_ball_monthly_draw_runs WHERE draw_month = $1`,
    [drawMonth],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/**
 * Eligible monthly draw entries for one month — excludes outright skill winners and entries already drawn.
 * @param {string} drawMonth
 */
export async function fetchWorldCupBallMonthlyDrawPool(drawMonth) {
  if (!drawMonth) return []
  await ensureWorldCupBallMonthlyDrawRunsSchema()

  const r = await query(
    `SELECT
      e.id,
      e.session_id,
      e.draw_month,
      e.entry_number,
      e.ip_address,
      e.outcome,
      e.created_at,
      s.status AS session_status
    FROM world_cup_ball_monthly_draw_entries e
    LEFT JOIN world_cup_ball_sessions s ON s.id = e.session_id
    WHERE e.draw_month = $1
      AND e.id NOT IN (
        SELECT winning_entry_id FROM world_cup_ball_monthly_draw_runs WHERE winning_entry_id IS NOT NULL
      )
      AND (s.status IS NULL OR s.status NOT IN ('won', 'claimed'))
    ORDER BY e.created_at ASC`,
    [drawMonth],
  )

  return r.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    drawMonth: row.draw_month,
    entryNumber: row.entry_number,
    ipAddress: row.ip_address || '',
    outcome: row.outcome || 'lost',
    createdAt: row.created_at,
    sessionStatus: row.session_status || null,
  }))
}

export async function listWorldCupBallMonthlyDrawMonthsWithCounts() {
  await ensureWorldCupBallMonthlyDrawRunsSchema()
  const r = await query(
    `SELECT draw_month, COUNT(*)::int AS entry_count
     FROM world_cup_ball_monthly_draw_entries
     GROUP BY draw_month
     ORDER BY draw_month ASC`,
  )
  const counts = new Map(r.rows.map((row) => [row.draw_month, Number(row.entry_count ?? 0)]))
  const months = new Set([...WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS, ...counts.keys()])

  return [...months]
    .sort()
    .map((drawMonth) => ({
      drawMonth,
      label: formatWorldCupBallDrawMonthLabel(drawMonth),
      entryCount: counts.get(drawMonth) ?? 0,
    }))
}

export async function listWorldCupBallMonthlyDrawRuns({ drawMonth, limit = 20 } = {}) {
  await ensureWorldCupBallMonthlyDrawRunsSchema()
  const lim = Math.min(50, Math.max(1, limit))
  const params = []
  let where = ''
  if (drawMonth) {
    params.push(drawMonth)
    where = 'WHERE draw_month = $1'
  }
  const r = await query(
    `SELECT id, draw_month, pool_size, random_index, winning_entry_id, winning_entry_number,
            session_id, ip_address, admin_notes, drawn_at
     FROM world_cup_ball_monthly_draw_runs
     ${where}
     ORDER BY drawn_at DESC
     LIMIT ${lim}`,
    params,
  )
  return r.rows
}

export async function fetchWorldCupBallMonthlyDrawSummary(drawMonth) {
  if (!drawMonth) {
    return {
      drawMonth: '',
      drawMonthLabel: '',
      poolSize: 0,
      uniqueIps: 0,
      pool: [],
      canDraw: false,
      alreadyDrawn: false,
      history: [],
      months: await listWorldCupBallMonthlyDrawMonthsWithCounts(),
    }
  }

  await ensureWorldCupBallMonthlyDrawRunsSchema()
  const [pool, history, months] = await Promise.all([
    fetchWorldCupBallMonthlyDrawPool(drawMonth),
    listWorldCupBallMonthlyDrawRuns({ drawMonth, limit: 10 }),
    listWorldCupBallMonthlyDrawMonthsWithCounts(),
  ])

  const uniqueIps = new Set(pool.map((row) => row.ipAddress).filter(Boolean)).size
  const alreadyDrawn = history.length > 0

  return {
    drawMonth,
    drawMonthLabel: formatWorldCupBallDrawMonthLabel(drawMonth),
    poolSize: pool.length,
    uniqueIps,
    pool: pool.slice(0, 200),
    canDraw: pool.length > 0 && !alreadyDrawn,
    alreadyDrawn,
    history,
    months,
  }
}

/**
 * @param {{ drawMonth: string, adminNotes?: string }} params
 */
export async function runWorldCupBallMonthlyDraw({ drawMonth, adminNotes = '' } = {}) {
  if (!drawMonth || !/^\d{4}-\d{2}$/.test(drawMonth)) {
    return { ok: false, error: 'drawMonth is required (YYYY-MM).' }
  }

  await ensureWorldCupBallMonthlyDrawRunsSchema()

  const prior = await countWorldCupBallMonthlyDrawRuns(drawMonth)
  if (prior > 0) {
    return {
      ok: false,
      error:
        'A winner has already been recorded for this month. The audit log preserves that result — use a different month for another draw.',
    }
  }

  const pool = await fetchWorldCupBallMonthlyDrawPool(drawMonth)
  if (!pool.length) {
    return {
      ok: false,
      error:
        'No eligible monthly draw entries for this month. Confirm failed quiz attempts are awarding draw entries (Entry log: world_cup_ball_monthly_draw).',
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
  const notes =
    typeof adminNotes === 'string' && adminNotes.trim() ? adminNotes.trim().slice(0, 2000) : null

  await query(
    `INSERT INTO world_cup_ball_monthly_draw_runs (
      id, draw_month, pool_size, random_index, winning_entry_id, winning_entry_number,
      session_id, ip_address, admin_notes, drawn_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      drawId,
      drawMonth,
      pool.length,
      randomIndex,
      winner.id,
      winner.entryNumber,
      winner.sessionId || null,
      winner.ipAddress || '',
      notes,
      drawnAt,
    ],
  )

  return {
    ok: true,
    drawId,
    drawMonth,
    drawMonthLabel: formatWorldCupBallDrawMonthLabel(drawMonth),
    poolSize: pool.length,
    randomIndex,
    drawnAt,
    winner: {
      entryId: winner.id,
      entryNumber: winner.entryNumber,
      sessionId: winner.sessionId,
      ipAddress: winner.ipAddress,
      outcome: winner.outcome,
      createdAt: winner.createdAt,
    },
    notes,
  }
}
