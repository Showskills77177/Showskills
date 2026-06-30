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
  const fallback = params?.fallback != null ? String(params.fallback) : null
  let text =
    table[key] || SITE_MESSAGES[DEFAULT_SITE_LOCALE][key] || fallback || key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      if (name === 'fallback') continue
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

export const FOOTER_LABEL_KEYS = {
  competitions: 'footer.competitions',
  newsletter: 'footer.newsletter',
  contact: 'footer.contact',
  faq: 'footer.faq',
  terms: 'footer.terms',
  ticketTerms: 'footer.ticketTerms',
}

/** @param {string | null | undefined} locale @param {{ id?: string, label?: string }} item */
export function translateNavLabel(locale, item) {
  const key = item?.id ? NAV_LABEL_KEYS[item.id] : null
  if (key) return t(locale, key)
  return item?.label || ''
}

/** @param {string | null | undefined} locale @param {{ id?: string, label?: string, action?: string }} link */
export function translateFooterLabel(locale, link) {
  const key = link?.id ? FOOTER_LABEL_KEYS[link.id] : null
  if (key) return t(locale, key)
  if (link?.action === 'terms') return t(locale, 'footer.terms')
  if (link?.action === 'ticketTerms') return t(locale, 'footer.ticketTerms')
  return link?.label || ''
}
