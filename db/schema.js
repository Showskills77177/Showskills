/**
 * Create tables for local SQLite (admin dashboard + API persistence).
 * Usage: npm run db:schema
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import Database from 'better-sqlite3'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env.local') })
config({ path: join(root, '.env') })

const rel = (process.env.SQLITE_PATH || 'db/db.sqlite').trim()
const filePath = join(root, rel)
mkdirSync(dirname(filePath), { recursive: true })

const db = new Database(filePath)

const ddl = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_public_id TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  bundle_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT UNIQUE,
  paypal_order_id TEXT UNIQUE,
  purchased_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_stripe ON tickets (stripe_session_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES tickets (id) ON DELETE SET NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);

CREATE TABLE IF NOT EXISTS competition_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  competition TEXT NOT NULL DEFAULT 'ronaldo_legacy_bundle',
  entry_type TEXT NOT NULL CHECK (entry_type IN ('paid', 'free')),
  answers_json TEXT,
  all_correct INTEGER,
  reviewed_valid INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_competition ON competition_entries (competition);
CREATE INDEX IF NOT EXISTS idx_entries_created ON competition_entries (created_at);

CREATE TABLE IF NOT EXISTS kickup_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  video_ref TEXT,
  video_filename TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kickups_status ON kickup_submissions (review_status);
CREATE INDEX IF NOT EXISTS idx_kickups_created ON kickup_submissions (created_at);
`

for (const stmt of ddl.split(';').map((s) => s.trim()).filter(Boolean)) {
  db.exec(stmt + ';')
}

db.close()
console.log('Schema applied:', filePath)
