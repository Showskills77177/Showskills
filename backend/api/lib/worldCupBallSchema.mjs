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
        claimed_at TIMESTAMPTZ,
        salvage_question_key TEXT
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
        claimed_at TEXT,
        salvage_question_key TEXT
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
    await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN IF NOT EXISTS salvage_question_key TEXT`)
    await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN IF NOT EXISTS contact_email TEXT`)
    await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN IF NOT EXISTS country_code TEXT`)
    await query(`ALTER TABLE world_cup_ball_monthly_draw_entries ADD COLUMN IF NOT EXISTS email TEXT`)
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
    try {
      await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN salvage_question_key TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN contact_email TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_sessions ADD COLUMN country_code TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_monthly_draw_entries ADD COLUMN email TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN country_code TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN prize_fulfilment TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN cash_prize_usd INTEGER`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN check_photo_acknowledged_at TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN reward_choice TEXT`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN fraud_score INTEGER`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN fraud_flagged INTEGER NOT NULL DEFAULT 0`)
    } catch {
      /* column exists */
    }
    try {
      await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN fraud_flags_json TEXT`)
    } catch {
      /* column exists */
    }
  }

  if (dbIsPostgres()) {
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS country_code TEXT`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS prize_fulfilment TEXT`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS cash_prize_usd INTEGER`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS check_photo_acknowledged_at TIMESTAMPTZ`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS reward_choice TEXT`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS fraud_score INTEGER`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS fraud_flagged BOOLEAN NOT NULL DEFAULT false`)
    await query(`ALTER TABLE world_cup_ball_winners ADD COLUMN IF NOT EXISTS fraud_flags_json JSONB`)
  }

  await ensureWorldCupBallMonthlyDrawSchema()

  ensured = true
}

async function ensureWorldCupBallMonthlyDrawSchema() {
  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_monthly_draw_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL UNIQUE,
        draw_month TEXT NOT NULL,
        entry_number TEXT NOT NULL UNIQUE,
        ip_address TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT 'lost',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_wc_ball_draw_month ON world_cup_ball_monthly_draw_entries (draw_month, created_at DESC)`,
    )
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS world_cup_ball_monthly_draw_entries (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        draw_month TEXT NOT NULL,
        entry_number TEXT NOT NULL UNIQUE,
        ip_address TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT 'lost',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_wc_ball_draw_month ON world_cup_ball_monthly_draw_entries (draw_month, created_at)`,
    )
  }
}

export async function createWorldCupBallSession(ipAddress, { questionKeys, combinationIndex, countryCode } = {}) {
  await ensureWorldCupBallSchema()
  const id = randomUUID()
  const now = new Date().toISOString()
  const keysJson = JSON.stringify(questionKeys ?? [])
  await query(
    `INSERT INTO world_cup_ball_sessions (id, ip_address, country_code, status, started_at, question_keys_json, combination_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, ipAddress, countryCode || null, 'in_progress', now, keysJson, combinationIndex ?? null],
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

export async function saveWorldCupBallSalvageOffer({ sessionId, answers, timeoutsUsed, salvageQuestionKey }) {
  await ensureWorldCupBallSchema()
  const answersJson = JSON.stringify(answers ?? {})
  await query(
    `UPDATE world_cup_ball_sessions SET answers_json = $2, timeouts_used = $3, salvage_question_key = $4 WHERE id = $1 AND status = 'in_progress'`,
    [sessionId, answersJson, timeoutsUsed, salvageQuestionKey],
  )
}

export async function saveWorldCupBallPartialProgress({ sessionId, answers, timeoutsUsed }) {
  await ensureWorldCupBallSchema()
  const answersJson = JSON.stringify(answers ?? {})
  await query(
    `UPDATE world_cup_ball_sessions SET answers_json = $2, timeouts_used = $3 WHERE id = $1 AND status = 'in_progress'`,
    [sessionId, answersJson, timeoutsUsed],
  )
}

export async function finalizeWorldCupBallSession({
  sessionId,
  status,
  timeoutsUsed,
  answers,
  claimToken,
  submissionId,
  countryCode,
}) {
  await ensureWorldCupBallSchema()
  const now = new Date().toISOString()
  const answersJson = JSON.stringify(answers ?? {})
  await query(
    `UPDATE world_cup_ball_sessions SET
      status = $2,
      timeouts_used = $3,
      answers_json = $4,
      claim_token = $5,
      submission_id = $6,
      submitted_at = $7,
      country_code = COALESCE(country_code, $8)
     WHERE id = $1`,
    [sessionId, status, timeoutsUsed, answersJson, claimToken || null, submissionId || null, now, countryCode || null],
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
  countryCode,
  prizeFulfilment,
  cashPrizeUsd = null,
  checkPhotoAcknowledgedAt = null,
  rewardChoice = null,
  fraudScore = null,
  fraudFlagged = false,
  fraudFlags = null,
}) {
  await ensureWorldCupBallSchema()
  const id = randomUUID()
  const now = new Date().toISOString()
  const fraudFlagsJson = fraudFlags ? JSON.stringify(fraudFlags) : null
  await query(
    `INSERT INTO world_cup_ball_winners (
      id, session_id, submission_id, full_name, phone, name_key, phone_key, address_key,
      address_line1, address_line2, city, postcode, email, country_code, prize_fulfilment,
      cash_prize_usd, check_photo_acknowledged_at, reward_choice, fraud_score, fraud_flagged,
      fraud_flags_json, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
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
      countryCode || null,
      prizeFulfilment || null,
      cashPrizeUsd,
      checkPhotoAcknowledgedAt,
      rewardChoice || null,
      fraudScore,
      dbIsPostgres() ? Boolean(fraudFlagged) : fraudFlagged ? 1 : 0,
      fraudFlagsJson,
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

/** Staging QA — wipe all World Cup Ball attempt data for one IP. */
export async function resetWorldCupBallAttemptsForIp(ip) {
  if (!ip) return { ok: false, sessionsDeleted: 0 }
  await ensureWorldCupBallSchema()

  const sessionIds = await query(`SELECT id FROM world_cup_ball_sessions WHERE ip_address = $1`, [ip])
  const ids = sessionIds.rows.map((row) => row.id).filter(Boolean)
  if (!ids.length) {
    return { ok: true, sessionsDeleted: 0 }
  }

  for (const sessionId of ids) {
    await query(`DELETE FROM world_cup_ball_winners WHERE session_id = $1`, [sessionId])
    await query(`DELETE FROM world_cup_ball_monthly_draw_entries WHERE session_id = $1`, [sessionId])
  }
  const deleted = await query(`DELETE FROM world_cup_ball_sessions WHERE ip_address = $1`, [ip])
  const count = Number(deleted.rowCount ?? deleted.changes ?? ids.length)
  return { ok: true, sessionsDeleted: count }
}

const WORLD_CUP_BALL_FAILED_STATUSES = new Set(['lost', 'disqualified'])

export function isWorldCupBallFailedSessionStatus(status) {
  return WORLD_CUP_BALL_FAILED_STATUSES.has(String(status || '').trim())
}

/** Save contact email after a failed skill quiz attempt. */
export async function saveWorldCupBallFailedContactEmail({ sessionId, email }) {
  if (!sessionId) return { ok: false, error: 'invalid_session' }

  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@') || normalized.length > 254) {
    return { ok: false, error: 'invalid_email' }
  }

  await ensureWorldCupBallSchema()
  const session = await getWorldCupBallSession(sessionId)
  if (!session) return { ok: false, error: 'session_not_found' }
  if (!isWorldCupBallFailedSessionStatus(session.status)) {
    return { ok: false, error: 'not_failed_session' }
  }

  await query(`UPDATE world_cup_ball_sessions SET contact_email = $2 WHERE id = $1`, [
    sessionId,
    normalized,
  ])
  await query(`UPDATE world_cup_ball_monthly_draw_entries SET email = $2 WHERE session_id = $1`, [
    sessionId,
    normalized,
  ])

  return { ok: true, email: normalized }
}
