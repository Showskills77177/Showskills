import { randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { ensureUserAuthSchema } from './ensureUserAuthSchema.mjs'
import { ensureUserPhoneColumn } from './userContact.mjs'
import { hashUserPassword, verifyUserPassword } from './password.mjs'
import { normalizeAccountEmail } from '../../../shared/normalizeAccountEmail.mjs'

function mapUserRow(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at ?? null,
    lastLoginAt: row.last_login_at ?? null,
  }
}

export async function getUserById(id) {
  await ensureUserAuthSchema()
  const r = await query(`SELECT id, email, full_name, created_at, last_login_at FROM users WHERE id = $1 AND deleted_at IS NULL`, [id])
  return mapUserRow(r.rows[0])
}

export async function getUserAuthRowByEmail(email) {
  await ensureUserAuthSchema()
  await ensureUserPhoneColumn()
  const e = normalizeAccountEmail(email)
  if (!e.includes('@')) return null
  const r = await query(
    `SELECT id, email, full_name, password_hash, created_at, last_login_at, deleted_at FROM users WHERE lower(email) = $1`,
    [e],
  )
  const row = r.rows[0]
  if (!row || row.deleted_at) return null
  return row
}

/**
 * Create a password-backed account or upgrade a contact-only user from checkout.
 */
export async function registerUser({ email, password, fullName }) {
  await ensureUserAuthSchema()
  await ensureUserPhoneColumn()

  const e = normalizeAccountEmail(email)
  const name = String(fullName || '')
    .trim()
    .slice(0, 120)

  if (!e.includes('@') || !e.includes('.')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (!name) {
    return { ok: false, error: 'Enter your full name.' }
  }

  let passwordHash
  try {
    passwordHash = await hashUserPassword(password)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid password.' }
  }

  const existing = await getUserAuthRowByEmail(e)
  if (existing?.password_hash) {
    return { ok: false, error: 'An account with this email already exists. Sign in instead.' }
  }

  if (existing && !existing.password_hash) {
    return {
      ok: false,
      error:
        'This email is already linked to an order on ShowSkills. Use Forgot password to verify your email and set a password.',
      code: 'email_claim_required',
    }
  }

  const now = new Date().toISOString()

  const id = randomUUID()
  await query(
    `INSERT INTO users (id, email, full_name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, e, name, passwordHash, now],
  )
  const user = await getUserById(id)
  return { ok: true, user, isNewAccount: true }
}

export async function authenticateUser({ email, password }) {
  await ensureUserAuthSchema()

  const e = normalizeAccountEmail(email)
  const row = await getUserAuthRowByEmail(e)
  if (!row?.password_hash) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  const valid = await verifyUserPassword(password, row.password_hash)
  if (!valid) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  const now = new Date().toISOString()
  await query(`UPDATE users SET last_login_at = $2 WHERE id = $1`, [row.id, now])

  return { ok: true, user: mapUserRow({ ...row, last_login_at: now }) }
}
