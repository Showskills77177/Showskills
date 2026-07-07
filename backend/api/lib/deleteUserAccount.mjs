import { randomUUID } from 'node:crypto'
import { query } from './db.mjs'
import { ensureUserAuthSchema } from './ensureUserAuthSchema.mjs'
import { verifyUserPassword } from './password.mjs'
import { getUserAuthRowByEmail } from './userAccounts.mjs'
import { clearUserCookieHeader } from './userAuth.mjs'

const DELETED_EMAIL_DOMAIN = 'deleted.showskills.invalid'

/**
 * Soft-delete account: anonymize PII, invalidate password, keep purchase audit trail.
 * @param {{ userId: string, password: string }} opts
 */
export async function deleteUserAccount({ userId, password }) {
  await ensureUserAuthSchema()
  const row = await query(`SELECT id, email, password_hash, deleted_at FROM users WHERE id = $1`, [userId])
  const user = row.rows[0]
  if (!user) {
    return { ok: false, error: 'Account not found.' }
  }
  if (user.deleted_at) {
    return { ok: false, error: 'This account has already been deleted.' }
  }
  if (!user.password_hash) {
    return { ok: false, error: 'Account not found.' }
  }

  const valid = await verifyUserPassword(password, user.password_hash)
  if (!valid) {
    return { ok: false, error: 'Password is incorrect.' }
  }

  const anonEmail = `deleted-${randomUUID()}@${DELETED_EMAIL_DOMAIN}`
  const now = new Date().toISOString()

  await query(
    `UPDATE users
     SET email = $2,
         full_name = 'Deleted account',
         phone = NULL,
         password_hash = NULL,
         address_json = NULL,
         delivery_address_json = NULL,
         deleted_at = $3,
         last_login_at = NULL
     WHERE id = $1`,
    [userId, anonEmail, now],
  )

  return { ok: true, clearSessionCookie: clearUserCookieHeader() }
}

/** Reject deleted accounts at login. */
export function isUserRowDeleted(row) {
  return Boolean(row?.deleted_at)
}
