import { countryDisplayName } from './trafficSource.mjs'

/** Cash prize for winners outside the United Kingdom (USD). */
export const WORLD_CUP_BALL_INTERNATIONAL_CASH_USD = 60

export const WORLD_CUP_BALL_UK_COUNTRY_CODES = new Set(['GB', 'UK'])

/** @typedef {'uk_ball' | 'international_cash'} WorldCupBallPrizeFulfilment */

/** ISO 3166-1 alpha-2 codes offered on the winner claim form (GB first, then alphabetical). */
export const WORLD_CUP_BALL_COUNTRY_CODES = [
  'GB',
  'AE',
  'AR',
  'AT',
  'AU',
  'BE',
  'BR',
  'CA',
  'CH',
  'CN',
  'CY',
  'CZ',
  'DE',
  'DK',
  'ES',
  'FI',
  'FR',
  'GR',
  'HK',
  'IE',
  'IN',
  'IT',
  'JP',
  'KR',
  'MT',
  'MX',
  'NG',
  'NL',
  'NO',
  'NZ',
  'PK',
  'PL',
  'PT',
  'RO',
  'SA',
  'SE',
  'SG',
  'US',
  'ZA',
]

/** @param {string | null | undefined} countryCode */
export function isWorldCupBallUkCountry(countryCode) {
  return WORLD_CUP_BALL_UK_COUNTRY_CODES.has(String(countryCode || '').trim().toUpperCase())
}

/** @param {string | null | undefined} countryCode @returns {WorldCupBallPrizeFulfilment} */
export function resolveWorldCupBallPrizeFulfilment(countryCode) {
  return isWorldCupBallUkCountry(countryCode) ? 'uk_ball' : 'international_cash'
}

/** @param {string | null | undefined} countryCode */
export function worldCupBallCashPrizeUsdForCountry(countryCode) {
  return resolveWorldCupBallPrizeFulfilment(countryCode) === 'international_cash'
    ? WORLD_CUP_BALL_INTERNATIONAL_CASH_USD
    : null
}

/** @param {string | null | undefined} countryCode */
export function worldCupBallPrizeHeadlineForCountry(countryCode) {
  if (resolveWorldCupBallPrizeFulfilment(countryCode) === 'uk_ball') {
    return 'Official-style FIFA World Cup ball'
  }
  return `USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} cash prize`
}

export const WORLD_CUP_BALL_INTERNATIONAL_CASH_NOTICE = `Winners outside the United Kingdom receive a USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} cash prize by official ShowSkills winning cheque (or agreed transfer where cheque delivery is not practical) instead of physical ball shipment.`

export const WORLD_CUP_BALL_INTERNATIONAL_ENTRY_NOTICE =
  'Open worldwide to entrants aged 16+. UK winners receive the football with free UK delivery; international winners receive the USD $60 cash prize described in our terms.'

/** @returns {{ code: string, name: string }[]} */
export function worldCupBallCountryOptions() {
  return WORLD_CUP_BALL_COUNTRY_CODES.map((code) => ({
    code,
    name: countryDisplayName(code),
  }))
}

/** @param {string | null | undefined} countryCode */
export function normalizeWorldCupBallCountryCode(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  if (!WORLD_CUP_BALL_COUNTRY_CODES.includes(code)) return null
  return code
}
