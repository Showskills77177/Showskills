/** Paid purchasers only — brief full-fidelity bundle preview (not shown on the public site). */

export const PRIZE_REVEAL_VIEW_SECONDS = 10

/** Extra seconds the signed image URL stays valid server-side (network buffer). */
export const PRIZE_REVEAL_IMAGE_GRACE_SECONDS = 4

/**
 * Public page opened from purchase emails.
 * @param {string} [siteUrl]
 * @param {string} [resumeToken] — per-ticket secret (same as skill-quiz resume link).
 */
export function buildPrizeRevealUrl(siteUrl, resumeToken) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
  const params = new URLSearchParams()
  const token = typeof resumeToken === 'string' ? resumeToken.trim() : ''
  if (token.length >= 20) params.set('token', token)
  const qs = params.toString()
  return qs ? `${base}/prize-reveal?${qs}` : `${base}/prize-reveal`
}
