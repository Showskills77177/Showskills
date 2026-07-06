import { randomUUID } from 'node:crypto'
import { query, isUniqueViolation } from './db.mjs'
import { ensureUserAuthSchema } from './ensureUserAuthSchema.mjs'

let phoneColumnEnsured = false

export async function ensureUserPhoneColumn() {
  if (phoneColumnEnsured) return
  await ensureUserAuthSchema()
  phoneColumnEnsured = true
}

/**
 * Create or update user contact details (email unique).
 */
export async function upsertUserContact({ email, fullName, phone }) {
  await ensureUserPhoneColumn()
  const e = email.trim().toLowerCase()
  const n = fullName?.trim() || 'Unknown'
  const p = typeof phone === 'string' ? phone.trim().slice(0, 32) : ''
  const newId = randomUUID()
  try {
    await query(
      `INSERT INTO users (id, email, full_name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
      [newId, e, n, p || null],
    )
    return newId
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const u = await query(`SELECT id FROM users WHERE lower(email) = $1`, [e])
    if (!u.rows[0]) throw err
    await query(
      `UPDATE users SET full_name = COALESCE(NULLIF($2,''), full_name), phone = COALESCE(NULLIF($3,''), phone) WHERE id = $1`,
      [u.rows[0].id, n, p],
    )
    return u.rows[0].id
  }
}
