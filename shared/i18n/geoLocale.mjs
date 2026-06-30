import { DEFAULT_SITE_LOCALE, normalizeSiteLocale } from './localeMeta.mjs'

/**
 * ISO 3166-1 alpha-2 → site locale for geo-based language selection.
 * Unlisted countries fall back to browser language, then English.
 */
export const COUNTRY_TO_SITE_LOCALE = {
  GB: 'en',
  UK: 'en',
  IE: 'en',
  US: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  NL: 'nl',
  BE: 'nl',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  FR: 'fr',
  LU: 'fr',
  MC: 'fr',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  PT: 'pt',
  BR: 'pt',
  IT: 'it',
  PL: 'pl',
  RU: 'ru',
  BY: 'ru',
  KZ: 'ru',
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  MA: 'ar',
  QA: 'ar',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  SG: 'zh',
  JP: 'ja',
  KR: 'ko',
  IN: 'hi',
  TR: 'tr',
  VN: 'vi',
  ID: 'id',
  UA: 'uk',
  RO: 'ro',
  MD: 'ro',
  SE: 'sv',
  NO: 'sv',
  DK: 'sv',
  FI: 'sv',
}

/**
 * @param {string | null | undefined} countryCode
 * @returns {string | null} locale code when mapped, else null
 */
export function localeForCountryCode(countryCode) {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase()
  if (!code) return null
  const locale = COUNTRY_TO_SITE_LOCALE[code]
  if (!locale) return null
  return normalizeSiteLocale(locale)
}

/**
 * @param {string | null | undefined} countryCode
 * @param {string | null | undefined} [browserLocale]
 */
export function resolveGeoSiteLocale(countryCode, browserLocale) {
  return (
    localeForCountryCode(countryCode) ||
    (browserLocale ? normalizeSiteLocale(browserLocale) : null) ||
    DEFAULT_SITE_LOCALE
  )
}
