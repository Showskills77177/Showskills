/** Social profile URLs/handles — shared by footer, entry form, and admin defaults. */

export const DEFAULT_SOCIAL_HANDLE = 'showskills.rewards'

export const DEFAULT_SOCIAL_LINKS = {
  tiktok: `https://www.tiktok.com/@${DEFAULT_SOCIAL_HANDLE}`,
  instagram: `https://www.instagram.com/${DEFAULT_SOCIAL_HANDLE}/`,
  facebook: 'https://www.facebook.com/share/1ap8Ud8p8X/?mibextid=wwXIfr',
}

const PROFILE_BASE = {
  tiktok: 'https://www.tiktok.com/@',
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
}

/**
 * Turn admin input (full URL, @handle, or bare handle) into a safe external link.
 * @param {'tiktok' | 'instagram' | 'facebook'} platform
 * @param {string} value
 */
export function normalizeSocialLinkUrl(platform, value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const handle = raw.replace(/^@+/, '').replace(/\s+/g, '')
  if (!handle) return ''
  const base = PROFILE_BASE[platform]
  if (!base) return ''
  if (platform === 'instagram') return `${base}${handle}/`
  return `${base}${handle}`
}

/** Merge stored links with code defaults (missing keys only; explicit empty hides a platform). */
export function mergeSocialLinks(input) {
  const out = { ...DEFAULT_SOCIAL_LINKS }
  if (!input || typeof input !== 'object') return out
  for (const key of Object.keys(out)) {
    if (!(key in input)) continue
    out[key] = typeof input[key] === 'string' ? input[key].trim() : ''
  }
  return out
}

export function resolvedSocialLinks(links) {
  const out = {}
  for (const key of Object.keys(DEFAULT_SOCIAL_LINKS)) {
    const hasKey = links && typeof links === 'object' && key in links
    const raw = hasKey
      ? typeof links[key] === 'string'
        ? links[key].trim()
        : ''
      : DEFAULT_SOCIAL_LINKS[key] || ''
    const url = normalizeSocialLinkUrl(key, raw)
    if (url) out[key] = url
  }
  return out
}
