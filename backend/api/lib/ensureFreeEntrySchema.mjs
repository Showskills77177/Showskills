import { query, dbIsPostgres } from './db.mjs'

let ensured = false

export async function ensureFreeEntrySchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS free_online_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users (id) ON DELETE SET NULL,
        competition TEXT NOT NULL DEFAULT 'ronaldo_legacy_bundle',
        name_address_key TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        postcode TEXT NOT NULL,
        setup_intent_id TEXT NOT NULL UNIQUE,
        ticket_id UUID REFERENCES tickets (id) ON DELETE SET NULL,
        entry_id UUID,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_free_online_name_addr ON free_online_entries (competition, name_address_key)`,
    )
    await query(
      `CREATE INDEX IF NOT EXISTS idx_free_online_email ON free_online_entries (lower(email))`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS stripe_card_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competition TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        setup_intent_id TEXT NOT NULL UNIQUE,
        email TEXT,
        name_address_key TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_card_verify_ip ON stripe_card_verifications (competition, ip_address)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS entry_attempt_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competition TEXT NOT NULL,
        flow TEXT NOT NULL,
        ip_address TEXT,
        full_name TEXT,
        email TEXT,
        address_key TEXT,
        outcome TEXT NOT NULL,
        block_reason TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_entry_attempts_created ON entry_attempt_logs (created_at DESC)`,
    )
    await query(
      `CREATE INDEX IF NOT EXISTS idx_entry_attempts_flow ON entry_attempt_logs (flow, outcome)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS free_online_pending (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setup_intent_id TEXT NOT NULL UNIQUE,
        name_address_key TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        postcode TEXT NOT NULL,
        ip_address TEXT,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS free_online_entries (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        competition TEXT NOT NULL DEFAULT 'ronaldo_legacy_bundle',
        name_address_key TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        postcode TEXT NOT NULL,
        setup_intent_id TEXT NOT NULL UNIQUE,
        ticket_id TEXT,
        entry_id TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_free_online_name_addr ON free_online_entries (competition, name_address_key)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS stripe_card_verifications (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        setup_intent_id TEXT NOT NULL UNIQUE,
        email TEXT,
        name_address_key TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_card_verify_ip ON stripe_card_verifications (competition, ip_address)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS entry_attempt_logs (
        id TEXT PRIMARY KEY NOT NULL,
        competition TEXT NOT NULL,
        flow TEXT NOT NULL,
        ip_address TEXT,
        full_name TEXT,
        email TEXT,
        address_key TEXT,
        outcome TEXT NOT NULL,
        block_reason TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_entry_attempts_created ON entry_attempt_logs (created_at)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS free_online_pending (
        id TEXT PRIMARY KEY NOT NULL,
        setup_intent_id TEXT NOT NULL UNIQUE,
        name_address_key TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        postcode TEXT NOT NULL,
        ip_address TEXT,
        verified_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      )
    `)
  }

  ensured = true
}
