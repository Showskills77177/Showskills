import { query, dbIsPostgres } from './db.mjs'

let ensured = false

/** Create users table + auth columns idempotently (Neon may only have newsletter tables until first purchase). */
export async function ensureUserAuthSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    try {
      await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)
    } catch {
      /* not always allowed on managed Postgres */
    }

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '',
        password_hash TEXT,
        phone TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        address_json TEXT,
        delivery_address_json TEXT
      )
    `)
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email))`,
    )
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address_json TEXT`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_address_json TEXT`)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '',
        password_hash TEXT,
        phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT,
        address_json TEXT,
        delivery_address_json TEXT
      )
    `)
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email))`,
    )
    for (const ddl of [
      `ALTER TABLE users ADD COLUMN password_hash TEXT`,
      `ALTER TABLE users ADD COLUMN last_login_at TEXT`,
      `ALTER TABLE users ADD COLUMN phone TEXT`,
      `ALTER TABLE users ADD COLUMN address_json TEXT`,
      `ALTER TABLE users ADD COLUMN delivery_address_json TEXT`,
    ]) {
      try {
        await query(ddl)
      } catch {
        /* column already exists */
      }
    }
  }

  ensured = true
}

export function resetUserAuthSchemaCache() {
  ensured = false
}
