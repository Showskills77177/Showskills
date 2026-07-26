/**
 * EOF Production build mode: Pro (full quality) vs Hobby (slim).
 * Persisted like image-provider settings so admin UI + scheduler share one preference.
 * Env EOF_FORCE_SLIM=1 (or legacy EOF_SERVERLESS_SLIM=1) hard-overrides to Hobby slim.
 */
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { isEofForceSlim, EOF_SERVERLESS_MAX_SCENES } from './eofProductionServerless.mjs'

const ROW_ID = 'default'
export const EOF_BUILD_MODE_IDS = new Set(['pro', 'hobby'])

let ensured = false

export function normalizeEofBuildMode(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (v === 'slim' || v === 'hobby-slim' || v === 'serverless') return 'hobby'
  if (v === 'full' || v === 'quality' || v === 'pro-full') return 'pro'
  if (EOF_BUILD_MODE_IDS.has(v)) return v
  return 'pro'
}

export function listEofBuildModeOptions() {
  return [
    {
      id: 'pro',
      label: 'Pro',
      detail:
        'Pro path under Vercel maxDuration 300 — reliable encode (hard cuts, no Ken Burns/overlays on Vercel). Local keeps full CapCut look.',
    },
    {
      id: 'hobby',
      label: 'Hobby (slim)',
      detail: `Slim encode for Hobby limits — first ${EOF_SERVERLESS_MAX_SCENES} scenes, hard cuts, overlays off.`,
    },
  ]
}

export function eofBuildModeNote(mode = 'pro', { envForced = false } = {}) {
  if (envForced) {
    return 'Build mode locked to Hobby (slim) by EOF_FORCE_SLIM on the server.'
  }
  const pick = normalizeEofBuildMode(mode)
  if (pick === 'hobby') {
    return `Hobby (slim): first ${EOF_SERVERLESS_MAX_SCENES} scenes, hard cuts, overlays off.`
  }
  return 'Pro: full CapCut-style pipeline (overlays, transitions, more scenes).'
}

async function ensureEofBuildModeSchema() {
  await ensureEofProductionSchema()
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_build_mode_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        build_mode TEXT NOT NULL DEFAULT 'pro',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_build_mode_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        build_mode TEXT NOT NULL DEFAULT 'pro',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  const { rows } = await query(`SELECT id FROM eof_build_mode_settings WHERE id = $1`, [ROW_ID])
  if (!rows[0]) {
    await query(`INSERT INTO eof_build_mode_settings (id, build_mode) VALUES ($1, 'pro')`, [ROW_ID])
  }
  ensured = true
}

function rowToSettings(row) {
  if (!row) return null
  return {
    id: row.id || ROW_ID,
    buildMode: normalizeEofBuildMode(row.build_mode),
    updatedAt: row.updated_at || null,
    envForcedSlim: isEofForceSlim(),
    effectiveMode: isEofForceSlim() ? 'hobby' : normalizeEofBuildMode(row.build_mode),
  }
}

export async function getEofBuildModeSettings() {
  await ensureEofBuildModeSchema()
  const { rows } = await query(`SELECT * FROM eof_build_mode_settings WHERE id = $1`, [ROW_ID])
  return (
    rowToSettings(rows[0]) || {
      id: ROW_ID,
      buildMode: 'pro',
      updatedAt: null,
      envForcedSlim: isEofForceSlim(),
      effectiveMode: isEofForceSlim() ? 'hobby' : 'pro',
    }
  )
}

export async function updateEofBuildModeSettings(patch = {}) {
  await ensureEofBuildModeSchema()
  const current = await getEofBuildModeSettings()
  const buildMode =
    patch.buildMode !== undefined ? normalizeEofBuildMode(patch.buildMode) : current.buildMode

  const nowSql = dbIsPostgres() ? 'now()' : `datetime('now')`
  await query(
    `UPDATE eof_build_mode_settings
     SET build_mode = $2,
         updated_at = ${nowSql}
     WHERE id = $1`,
    [ROW_ID, buildMode],
  )
  return getEofBuildModeSettings()
}

/**
 * True when Hobby slim constraints should apply:
 * env hard override OR persisted build mode = hobby.
 */
export async function isEofSlimBuildEnabled() {
  if (isEofForceSlim()) return true
  const settings = await getEofBuildModeSettings()
  return settings.buildMode === 'hobby'
}
