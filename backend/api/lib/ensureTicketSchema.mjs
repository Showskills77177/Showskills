import { query, dbIsPostgres } from './db.mjs'

let ensured = false

/** Idempotent DDL for per-ticket numbers and confirmation email tracking. */
export async function ensureTicketSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS ticket_numbers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
        ticket_number TEXT NOT NULL UNIQUE,
        slot_index INTEGER NOT NULL CHECK (slot_index > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_ticket_numbers_ticket ON ticket_numbers (ticket_id)`)
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ`)
    } catch {
      /* sqlite-only path or already exists */
    }
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS ticket_numbers (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL,
        ticket_number TEXT NOT NULL UNIQUE,
        slot_index INTEGER NOT NULL CHECK (slot_index > 0),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_ticket_numbers_ticket ON ticket_numbers (ticket_id)`)
    try {
      await query(`ALTER TABLE tickets ADD COLUMN confirmation_email_sent_at TEXT`)
    } catch {
      /* column already exists */
    }
  }

  ensured = true
}
