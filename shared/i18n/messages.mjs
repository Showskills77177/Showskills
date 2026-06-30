import { EN_MESSAGES } from './locales/en.mjs'
import { DEFAULT_SITE_LOCALE, SITE_LOCALE_OPTIONS } from './localeMeta.mjs'

/** @typedef {Record<string, string>} MessageTable */

const localeModules = import.meta.glob('./locales/*.mjs', { eager: true })

/** @type {Record<string, MessageTable>} */
export const SITE_MESSAGES = {
  [DEFAULT_SITE_LOCALE]: EN_MESSAGES,
}

for (const { code } of SITE_LOCALE_OPTIONS) {
  if (code === DEFAULT_SITE_LOCALE) continue
  const mod = localeModules[`./locales/${code}.mjs`]
  SITE_MESSAGES[code] = mod?.default || EN_MESSAGES
}

export { EN_MESSAGES }
