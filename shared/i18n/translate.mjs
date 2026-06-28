import { DEFAULT_SITE_LOCALE, normalizeSiteLocale } from './localeMeta.mjs'
import { SITE_MESSAGES } from './messages.mjs'

/**
 * @param {string | null | undefined} locale
 * @param {string} key
 * @param {Record<string, string | number> | undefined} params
 */
export function translateSiteMessage(locale, key, params) {
  const code = normalizeSiteLocale(locale)
  const table = SITE_MESSAGES[code] || SITE_MESSAGES[DEFAULT_SITE_LOCALE]
  let text = table[key] || SITE_MESSAGES[DEFAULT_SITE_LOCALE][key] || key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/** @param {string | null | undefined} locale @param {string} key */
export function t(locale, key, params) {
  return translateSiteMessage(locale, key, params)
}

export const NAV_LABEL_KEYS = {
  home: 'nav.home',
  competitions: 'nav.competitions',
  faq: 'nav.faq',
  terms: 'nav.terms',
}

/** @param {string | null | undefined} locale @param {{ id?: string, label?: string }} item */
export function translateNavLabel(locale, item) {
  const key = item?.id ? NAV_LABEL_KEYS[item.id] : null
  if (key) return t(locale, key)
  return item?.label || ''
}
