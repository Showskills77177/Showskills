import { query, dbIsPostgres } from './db.mjs'
import { defaultHomepageLayout, mergeHomepageLayout } from '../../../shared/homepageLayout.mjs'

const ROW_ID = 'homepage'

export async function ensureHomepageLayoutSchema() {
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS site_layout_config (
        id TEXT PRIMARY KEY,
        config_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS site_layout_config (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
  }
}

function parseConfigRow(row) {
  if (!row?.config_json) return defaultHomepageLayout()
  try {
    const raw = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json
    return mergeHomepageLayout(raw)
  } catch {
    return defaultHomepageLayout()
  }
}

export async function getHomepageLayout() {
  await ensureHomepageLayoutSchema()
  const r = await query(`SELECT config_json FROM site_layout_config WHERE id = $1 LIMIT 1`, [ROW_ID])
  if (!r.rows?.length) return defaultHomepageLayout()
  return parseConfigRow(r.rows[0])
}

export async function saveHomepageLayout(config) {
  await ensureHomepageLayoutSchema()
  const merged = mergeHomepageLayout(config)
  const now = new Date().toISOString()
  const json = JSON.stringify(merged)
  if (dbIsPostgres()) {
    await query(
      `INSERT INTO site_layout_config (id, config_json, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = EXCLUDED.updated_at`,
      [ROW_ID, json, now],
    )
  } else {
    await query(
      `INSERT INTO site_layout_config (id, config_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`,
      [ROW_ID, json, now],
    )
  }
  return merged
}
