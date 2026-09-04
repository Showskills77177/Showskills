import { randomUUID } from 'node:crypto'
import { query, dbIsPostgres } from './db.mjs'

let ensured = false

/** Sessions for the Ronaldo shirt giveaway 25-question skill quiz gate. */
export async function ensureRonaldoShirtQuizSchema() {
  if (ensured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS ronaldo_shirt_quiz_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        timeouts_used INTEGER NOT NULL DEFAULT 0,
        answers_json JSONB,
        question_keys_json JSONB,
        combination_index INTEGER,
        salvage_question_keys_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        salvage_answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        pass_token TEXT UNIQUE,
        pass_token_consumed_at TIMESTAMPTZ,
        country_code TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        submitted_at TIMESTAMPTZ
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_ronaldo_shirt_quiz_ip ON ronaldo_shirt_quiz_sessions (ip_address, started_at DESC)`,
    )
    await query(
      `CREATE INDEX IF NOT EXISTS idx_ronaldo_shirt_quiz_status ON ronaldo_shirt_quiz_sessions (status)`,
    )
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS ronaldo_shirt_quiz_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        ip_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        timeouts_used INTEGER NOT NULL DEFAULT 0,
        answers_json TEXT,
        question_keys_json TEXT,
        combination_index INTEGER,
        salvage_question_keys_json TEXT NOT NULL DEFAULT '[]',
        salvage_answers_json TEXT NOT NULL DEFAULT '{}',
        pass_token TEXT UNIQUE,
        pass_token_consumed_at TEXT,
        country_code TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        submitted_at TEXT
      )
    `)
    await query(
      `CREATE INDEX IF NOT EXISTS idx_ronaldo_shirt_quiz_ip ON ronaldo_shirt_quiz_sessions (ip_address, started_at)`,
    )
  }

  ensured = true
}

export async function createRonaldoShirtQuizSession(ipAddress, { questionKeys, combinationIndex, countryCode } = {}) {
  await ensureRonaldoShirtQuizSchema()
  const id = randomUUID()
  const now = new Date().toISOString()
  const keysJson = JSON.stringify(questionKeys ?? [])
  await query(
    `INSERT INTO ronaldo_shirt_quiz_sessions (id, ip_address, country_code, status, started_at, question_keys_json, combination_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, ipAddress, countryCode || null, 'in_progress', now, keysJson, combinationIndex ?? null],
  )
  return { id, startedAt: now, questionKeys, combinationIndex }
}

export async function getRonaldoShirtQuizSession(sessionId) {
  await ensureRonaldoShirtQuizSchema()
  const r = await query(`SELECT * FROM ronaldo_shirt_quiz_sessions WHERE id = $1`, [sessionId])
  return r.rows[0] || null
}

export async function getInProgressRonaldoShirtQuizSessionByIp(ip) {
  await ensureRonaldoShirtQuizSchema()
  const r = await query(
    `SELECT * FROM ronaldo_shirt_quiz_sessions
     WHERE ip_address = $1 AND status = 'in_progress'
     ORDER BY started_at DESC
     LIMIT 1`,
    [ip],
  )
  return r.rows[0] || null
}

/** Persist progress + the next salvage question offered, keeping the session in progress. */
export async function saveRonaldoShirtQuizSalvageOffer({
  sessionId,
  answers,
  timeoutsUsed,
  salvageQuestionKeys,
  salvageAnswers,
}) {
  await ensureRonaldoShirtQuizSchema()
  const answersJson = JSON.stringify(answers ?? {})
  const salvageKeysJson = JSON.stringify(salvageQuestionKeys ?? [])
  const salvageAnswersJson = JSON.stringify(salvageAnswers ?? {})
  await query(
    `UPDATE ronaldo_shirt_quiz_sessions SET
      answers_json = $2,
      timeouts_used = $3,
      salvage_question_keys_json = $4,
      salvage_answers_json = $5
     WHERE id = $1 AND status = 'in_progress'`,
    [sessionId, answersJson, timeoutsUsed, salvageKeysJson, salvageAnswersJson],
  )
}

export async function saveRonaldoShirtQuizPartialProgress({ sessionId, answers, timeoutsUsed }) {
  await ensureRonaldoShirtQuizSchema()
  const answersJson = JSON.stringify(answers ?? {})
  await query(
    `UPDATE ronaldo_shirt_quiz_sessions SET answers_json = $2, timeouts_used = $3 WHERE id = $1 AND status = 'in_progress'`,
    [sessionId, answersJson, timeoutsUsed],
  )
}

function newPassToken() {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}

export async function finalizeRonaldoShirtQuizSession({
  sessionId,
  status,
  timeoutsUsed,
  answers,
  countryCode,
}) {
  await ensureRonaldoShirtQuizSchema()
  const now = new Date().toISOString()
  const answersJson = JSON.stringify(answers ?? {})
  const passToken = status === 'won' ? newPassToken() : null
  await query(
    `UPDATE ronaldo_shirt_quiz_sessions SET
      status = $2,
      timeouts_used = $3,
      answers_json = $4,
      submitted_at = $5,
      pass_token = COALESCE($6, pass_token),
      country_code = COALESCE(country_code, $7)
     WHERE id = $1`,
    [sessionId, status, timeoutsUsed, answersJson, now, passToken, countryCode || null],
  )
  return { passToken }
}

/**
 * @param {string} token
 * @param {number} [graceMinutes] - how long after `submitted_at` the token stays redeemable.
 */
export async function getRonaldoShirtQuizSessionByPassToken(token, graceMinutes = 30) {
  if (!token) return null
  await ensureRonaldoShirtQuizSchema()
  const r = await query(
    `SELECT * FROM ronaldo_shirt_quiz_sessions WHERE pass_token = $1 AND status = 'won'`,
    [token],
  )
  const session = r.rows[0] || null
  if (!session) return null
  if (session.pass_token_consumed_at) return null
  const submittedAt = new Date(session.submitted_at || session.started_at).getTime()
  if (!Number.isFinite(submittedAt)) return null
  if (Date.now() - submittedAt > graceMinutes * 60 * 1000) return null
  return session
}

export async function consumeRonaldoShirtQuizPassToken(sessionId) {
  await ensureRonaldoShirtQuizSchema()
  const now = new Date().toISOString()
  await query(
    `UPDATE ronaldo_shirt_quiz_sessions SET pass_token_consumed_at = $2 WHERE id = $1 AND pass_token_consumed_at IS NULL`,
    [sessionId, now],
  )
}
