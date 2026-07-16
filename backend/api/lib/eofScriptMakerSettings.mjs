/**
 * EOF Script Maker scheduler — overnight draft prep (no video / no YouTube).
 * Separate from the daily auto-publish scheduler.
 */
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'

const ROW_ID = 'script_maker'
let ensured = false

export async function ensureEofScriptMakerSchema() {
  await ensureEofProductionSchema()
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_script_maker_settings (
        id TEXT PRIMARY KEY DEFAULT 'script_maker',
        enabled INTEGER NOT NULL DEFAULT 0,
        hour_utc INTEGER NOT NULL DEFAULT 22,
        minute_utc INTEGER NOT NULL DEFAULT 0,
        target_count INTEGER NOT NULL DEFAULT 5,
        format_mix TEXT NOT NULL DEFAULT 'mixed',
        last_run_at TIMESTAMPTZ,
        last_status TEXT,
        last_error TEXT,
        last_job_ids_json TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_script_maker_settings (
        id TEXT PRIMARY KEY DEFAULT 'script_maker',
        enabled INTEGER NOT NULL DEFAULT 0,
        hour_utc INTEGER NOT NULL DEFAULT 22,
        minute_utc INTEGER NOT NULL DEFAULT 0,
        target_count INTEGER NOT NULL DEFAULT 5,
        format_mix TEXT NOT NULL DEFAULT 'mixed',
        last_run_at TEXT,
        last_status TEXT,
        last_error TEXT,
        last_job_ids_json TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  const { rows } = await query(`SELECT id FROM eof_script_maker_settings WHERE id = $1`, [ROW_ID])
  if (!rows[0]) {
    await query(
      `INSERT INTO eof_script_maker_settings (id, enabled, hour_utc, minute_utc, target_count, format_mix)
       VALUES ($1, 0, 22, 0, 5, 'mixed')`,
      [ROW_ID],
    )
  }
  ensured = true
}

function parseJobIds(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function rowToSettings(row) {
  if (!row) return null
  return {
    id: row.id || ROW_ID,
    enabled: Boolean(Number(row.enabled)),
    hourUtc: Number(row.hour_utc) ?? 22,
    minuteUtc: Number(row.minute_utc) || 0,
    targetCount: Math.min(12, Math.max(1, Number(row.target_count) || 5)),
    formatMix: ['mixed', 'news', 'quote'].includes(row.format_mix) ? row.format_mix : 'mixed',
    lastRunAt: row.last_run_at || null,
    lastStatus: row.last_status || null,
    lastError: row.last_error || null,
    lastJobIds: parseJobIds(row.last_job_ids_json),
    updatedAt: row.updated_at || null,
  }
}

export async function getEofScriptMakerSettings() {
  await ensureEofScriptMakerSchema()
  const { rows } = await query(`SELECT * FROM eof_script_maker_settings WHERE id = $1`, [ROW_ID])
  return (
    rowToSettings(rows[0]) || {
      id: ROW_ID,
      enabled: false,
      hourUtc: 22,
      minuteUtc: 0,
      targetCount: 5,
      formatMix: 'mixed',
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
      lastJobIds: [],
      updatedAt: null,
    }
  )
}

export async function updateEofScriptMakerSettings(patch = {}) {
  await ensureEofScriptMakerSchema()
  const current = await getEofScriptMakerSettings()
  const enabled = patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled ? 1 : 0
  const hourUtc =
    patch.hourUtc !== undefined ? Math.min(23, Math.max(0, Number(patch.hourUtc) || 0)) : current.hourUtc
  const minuteUtc =
    patch.minuteUtc !== undefined
      ? Math.min(59, Math.max(0, Number(patch.minuteUtc) || 0))
      : current.minuteUtc
  const targetCount =
    patch.targetCount !== undefined
      ? Math.min(12, Math.max(1, Number(patch.targetCount) || 5))
      : current.targetCount
  const formatMix =
    typeof patch.formatMix === 'string' && ['mixed', 'news', 'quote'].includes(patch.formatMix.trim())
      ? patch.formatMix.trim()
      : current.formatMix

  const nowSql = dbIsPostgres() ? 'now()' : `datetime('now')`
  await query(
    `UPDATE eof_script_maker_settings
     SET enabled = $2,
         hour_utc = $3,
         minute_utc = $4,
         target_count = $5,
         format_mix = $6,
         updated_at = ${nowSql}
     WHERE id = $1`,
    [ROW_ID, enabled, hourUtc, minuteUtc, targetCount, formatMix],
  )
  return getEofScriptMakerSettings()
}

export async function markEofScriptMakerRun({ status, jobIds = [], error = null }) {
  await ensureEofScriptMakerSchema()
  const nowSql = dbIsPostgres() ? 'now()' : `datetime('now')`
  await query(
    `UPDATE eof_script_maker_settings
     SET last_run_at = ${nowSql},
         last_status = $2,
         last_job_ids_json = $3,
         last_error = $4,
         updated_at = ${nowSql}
     WHERE id = $1`,
    [
      ROW_ID,
      status || null,
      JSON.stringify(Array.isArray(jobIds) ? jobIds.slice(0, 20) : []),
      error ? String(error).slice(0, 500) : null,
    ],
  )
  return getEofScriptMakerSettings()
}
