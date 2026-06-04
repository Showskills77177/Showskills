import { PRIZE_REVEAL_VIEW_SECONDS } from './prizeReveal.mjs'

export { PRIZE_REVEAL_VIEW_SECONDS as SHIRT_PRIZE_REVEAL_VIEW_SECONDS }

/** Public page opened from shirt giveaway confirmation emails. */
export function buildShirtPrizeRevealUrl(siteUrl, previewToken) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
  const params = new URLSearchParams()
  const token = typeof previewToken === 'string' ? previewToken.trim() : ''
  if (token.length >= 20) params.set('token', token)
  const qs = params.toString()
  return qs ? `${base}/shirt-prize-preview?${qs}` : `${base}/shirt-prize-preview`
}
