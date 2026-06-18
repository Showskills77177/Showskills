import { WORLD_CUP_BALL_GIVEAWAY_PATH } from './worldCupBallGiveaway.mjs'

/** Query param on the rules / entry page for winner delivery form deep links. */
export const WORLD_CUP_BALL_CLAIM_QUERY_PARAM = 'wc-claim'

/**
 * Public URL for winners to open (or return to) the prize delivery form.
 * @param {string} [siteUrl]
 * @param {string} [claimToken]
 */
export function buildWorldCupBallClaimUrl(siteUrl, claimToken) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
  const token = typeof claimToken === 'string' ? claimToken.trim() : ''
  if (token.length < 20) return `${base}${WORLD_CUP_BALL_GIVEAWAY_PATH}`
  const params = new URLSearchParams()
  params.set(WORLD_CUP_BALL_CLAIM_QUERY_PARAM, token)
  return `${base}${WORLD_CUP_BALL_GIVEAWAY_PATH}?${params.toString()}`
}
