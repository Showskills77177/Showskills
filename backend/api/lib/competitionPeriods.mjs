import { randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'
import {
  DRAW_COMPETITION_SLUG,
  PERIOD_STATUS,
  isPeriodEligibleForDraw,
} from '../../../shared/competitionPeriods.mjs'

let schemaEnsured = false

export async function ensureCompetitionPeriodsSchema() {
  if (schemaEnsured) return
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS competition_periods (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        entry_opens_at TIMESTAMPTZ NOT NULL,
        entry_closes_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_competition_periods_comp ON competition_periods (competition, entry_closes_at DESC)`,
    )
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS competition_periods (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        entry_opens_at TEXT NOT NULL,
        entry_closes_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_competition_periods_comp ON competition_periods (competition, entry_closes_at)`,
    )
  }
  schemaEnsured = true
}

function mapPeriodRow(row) {
  if (!row) return null
  return {
    id: row.id,
    competition: row.competition,
    title: row.title,
    summary: row.summary || '',
    entryOpensAt: row.entry_opens_at,
    entryClosesAt: row.entry_closes_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureDefaultCompetitionPeriod(competition = DRAW_COMPETITION_SLUG) {
  await ensureCompetitionPeriodsSchema()
  const existing = await query(
    `SELECT id FROM competition_periods WHERE competition = $1 LIMIT 1`,
    [competition],
  )
  if (existing.rows[0]) return getCompetitionPeriodById(existing.rows[0].id)

  const id = 'legacy-inaugural'
  const now = new Date()
  const opens = new Date('2025-01-01T00:00:00.000Z').toISOString()
  const closes = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
  await query(
    `INSERT INTO competition_periods (
      id, competition, title, summary, entry_opens_at, entry_closes_at, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      competition,
      'Ronaldo Legacy Bundle — Inaugural Competition',
      'Initial competition period. Close this period when entries end, then run the draw from the isolated pool.',
      opens,
      closes,
      PERIOD_STATUS.open,
    ],
  )
  const r = await query(`SELECT * FROM competition_periods WHERE id = $1`, [id])
  return mapPeriodRow(r.rows[0])
}

export async function listCompetitionPeriods(competition = DRAW_COMPETITION_SLUG) {
  await ensureCompetitionPeriodsSchema()
  const r = await query(
    `SELECT * FROM competition_periods WHERE competition = $1 ORDER BY entry_closes_at DESC`,
    [competition],
  )
  return r.rows.map(mapPeriodRow)
}

export async function getCompetitionPeriodById(periodId) {
  await ensureCompetitionPeriodsSchema()
  const r = await query(`SELECT * FROM competition_periods WHERE id = $1`, [periodId])
  return mapPeriodRow(r.rows[0])
}

const LOCAL_DEV_PERIOD_ID = 'local-dev-open'

/**
 * When no period is open (common on a fresh SQLite DB after tests), ensure one open period
 * for local API only — never on Vercel production.
 */
export async function ensureLocalDevEntryPeriod(competition = DRAW_COMPETITION_SLUG) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return null
  const open = await getOpenCompetitionPeriod(competition)
  if (open) return open

  const existing = await getCompetitionPeriodById(LOCAL_DEV_PERIOD_ID)
  if (existing?.status === PERIOD_STATUS.open) return existing

  const now = new Date()
  const opens = now.toISOString()
  const closes = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()

  if (existing) {
    await updateCompetitionPeriodStatus(LOCAL_DEV_PERIOD_ID, PERIOD_STATUS.open)
    return getCompetitionPeriodById(LOCAL_DEV_PERIOD_ID)
  }

  await query(
    `INSERT INTO competition_periods (
      id, competition, title, summary, entry_opens_at, entry_closes_at, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      LOCAL_DEV_PERIOD_ID,
      competition,
      'Local development entries',
      'Auto-created for npm run dev:api / dev:all when no competition period is open.',
      opens,
      closes,
      PERIOD_STATUS.open,
      now.toISOString(),
    ],
  )
  return getCompetitionPeriodById(LOCAL_DEV_PERIOD_ID)
}

const ENTRIES_CLOSED_MESSAGE =
  'No competition is currently open for entries. Please try again later or contact us at contact@showskills.co.uk.'

/** Period that new ticket purchases and online entries are assigned to. */
export async function getOpenCompetitionPeriodForEntry(competition = DRAW_COMPETITION_SLUG) {
  let period = await getOpenCompetitionPeriod(competition)
  if (!period) {
    period = await ensureLocalDevEntryPeriod(competition)
  }
  if (!period) {
    await ensureDefaultCompetitionPeriod(competition)
    period = await getOpenCompetitionPeriod(competition)
  }
  if (!period) {
    return { ok: false, error: ENTRIES_CLOSED_MESSAGE }
  }
  return { ok: true, period }
}

export async function getOpenCompetitionPeriod(competition = DRAW_COMPETITION_SLUG) {
  await ensureCompetitionPeriodsSchema()
  const r = await query(
    `SELECT * FROM competition_periods
     WHERE competition = $1 AND status = $2
     ORDER BY entry_closes_at DESC LIMIT 1`,
    [competition, PERIOD_STATUS.open],
  )
  return mapPeriodRow(r.rows[0])
}

export async function createCompetitionPeriod({
  competition = DRAW_COMPETITION_SLUG,
  title,
  summary = '',
  entryOpensAt,
  entryClosesAt,
  status = PERIOD_STATUS.draft,
}) {
  await ensureCompetitionPeriodsSchema()
  const id = `legacy-${Date.now().toString(36)}`
  const opens = new Date(entryOpensAt).toISOString()
  const closes = new Date(entryClosesAt).toISOString()
  if (!(closes > opens)) {
    return { ok: false, error: 'Close time must be after open time.' }
  }
  await query(
    `INSERT INTO competition_periods (
      id, competition, title, summary, entry_opens_at, entry_closes_at, status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, competition, title.trim(), summary.trim(), opens, closes, status, new Date().toISOString()],
  )
  return { ok: true, period: await getCompetitionPeriodById(id) }
}

export async function updateCompetitionPeriodStatus(periodId, status) {
  await ensureCompetitionPeriodsSchema()
  const period = await getCompetitionPeriodById(periodId)
  if (!period) return { ok: false, error: 'Competition period not found.' }

  const allowed = new Set(Object.values(PERIOD_STATUS))
  if (!allowed.has(status)) return { ok: false, error: 'Invalid period status.' }

  if (status === PERIOD_STATUS.open) {
    await query(
      `UPDATE competition_periods SET status = $1, updated_at = $2
       WHERE competition = $3 AND status = $4 AND id <> $5`,
      [PERIOD_STATUS.closed, new Date().toISOString(), period.competition, PERIOD_STATUS.open, periodId],
    )
  }

  await query(
    `UPDATE competition_periods SET status = $1, updated_at = $2 WHERE id = $3`,
    [status, new Date().toISOString(), periodId],
  )
  return { ok: true, period: await getCompetitionPeriodById(periodId) }
}

export async function markPeriodDrawn(periodId) {
  return updateCompetitionPeriodStatus(periodId, PERIOD_STATUS.drawn)
}

export async function countDrawRunsForPeriod(periodId) {
  const r = await query(`SELECT COUNT(*)::int AS c FROM draw_runs WHERE period_id = $1`, [periodId])
  return Number(r.rows[0]?.c ?? 0)
}

export function validatePeriodForDraw(period) {
  if (!period) {
    return { ok: false, error: 'Select a competition period before running the draw.' }
  }
  if (!isPeriodEligibleForDraw(period.status)) {
    return {
      ok: false,
      error:
        period.status === PERIOD_STATUS.drawn
          ? 'This competition period has already been drawn. Select another period or create a new one.'
          : 'Close this competition period before running the draw. Open periods may still receive entries and must not be mixed into a final draw.',
    }
  }
  return { ok: true }
}

export async function resolvePeriodForAdmin(competition, periodId) {
  await ensureDefaultCompetitionPeriod(competition)
  if (periodId) {
    const period = await getCompetitionPeriodById(periodId)
    if (!period || period.competition !== competition) {
      return { ok: false, error: 'Competition period not found.' }
    }
    return { ok: true, period }
  }
  const periods = await listCompetitionPeriods(competition)
  const preferred =
    periods.find((p) => p.status === PERIOD_STATUS.closed) ||
    periods.find((p) => p.status === PERIOD_STATUS.open) ||
    periods[0]
  return { ok: true, period: preferred, periods }
}
