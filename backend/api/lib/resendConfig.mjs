/**
 * Resend sender/recipient rules (https://resend.com/docs):
 * - Without a verified domain, use from onboarding@resend.dev
 * - Without a verified domain, you can only send TO your Resend account email
 */

const RESEND_TEST_FROM = 'ShowSkills Rewards <onboarding@resend.dev>'

/** Verified domain sender (showskills.co.uk on Resend). */
export const SHOWSKILLS_EMAIL_FROM = 'ShowSkills Rewards <orders@showskills.co.uk>'

export const SHOWSKILLS_SITE_URL = 'https://showskills.co.uk'

/** Resend key (Vercel integration may use RESEND_API_KEY). */
export function getResendApiKey() {
  return (process.env.RESEND_API_KEY || process.env.RESEND_KEY || '').trim()
}

/** True only on Vercel Production — local `node server.js` always uses sandbox rules. */
export function isResendProductionMode() {
  if (process.env.RESEND_FORCE_SANDBOX === '1') return false
  if (process.env.VERCEL_ENV === 'production') return true
  if (process.env.RESEND_USE_VERIFIED_DOMAIN === '1' && process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production'
  }
  return false
}

/** Email Resend allows in sandbox (from API error text). */
export function parseResendSandboxRecipient(message) {
  const m = String(message || '').match(/testing emails to your own email address \(([^)]+)\)/i)
  return m?.[1]?.trim().toLowerCase() || ''
}

/** From address — production uses showskills.co.uk; local uses Resend sandbox sender. */
export function resolveResendFrom() {
  const custom = (process.env.PURCHASE_EMAIL_FROM || process.env.RESEND_FROM || '').trim()
  if (isResendProductionMode()) return custom || SHOWSKILLS_EMAIL_FROM
  if (custom && process.env.RESEND_ALLOW_CUSTOM_FROM === '1') return custom
  return RESEND_TEST_FROM
}

export function resolveSiteUrl() {
  return (process.env.SITE_URL || SHOWSKILLS_SITE_URL).replace(/\/$/, '')
}

/** Resend signup email (only recipient allowed until domain is verified). */
export function resendAccountEmail() {
  return (process.env.RESEND_ACCOUNT_EMAIL || process.env.RESEND_TEST_TO || '').trim().toLowerCase()
}

/**
 * Where admin OTP is delivered. In sandbox, must be RESEND_ACCOUNT_EMAIL.
 * @param {string} adminEmail from ADMIN_EMAIL
 */
export function resolveAdminOtpRecipient(adminEmail) {
  const to = (adminEmail || '').trim().toLowerCase()
  if (isResendProductionMode()) return to
  const account = resendAccountEmail()
  if (account) return account
  return to
}

/**
 * Resend sandbox only delivers to the account signup address.
 * In non-production, prefer RESEND_ACCOUNT_EMAIL when set.
 */
export function resolveCustomerEmailRecipient(customerEmail) {
  const intended = (customerEmail || '').trim().toLowerCase()
  if (!intended || !intended.includes('@')) {
    return { to: intended, intendedTo: intended, redirected: false }
  }
  if (isResendProductionMode()) {
    return { to: intended, intendedTo: intended, redirected: false }
  }
  const account = resendAccountEmail()
  if (account) {
    return {
      to: account,
      intendedTo: intended,
      redirected: account !== intended,
    }
  }
  return { to: intended, intendedTo: intended, redirected: false }
}

export function formatResendError(data, status) {
  const msg = typeof data?.message === 'string' ? data.message : ''
  const hint =
    msg.includes('testing emails to your own email') || msg.includes('verify a domain')
      ? ' Set RESEND_ACCOUNT_EMAIL to your Resend signup address for local testing, or verify your domain at resend.com/domains and set PURCHASE_EMAIL_FROM=you@yourdomain.com'
      : ''
  return msg ? `${msg}${hint}` : `Resend API error (HTTP ${status})`
}
