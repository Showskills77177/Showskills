import { query, dbIsPostgres } from './db.mjs'

const PASSWORD_KEY = 'password_hash'

export async function ensureAdminPasswordSchema() {
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    return
  }

  await query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export async function getStoredAdminPasswordHash() {
  await ensureAdminPasswordSchema()
  const { rows } = await query('SELECT value FROM admin_settings WHERE key = $1 LIMIT 1', [PASSWORD_KEY])
  const hash = rows[0]?.value
  return typeof hash === 'string' && hash.startsWith('$2') ? hash.trim() : null
}

export async function setStoredAdminPasswordHash(hash) {
  await ensureAdminPasswordSchema()
  if (dbIsPostgres()) {
    await query(
      `
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `,
      [PASSWORD_KEY, hash],
    )
    return
  }

  await query(
    `
    INSERT INTO admin_settings (key, value, updated_at)
    VALUES ($1, $2, datetime('now'))
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `,
    [PASSWORD_KEY, hash],
  )
}
