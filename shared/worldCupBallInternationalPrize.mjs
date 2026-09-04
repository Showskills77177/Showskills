import { countryDisplayName } from './trafficSource.mjs'

/** Cash prize for winners outside the United Kingdom (USD). */
export const WORLD_CUP_BALL_INTERNATIONAL_CASH_USD = 30

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

/**
 * Physical ball shipping is UK-only, so international winners always get the cash prize. UK
 * winners get the ball by default, but can explicitly opt for the cash prize instead via
 * `{ preferCash: true }` (set from the winner's choice on the claim form).
 * @param {string | null | undefined} countryCode
 * @param {{ preferCash?: boolean }} [options]
 * @returns {WorldCupBallPrizeFulfilment}
 */
export function resolveWorldCupBallPrizeFulfilment(countryCode, { preferCash = false } = {}) {
  if (!isWorldCupBallUkCountry(countryCode)) return 'international_cash'
  return preferCash ? 'international_cash' : 'uk_ball'
}

/** @param {string | null | undefined} countryCode @param {{ preferCash?: boolean }} [options] */
export function worldCupBallCashPrizeUsdForCountry(countryCode, options) {
  return resolveWorldCupBallPrizeFulfilment(countryCode, options) === 'international_cash'
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
  'Open worldwide to entrants aged 16+. UK winners receive the football with free UK delivery; international winners receive the USD $30 cash prize described in our terms.'

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
