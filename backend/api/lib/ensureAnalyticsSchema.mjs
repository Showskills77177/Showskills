import { query, dbIsPostgres } from './db.mjs'

let ensured = false

export async function ensureAnalyticsSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS site_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL,
        path TEXT NOT NULL,
        country_code TEXT,
        country_name TEXT,
        traffic_source TEXT NOT NULL DEFAULT 'Direct',
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        referrer_host TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_created ON site_visits (created_at DESC)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_session ON site_visits (session_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_country ON site_visits (country_code)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_source ON site_visits (traffic_source)`)
    await query(`
      CREATE TABLE IF NOT EXISTS impression_milestone_alerts (
        milestone_count INTEGER PRIMARY KEY,
        notified_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    try {
      await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS country_code TEXT`)
    } catch {
      /* sqlite-only branch */
    }
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS site_visits (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        path TEXT NOT NULL,
        country_code TEXT,
        country_name TEXT,
        traffic_source TEXT NOT NULL DEFAULT 'Direct',
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        referrer_host TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_created ON site_visits (created_at)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_session ON site_visits (session_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_country ON site_visits (country_code)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_site_visits_source ON site_visits (traffic_source)`)
    await query(`
      CREATE TABLE IF NOT EXISTS impression_milestone_alerts (
        milestone_count INTEGER PRIMARY KEY,
        notified_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    try {
      await query(`ALTER TABLE payments ADD COLUMN country_code TEXT`)
    } catch {
      /* already exists */
    }
  }

  ensured = true
}
