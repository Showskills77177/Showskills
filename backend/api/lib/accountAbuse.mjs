import { normalizeAccountEmail } from '../../../shared/normalizeAccountEmail.mjs'
import { ensureEntryAttemptLogSchema } from './ensureFreeEntrySchema.mjs'
import { query, dbIsPostgres } from './db.mjs'
import { clientIp } from './rateLimit.mjs'
import { logEntryAttempt } from './freeEntryAbuse.mjs'

/** Max password-backed accounts created from one IP in 24 hours. */
export const MAX_ACCOUNTS_PER_IP_24H = 3

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'grr.la',
  'sharklasers.com',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
  '10minutemail.com',
])

export function isDisposableEmail(email) {
  const normalized = normalizeAccountEmail(email)
  const domain = normalized.split('@')[1] || ''
  return DISPOSABLE_DOMAINS.has(domain)
}

async function countRecentAccountCreationsByIp(ip) {
  await ensureEntryAttemptLogSchema()
  const since = dbIsPostgres()
    ? `created_at >= now() - interval '24 hours'`
    : `created_at >= datetime('now', '-24 hours')`
  const r = await query(
    `SELECT COUNT(*)::int AS c FROM entry_attempt_logs
     WHERE flow = 'account_register' AND outcome = 'success' AND ip_address = $1
       AND ${since}`,
    [ip],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} email
 */
export async function checkAccountRegistrationAllowed(req, email) {
  const normalized = normalizeAccountEmail(email)
  if (!normalized.includes('@') || !normalized.includes('.')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  if (isDisposableEmail(normalized)) {
    await logEntryAttempt(req, {
      competition: 'account',
      flow: 'account_register',
      email: normalized,
      outcome: 'blocked',
      blockReason: 'disposable_email',
    }).catch(() => {})
    return {
      ok: false,
      error: 'Disposable email addresses are not allowed. Use a permanent email you can access.',
      code: 'disposable_email',
    }
  }

  const ip = clientIp(req)
  const recent = await countRecentAccountCreationsByIp(ip)
  if (recent >= MAX_ACCOUNTS_PER_IP_24H) {
    await logEntryAttempt(req, {
      competition: 'account',
      flow: 'account_register',
      email: normalized,
      ip,
      outcome: 'blocked',
      blockReason: 'ip_account_limit',
    }).catch(() => {})
    return {
      ok: false,
      error: 'Too many accounts created from this connection. Try again later or contact us.',
      code: 'ip_account_limit',
    }
  }

  return { ok: true, email: normalized, ip }
}

/** @param {import('http').IncomingMessage} req @param {{ email: string, userId?: string }} fields */
export async function logAccountRegistrationSuccess(req, { email, userId }) {
  await logEntryAttempt(req, {
    competition: 'account',
    flow: 'account_register',
    email: normalizeAccountEmail(email),
    outcome: 'success',
    metadata: userId ? { user_id: userId } : undefined,
  }).catch(() => {})
}
