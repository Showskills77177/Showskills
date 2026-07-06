import { createHash, randomInt } from 'node:crypto'
import { query } from './db.mjs'
import { getUserAuthRowByEmail } from './userAccounts.mjs'
import { hashUserPassword } from './password.mjs'
import { normalizeAccountEmail } from '../../../shared/normalizeAccountEmail.mjs'
import {
  getResendApiKey,
  resolveResendFrom,
  resolveSiteUrl,
  formatResendError,
  isResendProductionMode,
  parseResendSandboxRecipient,
  resolveCustomerEmailRecipient,
  resendAccountEmail,
} from './resendConfig.mjs'

function otpPepper() {
  return (
    process.env.USER_JWT_SECRET?.trim() ||
    process.env.ADMIN_JWT_SECRET?.trim() ||
    'dev-insecure-pepper'
  ).trim()
}

export function isUserPasswordResetEmailConfigured() {
  return Boolean(getResendApiKey())
}

export function getUserPasswordResetSetupHint() {
  if (!getResendApiKey()) {
    return 'Password reset email is not configured (RESEND_API_KEY missing on the server).'
  }
  if (!isResendProductionMode() && !resendAccountEmail()) {
    return 'For local testing, set RESEND_ACCOUNT_EMAIL to your Resend signup email until your domain is verified.'
  }
  return null
}

/** Mask for UI, e.g. j***e@example.com */
export function maskUserEmail(email) {
  const e = (email || '').trim()
  const at = e.indexOf('@')
  if (at < 2) return '***@***'
  const local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const maskedLocal =
    local.length <= 2 ? `${local[0]}***` : `${local[0]}***${local[local.length - 1]}`
  return `${maskedLocal}@${domain}`
}

export function generateUserResetOtpCode() {
  return String(randomInt(100_000, 999_999))
}

/** @param {string} code */
export function hashUserResetOtpCode(code) {
  const normalized = String(code || '').trim()
  return createHash('sha256').update(`${otpPepper()}:user_password_reset:${normalized}`).digest('hex')
}

/** @param {string} code @param {string} expectedHash */
export function verifyUserResetOtpCode(code, expectedHash) {
  const trimmed = String(code || '').trim()
  if (!/^\d{6}$/.test(trimmed) || !expectedHash) return false
  const a = hashUserResetOtpCode(trimmed)
  if (a.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  return diff === 0
}

function buildUserResetOtpHtml({ code, site, fullName }) {
  const greeting = fullName ? `Hi ${fullName},` : 'Hi,'
  return `
    <p style="font-family:system-ui,sans-serif;color:#e7e5e4;">${greeting}</p>
    <p style="font-family:system-ui,sans-serif;color:#e7e5e4;">
      Your ShowSkills Rewards password reset code is:
    </p>
    <p style="font-family:ui-monospace,monospace;font-size:28px;font-weight:700;letter-spacing:0.2em;color:#84cc16;">
      ${code}
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:13px;color:#a8a29e;">
      This code expires in 15 minutes. If you did not request a password reset, you can ignore this email — your password will stay the same.
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:12px;color:#78716c;">${site}</p>
  `.trim()
}

async function postResendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data, status: res.status }
}

/**
 * @param {{ to: string, fullName?: string }} opts
 */
