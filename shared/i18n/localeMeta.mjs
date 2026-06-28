/** Twenty supported public-site locales (BCP-47 base language codes). */

/** @typedef {{ code: string, label: string, dir: 'ltr' | 'rtl' }} SiteLocaleMeta */

/** @type {SiteLocaleMeta[]} */
export const SITE_LOCALE_OPTIONS = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
  { code: 'it', label: 'Italiano', dir: 'ltr' },
  { code: 'nl', label: 'Nederlands', dir: 'ltr' },
  { code: 'pl', label: 'Polski', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'zh', label: '中文', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'ko', label: '한국어', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'vi', label: 'Tiếng Việt', dir: 'ltr' },
  { code: 'id', label: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'uk', label: 'Українська', dir: 'ltr' },
  { code: 'ro', label: 'Română', dir: 'ltr' },
  { code: 'sv', label: 'Svenska', dir: 'ltr' },
]

export const DEFAULT_SITE_LOCALE = 'en'
export const SITE_LOCALE_STORAGE_KEY = 'ss-site-locale'

/** @param {string | null | undefined} value */
export function normalizeSiteLocale(value) {
  const code = String(value || '')
    .trim()
    .toLowerCase()
    .split('-')[0]
  if (SITE_LOCALE_OPTIONS.some((l) => l.code === code)) return code
  return DEFAULT_SITE_LOCALE
}

/** @param {string | null | undefined} locale */
export function siteLocaleDirection(locale) {
  const code = normalizeSiteLocale(locale)
  return SITE_LOCALE_OPTIONS.find((l) => l.code === code)?.dir || 'ltr'
}
