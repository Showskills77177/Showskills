import { createHash, randomInt } from 'node:crypto'

/**
 * Admin login step 2 — email OTP via Resend (free tier: https://resend.com).
 * No paid SMS required. Set RESEND_API_KEY + ADMIN_EMAIL on the server.
 */

export function isAdminEmailOtpConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && adminEmail())
}

export function adminEmail() {
  return (process.env.ADMIN_EMAIL || process.env.ADMIN_OTP_EMAIL || '').trim().toLowerCase()
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

function fromAddress() {
  return (
    process.env.PURCHASE_EMAIL_FROM ||
    process.env.RESEND_FROM ||
    'ShowSkills Rewards <orders@showskills.co.uk>'
  ).trim()
}

/** Send 6-digit code to ADMIN_EMAIL after password succeeded. */
export async function sendAdminLoginOtpEmail() {
  const to = adminEmail()
  if (!to.includes('@')) {
    throw new Error('ADMIN_EMAIL must be a valid email address')
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set — required for admin email verification')
  }

  const code = generateAdminOtpCode()
  const site = (process.env.SITE_URL || 'https://showskills.co.uk').replace(/\/$/, '')

  const html = `
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

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject: 'ShowSkills admin sign-in code',
      html,
      text: `Your ShowSkills admin sign-in code is: ${code}\n\nExpires in 10 minutes. If you did not try to sign in, ignore this email.`,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : 'Could not send verification email'
    throw new Error(msg)
  }

  return { code, codeHash: hashAdminOtpCode(code), to }
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
