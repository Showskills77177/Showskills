/**
 * EOF daily Short scheduler settings (single-row config).
 */
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'

let ensured = false

export async function ensureEofSchedulerSchema() {
  await ensureEofProductionSchema()
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_scheduler_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        enabled INTEGER NOT NULL DEFAULT 0,
        hour_utc INTEGER NOT NULL DEFAULT 9,
        minute_utc INTEGER NOT NULL DEFAULT 0,
        format TEXT NOT NULL DEFAULT 'news',
        voice_preset TEXT NOT NULL DEFAULT 'british',
        publish_delay_minutes INTEGER NOT NULL DEFAULT 30,
        last_run_at TIMESTAMPTZ,
        last_job_id TEXT,
        last_project_id TEXT,
        last_error TEXT,
        last_status TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_scheduler_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        enabled INTEGER NOT NULL DEFAULT 0,
        hour_utc INTEGER NOT NULL DEFAULT 9,
        minute_utc INTEGER NOT NULL DEFAULT 0,
        format TEXT NOT NULL DEFAULT 'news',
        voice_preset TEXT NOT NULL DEFAULT 'british',
        publish_delay_minutes INTEGER NOT NULL DEFAULT 30,
        last_run_at TEXT,
        last_job_id TEXT,
        last_project_id TEXT,
        last_error TEXT,
        last_status TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  const { rows } = await query(`SELECT id FROM eof_scheduler_settings WHERE id = 'default'`)
  if (!rows[0]) {
    await query(
      `INSERT INTO eof_scheduler_settings (id, enabled, hour_utc, minute_utc, format, voice_preset, publish_delay_minutes)
       VALUES ('default', 0, 9, 0, 'news', 'british', 30)`,
    )
  } else {
    // One-time: stop burning ElevenLabs on the default scheduler row
    await query(
      `UPDATE eof_scheduler_settings SET voice_preset = 'british' WHERE id = 'default' AND voice_preset = 'brian'`,
    )
  }

  ensured = true
}

function rowToSettings(row) {
  if (!row) return null
  return {
    id: row.id || 'default',
    enabled: Boolean(Number(row.enabled)),
    hourUtc: Number(row.hour_utc) || 9,
    minuteUtc: Number(row.minute_utc) || 0,
    format: row.format || 'news',
    voicePreset: row.voice_preset || 'british',
    publishDelayMinutes: Math.max(0, Number(row.publish_delay_minutes) || 30),
    lastRunAt: row.last_run_at || null,
    lastJobId: row.last_job_id || null,
    lastProjectId: row.last_project_id || null,
    lastError: row.last_error || null,
    lastStatus: row.last_status || null,
    updatedAt: row.updated_at || null,
  }
}

export async function getEofSchedulerSettings() {
  await ensureEofSchedulerSchema()
  const { rows } = await query(`SELECT * FROM eof_scheduler_settings WHERE id = 'default'`)
  return rowToSettings(rows[0]) || {
    id: 'default',
    enabled: false,
    hourUtc: 9,
    minuteUtc: 0,
    format: 'news',
    voicePreset: 'british',
    publishDelayMinutes: 30,
    lastRunAt: null,
    lastJobId: null,
    lastProjectId: null,
    lastError: null,
    lastStatus: null,
    updatedAt: null,
  }
}

export async function updateEofSchedulerSettings(patch = {}) {
  await ensureEofSchedulerSchema()
  const current = await getEofSchedulerSettings()
  const enabled = patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : current.enabled ? 1 : 0
  const hourUtc = patch.hourUtc !== undefined ? Math.min(23, Math.max(0, Number(patch.hourUtc) || 0)) : current.hourUtc
  const minuteUtc =
    patch.minuteUtc !== undefined ? Math.min(59, Math.max(0, Number(patch.minuteUtc) || 0)) : current.minuteUtc
  const format = typeof patch.format === 'string' && patch.format.trim() ? patch.format.trim() : current.format
  const voicePreset =
    typeof patch.voicePreset === 'string' && patch.voicePreset.trim()
      ? patch.voicePreset.trim()
      : current.voicePreset
  const publishDelayMinutes =
    patch.publishDelayMinutes !== undefined
      ? Math.min(24 * 60, Math.max(0, Number(patch.publishDelayMinutes) || 0))
      : current.publishDelayMinutes

  const nowSql = dbIsPostgres() ? 'now()' : `datetime('now')`
  await query(
    `UPDATE eof_scheduler_settings
     SET enabled = $2,
         hour_utc = $3,
         minute_utc = $4,
         format = $5,
         voice_preset = $6,
         publish_delay_minutes = $7,
         updated_at = ${nowSql}
     WHERE id = $1`,
    ['default', enabled, hourUtc, minuteUtc, format, voicePreset, publishDelayMinutes],
  )
  return getEofSchedulerSettings()
}

export async function markEofSchedulerRun({ status, jobId = null, projectId = null, error = null }) {
  await ensureEofSchedulerSchema()
  const nowSql = dbIsPostgres() ? 'now()' : `datetime('now')`
  await query(
    `UPDATE eof_scheduler_settings
     SET last_run_at = ${nowSql},
         last_status = $2,
         last_job_id = $3,
         last_project_id = $4,
         last_error = $5,
         updated_at = ${nowSql}
     WHERE id = $1`,
    ['default', status || null, jobId, projectId, error ? String(error).slice(0, 500) : null],
  )
  return getEofSchedulerSettings()
}
