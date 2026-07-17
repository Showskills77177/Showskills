/**
 * EOF Google Images provider preference (SerpAPI vs Oxylabs).
 * Credentials stay in env; only the preferred provider id is persisted.
 */
import { query, dbIsPostgres } from './db.mjs'
import { ensureEofProductionSchema } from './ensureEofProductionSchema.mjs'
import { isEofSerpApiConfigured } from './eofSerpApiImages.mjs'
import { isEofOxylabsConfigured } from './eofOxylabsImages.mjs'

const ROW_ID = 'default'
export const EOF_IMAGE_PROVIDER_IDS = new Set(['auto', 'serpapi', 'oxylabs'])

let ensured = false

export function normalizeEofImageProvider(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (v === 'serp' || v === 'serp_api' || v === 'google_serpapi') return 'serpapi'
  if (v === 'oxy' || v === 'oxy_labs') return 'oxylabs'
  if (EOF_IMAGE_PROVIDER_IDS.has(v)) return v
  return 'auto'
}

/**
 * Ordered Google Images job-pool providers (1 billable query each).
 * Preferred provider first when configured; other configured provider remains as fallback.
 * `auto` = SerpAPI then Oxylabs (current default).
 */
export function resolveEofImageProviderAttemptOrder(
  preferred,
  { serpapi = false, oxylabs = false } = {},
) {
  const pick = normalizeEofImageProvider(preferred)
  const available = []
  if (serpapi) available.push('serpapi')
  if (oxylabs) available.push('oxylabs')
  if (!available.length) return []

  if (pick === 'serpapi' && serpapi) {
    return ['serpapi', ...available.filter((id) => id !== 'serpapi')]
  }
  if (pick === 'oxylabs' && oxylabs) {
    return ['oxylabs', ...available.filter((id) => id !== 'oxylabs')]
  }
  // auto, or preferred not keyed → SerpAPI-first when both available
  return available
}

export function listEofImageProviderOptions() {
  const serpapi = isEofSerpApiConfigured()
  const oxylabs = isEofOxylabsConfigured()
  return [
    {
      id: 'auto',
      label: 'Auto (SerpAPI → Oxylabs)',
      configured: true,
      detail: 'Try SerpAPI first when keyed, then Oxylabs, then AP/CSE/…',
    },
    {
      id: 'serpapi',
      label: 'SerpAPI',
      configured: serpapi,
      detail: serpapi
        ? 'Prefer SerpAPI for the Google Images job pool (Oxylabs still falls back).'
        : 'Add SERPAPI_API_KEY on Vercel staging and redeploy.',
    },
    {
      id: 'oxylabs',
      label: 'Oxylabs',
      configured: oxylabs,
      detail: oxylabs
        ? 'Prefer Oxylabs for the Google Images job pool (SerpAPI still falls back).'
        : 'Add OXYLABS_USERNAME + OXYLABS_PASSWORD on Vercel staging and redeploy.',
    },
  ]
}

export function eofImageProviderConfigurationNote(preferred = 'auto') {
  const pick = normalizeEofImageProvider(preferred)
  const serpapi = isEofSerpApiConfigured()
  const oxylabs = isEofOxylabsConfigured()
  const order = resolveEofImageProviderAttemptOrder(pick, { serpapi, oxylabs })

  if (pick === 'serpapi') {
    if (!serpapi) {
      return 'Google Images: SerpAPI selected but SERPAPI_API_KEY is missing — using the next available source.'
    }
    return oxylabs
      ? 'Google Images: SerpAPI preferred (1 search/Short). Oxylabs + AP/CSE fallback when needed.'
      : 'Google Images: SerpAPI preferred (1 search/Short). Oxylabs not keyed — AP/CSE/Pexels next.'
  }
  if (pick === 'oxylabs') {
    if (!oxylabs) {
      return 'Google Images: Oxylabs selected but credentials are missing — using the next available source.'
    }
    return serpapi
      ? 'Google Images: Oxylabs preferred (1 search/Short). SerpAPI + AP/CSE fallback when needed.'
      : 'Google Images: Oxylabs preferred (1 search/Short). SerpAPI not keyed — AP/CSE/Pexels next.'
  }

  if (order[0] === 'serpapi') {
    return 'Google Images: Auto — SerpAPI first (1 search/Short), then Oxylabs/AP/CSE when needed.'
  }
  if (order[0] === 'oxylabs') {
    return 'Google Images: Auto — Oxylabs (1 search/Short). Wikimedia last-resort when empty.'
  }
  return null
}

export async function ensureEofImageProviderSchema() {
  await ensureEofProductionSchema()
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_image_provider_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        image_provider TEXT NOT NULL DEFAULT 'auto',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS eof_image_provider_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        image_provider TEXT NOT NULL DEFAULT 'auto',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  const { rows } = await query(`SELECT id FROM eof_image_provider_settings WHERE id = $1`, [ROW_ID])
  if (!rows[0]) {
    await query(`INSERT INTO eof_image_provider_settings (id, image_provider) VALUES ($1, 'auto')`, [
      ROW_ID,
    ])
  }
  ensured = true
}

function rowToSettings(row) {
  if (!row) return null
  return {
    id: row.id || ROW_ID,
    imageProvider: normalizeEofImageProvider(row.image_provider),
    updatedAt: row.updated_at || null,
  }
}

export async function getEofImageProviderSettings() {
  await ensureEofImageProviderSchema()
  const { rows } = await query(`SELECT * FROM eof_image_provider_settings WHERE id = $1`, [ROW_ID])
  return (
    rowToSettings(rows[0]) || {
      id: ROW_ID,
      imageProvider: 'auto',
      updatedAt: null,
    }
  )
}

export async function updateEofImageProviderSettings(patch = {}) {
  await ensureEofImageProviderSchema()
  const current = await getEofImageProviderSettings()
  const imageProvider =
    patch.imageProvider !== undefined
      ? normalizeEofImageProvider(patch.imageProvider)
      : current.imageProvider

  const nowSql = dbIsPostgres() ? 'now()' : `datetime('now')`
  await query(
    `UPDATE eof_image_provider_settings
     SET image_provider = $2,
         updated_at = ${nowSql}
     WHERE id = $1`,
    [ROW_ID, imageProvider],
  )
  return getEofImageProviderSettings()
}
