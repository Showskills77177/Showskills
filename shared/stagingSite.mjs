/** Staging hostname used for ShowSkills test deployments. */
export const SHOWSKILLS_STAGING_HOST_FRAGMENT = 'vercelshowskillstesteasynow'

/** HTTP / HTML robots directive for unlisted staging deployments. */
export const STAGING_SEARCH_ENGINE_BLOCK = 'noindex, nofollow, noarchive, nosnippet'

export const STAGING_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

export const STAGING_SITEMAP_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n'

/** @param {string} [hostnameOrUrl] */
export function isShowSkillsStagingHost(hostnameOrUrl = '') {
  const host = String(hostnameOrUrl).toLowerCase()
  if (host.includes(SHOWSKILLS_STAGING_HOST_FRAGMENT)) return true
  // Cloudflare Pages preview project (*.pages.dev) — never production.
  if (host.includes('.pages.dev')) return true
  return false
}

/** True when crawlers must not index this hostname (staging test site). */
export function shouldBlockSearchIndexingForHost(hostname = '') {
  return isShowSkillsStagingHost(hostname)
}

/**
 * Build-time guard for injecting noindex into index.html (Vercel staging branch / SITE_URL).
 * @param {{ siteUrl?: string, gitRef?: string, flag?: string }} [opts]
 */
export function shouldBlockSearchIndexingAtBuild({ siteUrl = '', gitRef = '', flag = '' } = {}) {
  const normalizedFlag = String(flag || '').trim().toLowerCase()
  if (normalizedFlag === '1' || normalizedFlag === 'true' || normalizedFlag === 'yes') return true
  if (String(gitRef || '').toLowerCase() === 'staging') return true
  // Cloudflare Pages always injects CF_PAGES=1 for this preview-only project.
  if (String(process.env.CF_PAGES || '').trim() === '1') return true
  return isShowSkillsStagingHost(siteUrl)
}

/** Browser: staging site or local dev — not production main. */
export function isShowSkillsStagingClientEnabled() {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  return isShowSkillsStagingHost(window.location.hostname)
}

/** API / server: staging deployment or local dev — not production live. */
export function isShowSkillsStagingServerEnabled() {
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv === 'production') {
    const siteUrl = String(process.env.SITE_URL || process.env.VERCEL_URL || '').toLowerCase()
    if (isShowSkillsStagingHost(siteUrl)) return true
    const branch = String(process.env.VERCEL_GIT_COMMIT_REF || '').toLowerCase()
    return branch === 'staging'
  }
  // Local `npm run dev:api` / `dev:all`, or Vercel preview/staging deployments
  return true
}
