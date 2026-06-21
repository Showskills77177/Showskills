import { createChallenge, randomInt } from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2'
import { deriveHmacKeySecret, verify } from 'altcha-lib/frameworks/shared'

let hmacKeySignatureSecretPromise = null

/** Uses ALTCHA_HMAC_KEY, else ADMIN_JWT_SECRET, else a local-only dev fallback. */
export function getCaptchaHmacSecret() {
  const explicit = String(process.env.ALTCHA_HMAC_KEY || process.env.CAPTCHA_HMAC_KEY || '').trim()
  if (explicit) return explicit
  const jwt = String(process.env.ADMIN_JWT_SECRET || '').trim()
  if (jwt) return jwt
  return 'showskills-dev-captcha-hmac-key-local'
}

export function isCaptchaVerificationRequired() {
  if (process.env.E2E_MODE === '1' || process.env.E2E_MODE === 'true') return false
  if (process.env.CAPTCHA_SKIP === '1' || process.env.CAPTCHA_SKIP === 'true') return false
  return Boolean(getCaptchaHmacSecret())
}

async function getHmacKeySignatureSecret(hmacSignatureSecret) {
  if (!hmacKeySignatureSecretPromise) {
    hmacKeySignatureSecretPromise = deriveHmacKeySecret(hmacSignatureSecret)
  }
  return hmacKeySignatureSecretPromise
}

export async function createCaptchaChallengeResponse() {
  const hmacSignatureSecret = getCaptchaHmacSecret()
  const hmacKeySignatureSecret = await getHmacKeySignatureSecret(hmacSignatureSecret)
  return createChallenge({
    algorithm: 'PBKDF2/SHA-256',
    cost: 5_000,
    counter: randomInt(5_000, 10_000),
    deriveKey,
    hmacSignatureSecret,
    hmacKeySignatureSecret,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  })
}

/**
 * @param {string} payloadBase64
 * @returns {Promise<{ ok: true, skipped?: boolean } | { ok: false, error: string, code: string }>}
 */
export async function verifyCaptchaPayload(payloadBase64) {
  if (!isCaptchaVerificationRequired()) {
    return { ok: true, skipped: true }
  }

  const payload = String(payloadBase64 || '').trim()
  if (!payload) {
    return {
      ok: false,
      error: 'Please complete the security check and try again.',
      code: 'captcha_required',
    }
  }

  try {
    const hmacSignatureSecret = getCaptchaHmacSecret()
    const hmacKeySignatureSecret = await getHmacKeySignatureSecret(hmacSignatureSecret)
    const result = await verify(payload, deriveKey, hmacSignatureSecret, hmacKeySignatureSecret)
    if (result?.verification?.verified) return { ok: true }
  } catch (e) {
    console.error('[captcha] verify failed:', e)
    return {
      ok: false,
      error: 'Security check unavailable. Please try again in a moment.',
      code: 'captcha_unavailable',
    }
  }

  return {
    ok: false,
    error: 'Security check failed. Please try again.',
    code: 'captcha_failed',
  }
}
