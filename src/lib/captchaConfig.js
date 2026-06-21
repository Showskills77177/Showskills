import { apiUrl } from './api'

let cached

/** Cached public CAPTCHA config from the API. */
export async function fetchCaptchaConfig() {
  if (cached !== undefined) return cached
  try {
    const res = await fetch(apiUrl('/api/captcha-config'), { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    cached = {
      enabled: Boolean(data.enabled),
      challengeUrl: typeof data.challengeUrl === 'string' ? data.challengeUrl : '/api/captcha/challenge',
    }
  } catch {
    cached = { enabled: false, challengeUrl: '/api/captcha/challenge' }
  }
  return cached
}

export function resetCaptchaConfigCache() {
  cached = undefined
}
