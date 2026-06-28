/** Geo rules: paid ticket bundles UK-only; free giveaways worldwide. */

export const UK_COUNTRY_CODES = new Set(['GB', 'UK'])

/** @param {string | null | undefined} countryCode */
export function isUkCountryCode(countryCode) {
  return UK_COUNTRY_CODES.has(String(countryCode || '').trim().toUpperCase())
}

/** @param {string | null | undefined} countryCode */
export function paidTicketBundlesAvailable(countryCode) {
  return isUkCountryCode(countryCode)
}

/** Free skill giveaways (shirt, World Cup ball, etc.) — open internationally. */
export function giveawaysAvailableInternationally() {
  return true
}
