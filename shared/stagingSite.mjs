/** Staging hostname used for ShowSkills test deployments. */
export const SHOWSKILLS_STAGING_HOST_FRAGMENT = 'vercelshowskillstesteasynow'

/** @param {string} [hostnameOrUrl] */
export function isShowSkillsStagingHost(hostnameOrUrl = '') {
  return String(hostnameOrUrl).toLowerCase().includes(SHOWSKILLS_STAGING_HOST_FRAGMENT)
}

/** Browser: staging site or local dev — not production main. */
export function isShowSkillsStagingClientEnabled() {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  return isShowSkillsStagingHost(window.location.hostname)
}

/** API / server: staging deployment only — not production main. */
export function isShowSkillsStagingServerEnabled() {
  const siteUrl = String(process.env.SITE_URL || process.env.VERCEL_URL || '').toLowerCase()
  if (isShowSkillsStagingHost(siteUrl)) return true
  const branch = String(process.env.VERCEL_GIT_COMMIT_REF || '').toLowerCase()
  return branch === 'staging'
}
