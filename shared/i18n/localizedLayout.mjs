import { DEFAULT_SITE_LOCALE } from './localeMeta.mjs'

/**
 * Pick CMS text or translated default when the CMS value matches the English default (or is empty).
 * @param {string | null | undefined} locale
 * @param {(key: string, params?: Record<string, string | number>) => string} t
 * @param {string} key
 * @param {string | null | undefined} cmsValue
 * @param {string} englishDefault
 */
export function localizedLayoutText(locale, t, key, cmsValue, englishDefault) {
  const trimmed = String(cmsValue || '').trim()
  const fallback = String(englishDefault || '').trim()
  if (!trimmed || trimmed === fallback || locale === DEFAULT_SITE_LOCALE) {
    return t(key) || trimmed || fallback
  }
  return trimmed
}

/**
 * @param {string | null | undefined} locale
 * @param {(key: string) => string} t
 * @param {string} key
 * @param {string | null | undefined} cmsValue
 */
export function localizedLayoutTextOrCms(locale, t, key, cmsValue) {
  const trimmed = String(cmsValue || '').trim()
  if (!trimmed) return t(key)
  if (locale === DEFAULT_SITE_LOCALE) return trimmed
  const translated = t(key)
  return translated || trimmed
}
