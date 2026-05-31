import { query, dbIsPostgres } from './db.mjs'
import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'

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
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT UNIQUE`)
    } catch {
      /* already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pending_quiz_reminder_sent_at TIMESTAMPTZ`)
    } catch {
      /* already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS quiz_resume_token TEXT UNIQUE`)
    } catch {
      /* already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS period_id TEXT`)
    } catch {
      /* already exists */
    }
    try {
      await query(
        `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cashflows_payment_job_reference TEXT UNIQUE`,
      )
    } catch {
      /* already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cashflows_intent_token TEXT`)
    } catch {
      /* already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS competition TEXT`)
    } catch {
      /* already exists */
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
    try {
      await query(`ALTER TABLE tickets ADD COLUMN stripe_payment_intent_id TEXT UNIQUE`)
    } catch {
      /* column already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN pending_quiz_reminder_sent_at TEXT`)
    } catch {
      /* column already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN quiz_resume_token TEXT UNIQUE`)
    } catch {
      /* column already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN period_id TEXT`)
    } catch {
      /* column already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN cashflows_payment_job_reference TEXT`)
    } catch {
      /* column already exists */
    }
    try {
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_cashflows_job ON tickets (cashflows_payment_job_reference)`,
      )
    } catch {
      /* index already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN cashflows_intent_token TEXT`)
    } catch {
      /* column already exists */
    }
    try {
      await query(`ALTER TABLE tickets ADD COLUMN competition TEXT`)
    } catch {
      /* column already exists */
    }
  }

  await backfillTicketCompetition()

  ensured = true
}

async function backfillTicketCompetition() {
  try {
    await query(`
      UPDATE tickets
      SET competition = cp.competition
      FROM competition_periods cp
      WHERE tickets.period_id = cp.id
        AND (tickets.competition IS NULL OR tickets.competition = '')
    `)
  } catch {
    /* competition_periods may not exist yet */
  }
  await query(
    `UPDATE tickets SET competition = $1 WHERE competition IS NULL OR competition = ''`,
    [DRAW_COMPETITION_SLUG],
  )
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_tickets_competition ON tickets (competition, created_at DESC)`)
  } catch {
    try {
      await query(`CREATE INDEX IF NOT EXISTS idx_tickets_competition ON tickets (competition, created_at)`)
    } catch {
      /* ignore */
    }
  }
}

/** Re-run DDL after schema fixes (dev hot-reload). */
export function resetTicketSchemaCache() {
  ensured = false
}
