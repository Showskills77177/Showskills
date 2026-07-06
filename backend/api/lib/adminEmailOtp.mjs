import { createHash, randomInt } from 'node:crypto'
import {
  resolveResendFrom,
  resolveAdminOtpRecipient,
  formatResendError,
  resendAccountEmail,
  isResendProductionMode,
  parseResendSandboxRecipient,
  resolveSiteUrl,
  getResendApiKey,
} from './resendConfig.mjs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'

/**
 * Admin login step 2 — email OTP via Resend (free tier: https://resend.com).
 * Set RESEND_API_KEY + ADMIN_EMAIL on the server.
 * Local dev: also set RESEND_ACCOUNT_EMAIL to your Resend signup email until domain is verified.
 */

export function isAdminEmailOtpConfigured() {
  return Boolean(getResendApiKey() && adminEmail().includes('@'))
}

/**
 * Password-only admin sign-in (no 6-digit email code).
 * Staging hostname: ADMIN_SKIP_EMAIL_OTP=1 works even when VERCEL_ENV=production.
 */
export function isAdminEmailOtpBypassed() {
  const skipOtp =
    process.env.ADMIN_SKIP_EMAIL_OTP === '1' || process.env.ADMIN_SKIP_EMAIL_OTP === 'true'

  if (skipOtp && isShowSkillsStagingServerEnabled()) return true

  if (process.env.VERCEL_ENV === 'production') return false
  if (
    process.env.ADMIN_REQUIRE_EMAIL_OTP === '1' ||
    process.env.ADMIN_REQUIRE_EMAIL_OTP === 'true'
  ) {
    return false
  }
  if (process.env.E2E_MODE === '1' || process.env.E2E_MODE === 'true') return true
  if (skipOtp) return true
  return !process.env.VERCEL
}

export function adminEmail() {
  return (process.env.ADMIN_EMAIL || process.env.ADMIN_OTP_EMAIL || '').trim().toLowerCase()
}

export function adminLoginUsername() {
  return (process.env.ADMIN_USER || '').trim()
}

/** Password reset accepts admin username or the configured ADMIN_EMAIL. */
export function matchesAdminLoginIdentity(input) {
  const value = typeof input === 'string' ? input.trim() : ''
  if (!value) return false
  const username = adminLoginUsername()
  if (username && value === username) return true
  const email = adminEmail()
  if (email.includes('@') && value.toLowerCase() === email) return true
  return false
}

/** Mask for UI, e.g. a***n@showskills.co.uk */
export function maskAdminEmail(email) {
  const e = (email || adminEmail()).trim()
  const at = e.indexOf('@')
  if (at < 2) return '***@***'
  const local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const maskedLocal =
    local.length <= 2 ? `${local[0]}***` : `${local[0]}***${local[local.length - 1]}`
  return `${maskedLocal}@${domain}`
}

function otpPepper() {
  return (process.env.ADMIN_JWT_SECRET || 'dev-insecure-pepper').trim()
}

/** @param {string} code */
export function hashAdminOtpCode(code) {
  const normalized = String(code || '').trim()
  return createHash('sha256').update(`${otpPepper()}:admin_email_otp:${normalized}`).digest('hex')
}

export function generateAdminOtpCode() {
  return String(randomInt(100_000, 999_999))
}

function buildAdminResetOtpHtml(code, site) {
  return `
    <p style="font-family:system-ui,sans-serif;color:#e7e5e4;">
      Your ShowSkills admin password reset code is:
    </p>
    <p style="font-family:ui-monospace,monospace;font-size:28px;font-weight:700;letter-spacing:0.2em;color:#5eead4;">
      ${code}
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:13px;color:#a8a29e;">
      This code expires in 15 minutes. If you did not request a reset, ignore this email and your password will stay the same.
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:12px;color:#78716c;">${site}</p>
  `.trim()
}