export async function sendUserPasswordResetEmail({ to, fullName }) {
  const intended = (to || '').trim().toLowerCase()
  if (!intended.includes('@')) {
    throw new Error('Invalid email address')
  }

  const apiKey = getResendApiKey()
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set — required for password reset emails')
  }

  const { to: deliverTo, intendedTo, redirected } = resolveCustomerEmailRecipient(intended)
  if (!deliverTo.includes('@')) {
    throw new Error('Could not resolve a valid email recipient for password reset')
  }

  if (!isResendProductionMode() && redirected) {
    console.warn(
      `[user-reset] Resend sandbox: sending code to ${deliverTo} instead of ${intendedTo}.`,
    )
  }

  const code = generateUserResetOtpCode()
  const site = resolveSiteUrl()
  const from = resolveResendFrom()
  const subject = 'ShowSkills Rewards password reset code'
  const html = buildUserResetOtpHtml({ code, site, fullName })
  const text = [
    fullName ? `Hi ${fullName},` : 'Hi,',
    '',
    `Your ShowSkills Rewards password reset code is: ${code}`,
    '',
    'This code expires in 15 minutes. If you did not request a password reset, ignore this email.',
    '',
    site,
  ].join('\n')

  let deliveredTo = deliverTo
  let { ok, data, status } = await postResendEmail(apiKey, {
    from,
    to: [deliveredTo],
    subject,
    html,
    text,
  })

  if (!ok) {
    const allowed = parseResendSandboxRecipient(data?.message)
    if (allowed && allowed !== deliveredTo) {
      console.warn(`[user-reset] Retrying send to Resend sandbox inbox ${allowed}`)
      deliveredTo = allowed
      ;({ ok, data, status } = await postResendEmail(apiKey, {
        from,
        to: [allowed],
        subject,
        html,
        text,
      }))
    }
  }

  if (!ok) {
    throw new Error(formatResendError(data, status))
  }

  if (data?.id) {
    console.log(`[user-reset] Sent reset code to ${deliveredTo} (id: ${data.id})`)
  }

  return {
    code,
    codeHash: hashUserResetOtpCode(code),
    deliveredTo,
    intendedTo,
    sandboxRedirect: !isResendProductionMode() && (redirected || deliveredTo !== intendedTo),
  }
}

const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, we sent a 6-digit reset code. Check your inbox and spam folder.'

const SANDBOX_NOTE =
  'Code sent to your Resend account email (local testing). Check that inbox until showskills.co.uk is verified on Resend.'

/** @param {{ sandboxRedirect?: boolean }} sent @param {{ email: string }} ctx */
export function userResetVerificationPayload(sent, { email }) {
  return {
    ok: true,
    verificationRequired: true,
    channel: 'email',
    purpose: 'reset',
    message: 'Enter the 6-digit code from your email, then choose a new password.',
    maskedDestination: maskUserEmail(email),
    sandboxNote: sent?.sandboxRedirect ? SANDBOX_NOTE : undefined,
  }
}

/**
 * Request a password reset email. Always returns a generic message when the email format is valid.
 * @param {string} email
 */
export async function requestUserPasswordReset(email) {
  const e = normalizeAccountEmail(email)
  if (!e.includes('@') || !e.includes('.')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const row = await getUserAuthRowByEmail(e)
  if (!row) {
    return { ok: true, sent: false, message: GENERIC_RESET_MESSAGE }
  }

  const sent = await sendUserPasswordResetEmail({
    to: row.email,
    fullName: row.full_name,
  })

  return {
    ok: true,
    sent: true,
    email: row.email,
    userId: row.id,
    sentResult: sent,
    message: GENERIC_RESET_MESSAGE,
    purpose: row.password_hash ? 'reset' : 'claim',
  }
}

/**
 * @param {{ email: string, code: string, newPassword: string, confirmPassword: string, expectedOtpHash: string }} opts
 */
export async function completeUserPasswordReset({
  email,
  code,
  newPassword,
  confirmPassword,
  expectedOtpHash,
}) {
  if (!/^\d{6}$/.test(String(code || '').trim())) {
    return { ok: false, error: 'Enter the 6-digit code from your email.' }
  }
  if (newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' }
  }
  if (!verifyUserResetOtpCode(code, expectedOtpHash)) {
    return { ok: false, error: 'Invalid or expired code. Request a new reset code.' }
  }

  const row = await getUserAuthRowByEmail(email)
  if (!row) {
    return { ok: false, error: 'Invalid or expired code. Request a new reset code.' }
  }

  let passwordHash
  try {
    passwordHash = await hashUserPassword(newPassword)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid password.' }
  }

  await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [row.id, passwordHash])

  return {
    ok: true,
    message: row.password_hash
      ? 'Password updated. Sign in with your new password.'
      : 'Account secured. Sign in with your new password.',
  }
}
