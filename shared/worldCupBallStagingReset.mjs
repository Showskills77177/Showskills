/** Staging hostname fragment — reset controls only appear when this matches (not production main). */
export const WORLD_CUP_BALL_STAGING_HOST_FRAGMENT = 'vercelshowskillstesteasynow'

export function isWorldCupBallStagingHost(hostname = '') {
  return String(hostname).toLowerCase().includes(WORLD_CUP_BALL_STAGING_HOST_FRAGMENT)
}

/** Browser: staging site or local dev only — never production main. */
export function isWorldCupBallStagingResetClientEnabled() {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  return isWorldCupBallStagingHost(window.location.hostname)
}

/** API: staging deployment only — never production main. */
export function isWorldCupBallStagingResetServerEnabled() {
  const siteUrl = String(process.env.SITE_URL || process.env.VERCEL_URL || '').toLowerCase()
  if (isWorldCupBallStagingHost(siteUrl)) return true
  const branch = String(process.env.VERCEL_GIT_COMMIT_REF || '').toLowerCase()
  return branch === 'staging'
}
