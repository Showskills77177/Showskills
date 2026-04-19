-- PostgreSQL schema for ShowSkills admin (run once: psql $DATABASE_URL -f api/db/schema.sql)
-- Postal / free-postal entries are intentionally NOT stored here.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_public_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  bundle_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT UNIQUE,
  paypal_order_id TEXT UNIQUE,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_stripe ON tickets (stripe_session_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets (id) ON DELETE SET NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);

-- Quiz entries after paid (or marked free); NOT postal
CREATE TABLE IF NOT EXISTS competition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  competition TEXT NOT NULL DEFAULT 'ronaldo_legacy_bundle',
  entry_type TEXT NOT NULL CHECK (entry_type IN ('paid', 'free')),
  answers_json JSONB,
  all_correct BOOLEAN,
  reviewed_valid BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entries_competition ON competition_entries (competition);
CREATE INDEX IF NOT EXISTS idx_entries_created ON competition_entries (created_at DESC);

CREATE TABLE IF NOT EXISTS kickup_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  video_ref TEXT,
  video_filename TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kickups_status ON kickup_submissions (review_status);
CREATE INDEX IF NOT EXISTS idx_kickups_created ON kickup_submissions (created_at DESC);