async function sendAdminOtpEmail({ purpose }) {
  const configuredAdmin = adminEmail()
  if (!configuredAdmin.includes('@')) {
    throw new Error('ADMIN_EMAIL must be a valid email address')
  }

  const apiKey = getResendApiKey()
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set on the server — required for admin email verification')
  }

  const to = resolveAdminOtpRecipient(configuredAdmin)
  if (!to.includes('@')) {
    throw new Error(
      'Set RESEND_ACCOUNT_EMAIL to your Resend signup email for local testing (or verify a domain for production).',
    )
  }

  if (!isResendProductionMode() && to !== configuredAdmin) {
    console.warn(
      `[admin-otp] Resend sandbox: sending code to ${to} (RESEND_ACCOUNT_EMAIL). ADMIN_EMAIL is ${configuredAdmin}.`,
    )
  }

  const code = generateAdminOtpCode()
  const site = resolveSiteUrl()
  const from = resolveResendFrom()
  const isReset = purpose === 'reset'
  const html = isReset ? buildAdminResetOtpHtml(code, site) : buildAdminOtpHtml(code, site)
  const text = isReset
    ? `Your ShowSkills admin password reset code is: ${code}\n\nExpires in 15 minutes. If you did not request this, ignore this email.`
    : `Your ShowSkills admin sign-in code is: ${code}\n\nExpires in 10 minutes. If you did not try to sign in, ignore this email.`
  const subject = isReset ? 'ShowSkills admin password reset code' : 'ShowSkills admin sign-in code'

  let deliveredTo = to
  let { ok, data, status } = await postResendOtp(apiKey, { from, to, html, text, subject })
  if (!ok) {
    const allowed = parseResendSandboxRecipient(data?.message)
    if (allowed && allowed !== to) {
      console.warn(`[admin-otp] Retrying send to Resend sandbox inbox ${allowed} (was ${to})`)
      deliveredTo = allowed
      ;({ ok, data, status } = await postResendOtp(apiKey, { from, to: allowed, html, text, subject }))
    }
  }
  if (!ok) {
    throw new Error(formatResendError(data, status))
  }

  if (!data?.id) {
    console.warn('[admin-otp] Resend accepted request but returned no email id:', data)
  } else {
    console.log(`[admin-otp] Sent ${purpose} code to ${deliveredTo} from ${from} (id: ${data.id})`)
  }

  return {
    code,
    codeHash: hashAdminOtpCode(code),
    to: deliveredTo,
    deliveredTo,
    configuredAdmin,
    sandboxRedirect: !isResendProductionMode() && deliveredTo !== configuredAdmin,
  }
}

/** Send 6-digit code after password succeeded. */
export async function sendAdminLoginOtpEmail() {
  return sendAdminOtpEmail({ purpose: 'login' })
}

/** Send 6-digit code for admin password reset (after username verified). */
export async function sendAdminPasswordResetOtpEmail() {
  return sendAdminOtpEmail({ purpose: 'reset' })
}

function buildAdminOtpHtml(code, site) {
  return `
    <p style="font-family:system-ui,sans-serif;color:#e7e5e4;">
      Your ShowSkills admin sign-in code is:
    </p>
    <p style="font-family:ui-monospace,monospace;font-size:28px;font-weight:700;letter-spacing:0.2em;color:#5eead4;">
      ${code}
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:13px;color:#a8a29e;">
      This code expires in 10 minutes. If you did not try to sign in, ignore this email.
    </p>
    <p style="font-family:system-ui,sans-serif;font-size:12px;color:#78716c;">${site}</p>
  `.trim()
}

async function postResendOtp(apiKey, { from, to, html, text, subject = 'ShowSkills admin sign-in code' }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data, status: res.status }
}

/** @param {string} code @param {string} expectedHash */
export function verifyAdminOtpCode(code, expectedHash) {
  const trimmed = String(code || '').trim()
  if (!/^\d{6}$/.test(trimmed) || !expectedHash) return false
  const a = hashAdminOtpCode(trimmed)
  if (a.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  return diff === 0
}

const SANDBOX_NOTE =
  'Code sent to your Resend account email (local testing). Check that inbox, not ADMIN_EMAIL, until showskills.co.uk is verified on Resend.'

/** JSON body for login / resend-code after OTP email is sent. */
export function adminOtpVerificationPayload(sent, { purpose = 'login' } = {}) {
  const message =
    purpose === 'reset'
      ? 'Enter the code from your email, then choose a new password.'
      : undefined
  return {
    ok: true,
    verificationRequired: true,
    channel: 'email',
    purpose,
    message,
    maskedDestination: maskAdminEmail(sent.deliveredTo),
    sandboxNote: sent.sandboxRedirect ? SANDBOX_NOTE : undefined,
  }
}

export function getAdminEmailSetupHint() {
  if (!getResendApiKey()) return 'RESEND_API_KEY is missing on the server (Vercel → Production env, then redeploy).'
  if (!adminEmail()) return 'ADMIN_EMAIL is missing on the server.'
  if (!isResendProductionMode() && !resendAccountEmail()) {
    return 'For local testing, set RESEND_ACCOUNT_EMAIL to your Resend signup email (the inbox Resend allows before domain verification).'
  }
  return null
}
