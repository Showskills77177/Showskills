import { query, dbIsPostgres } from './db.mjs'

let ensured = false

/** Idempotent DDL for public account passwords on the users table. */
export async function ensureUserAuthSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`)
  } else {
    try {
      await query(`ALTER TABLE users ADD COLUMN password_hash TEXT`)
    } catch {
      /* column already exists */
    }
    try {
      await query(`ALTER TABLE users ADD COLUMN last_login_at TEXT`)
    } catch {
      /* column already exists */
    }
  }

  ensured = true
}

export function resetUserAuthSchemaCache() {
  ensured = false
}
