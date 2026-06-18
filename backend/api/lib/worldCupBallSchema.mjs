import { randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'

let ensured = false

export async function ensureWorldCupBallSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        timeouts_used INTEGER NOT NULL DEFAULT 0,
        answers_json JSONB,
        claim_token TEXT UNIQUE,
        submission_id UUID,
        question_keys_json JSONB,
        combination_index INTEGER,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        submitted_at TIMESTAMPTZ,
        claimed_at TIMESTAMPTZ
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_wc_ball_sessions_ip ON world_cup_ball_sessions (ip_address, started_at DESC)`,
    )
    await query(
      `CREATE INDEX IF NOT EXISTS idx_wc_ball_sessions_status ON world_cup_ball_sessions (status)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_winners (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL UNIQUE REFERENCES world_cup_ball_sessions (id) ON DELETE CASCADE,
        submission_id UUID NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        phone_key TEXT NOT NULL UNIQUE,
        address_key TEXT NOT NULL UNIQUE,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        postcode TEXT NOT NULL,
        email TEXT,
        winner_email_sent_at TIMESTAMPTZ,
        winner_email_resend_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        ip_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        timeouts_used INTEGER NOT NULL DEFAULT 0,
        answers_json TEXT,
        claim_token TEXT UNIQUE,
        submission_id TEXT,
        question_keys_json TEXT,
        combination_index INTEGER,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        submitted_at TEXT,
        claimed_at TEXT
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_wc_ball_sessions_ip ON world_cup_ball_sessions (ip_address, started_at)`,
    )
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_winners (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        submission_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        phone_key TEXT NOT NULL UNIQUE,
        address_key TEXT NOT NULL UNIQUE,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        postcode TEXT NOT NULL,
        email TEXT,
        winner_email_sent_at TEXT,
        winner_email_resend_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  if (dbIsPostgres()) {
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS email TEXT`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS winner_email_sent_at TIMESTAMPTZ`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS winner_email_resend_id TEXT`)
    await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN IF NOT EXISTS question_keys_json JSONB`)
    await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN IF NOT EXISTS combination_index INTEGER`)
  } else {
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN email TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN winner_email_sent_at TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN winner_email_resend_id TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN question_keys_json TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN combination_index INTEGER`)
    } catch {
      /* column exists */
    }
  }

  ensured = true
}

export async function createWorldCupBallSession(ipAddress, { questionKeys, combinationIndex } = {}) {
  await ensureWorldCupBallSchema()
  const id = randomUUID()
  const now = new Date().toISOString()
  const keysJson = dbIsPostgres() ? questionKeys : JSON.stringify(questionKeys)
  await query(
    `INSERT INTO world_cup_ball_sessions (id, ip_address, status, started_at, question_keys_json, combination_index)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, ipAddress, 'in_progress', now, keysJson, combinationIndex ?? null],
  )
  return { id, startedAt: now, questionKeys, combinationIndex }
}

export async function getWorldCupBallSession(sessionId) {
  await ensureWorldCupBallSchema()
  const r = await query(`SELECT * FROM world_cup_ball_sessions WHERE id = $1`, [sessionId])
  return r.rows[0] || null
}

export async function countWorldCupBallAttemptsByIp(ip) {
  await ensureWorldCupBallSchema()
  const r = await query(`SELECT COUNT(*)::int AS c FROM world_cup_ball_sessions WHERE ip_address = $1`, [ip])
  return Number(r.rows[0]?.c ?? 0)
}

/** Completed or abandoned attempts (excludes active in-progress quiz). */
export async function countWorldCupBallFinalizedAttemptsByIp(ip) {
  await ensureWorldCupBallSchema()
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM world_cup_ball_sessions
     WHERE ip_address = $1 AND status != 'in_progress'`,
    [ip],
  )
  return Number(r.rows[0]?.c ?? 0)
}

export async function getInProgressWorldCupBallSessionByIp(ip) {
  await ensureWorldCupBallSchema()
  const r = await query(
    `SELECT * FROM world_cup_ball_sessions
     WHERE ip_address = $1 AND status = 'in_progress'
     ORDER BY started_at DESC
     LIMIT 1`,
    [ip],
  )
  return r.rows[0] || null
}

export async function countWorldCupBallWinners() {
  await ensureWorldCupBallSchema()
  const r = await query(`SELECT COUNT(*)::int AS c FROM world_cup_ball_winners`)
  return Number(r.rows[0]?.c ?? 0)
}

export async function hasWorldCupBallWinnerClaim(nameKey, phoneKey, addressKey) {
  await ensureWorldCupBallSchema()
  const r = await query(
    `SELECT 1 FROM world_cup_ball_winners
     WHERE name_key = $1 OR phone_key = $2 OR address_key = $3 LIMIT 1`,
    [nameKey, phoneKey, addressKey],
  )
  return Boolean(r.rows[0])
}

export async function finalizeWorldCupBallSession({
  sessionId,
  status,
  timeoutsUsed,
  answers,
  claimToken,
  submissionId,
}) {
  await ensureWorldCupBallSchema()
  const now = new Date().toISOString()
  const answersJson = dbIsPostgres() ? answers : JSON.stringify(answers)
  await query(
    `UPDATE world_cup_ball_sessions SET
      status = $2,
      timeouts_used = $3,
      answers_json = $4,
      claim_token = $5,
      submission_id = $6,
      submitted_at = $7
     WHERE id = $1`,
    [sessionId, status, timeoutsUsed, answersJson, claimToken || null, submissionId || null, now],
  )
}

export async function recordWorldCupBallWinner({
  sessionId,
  submissionId,
  fullName,
  phone,
  nameKey,
  phoneKey,
  addressKey,
  addressLine1,
  addressLine2,
  city,
  postcode,
  email,
}) {
  await ensureWorldCupBallSchema()
  const id = randomUUID()
  const now = new Date().toISOString()
  await query(
    `INSERT INTO world_cup_ball_winners (
      id, session_id, submission_id, full_name, phone, name_key, phone_key, address_key,
      address_line1, address_line2, city, postcode, email, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      sessionId,
      submissionId,
      fullName,
      phone,
      nameKey,
      phoneKey,
      addressKey,
      addressLine1,
      addressLine2 || null,
      city,
      postcode,
      email || null,
      now,
    ],
  )
  await query(
    `UPDATE world_cup_ball_sessions SET status = $2, claimed_at = $3 WHERE id = $1`,
    [sessionId, 'claimed', now],
  )
  return id
}

export async function markWorldCupBallWinnerEmailSent(winnerId, resendId) {
  await ensureWorldCupBallSchema()
  const now = new Date().toISOString()
  await query(
    `UPDATE world_cup_ball_winners SET winner_email_sent_at = $2, winner_email_resend_id = $3 WHERE id = $1`,
    [winnerId, now, resendId || null],
  )
}

export async function getWorldCupBallSessionByClaimToken(claimToken) {
  await ensureWorldCupBallSchema()
  const r = await query(`SELECT * FROM world_cup_ball_sessions WHERE claim_token = $1`, [claimToken])
  return r.rows[0] || null
}
