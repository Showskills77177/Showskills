import { paidTicketBundlesAvailable } from '../../../shared/regionAvailability.mjs'
import { getCountryCodeFromRequest } from './visitorGeo.mjs'

/** @param {import('http').IncomingMessage} req */
export function resolveVisitorCountryCode(req) {
  const code = getCountryCodeFromRequest(req)
  if (code) return code
  const isDev =
    process.env.NODE_ENV !== 'production' ||
    process.env.E2E_MODE === '1' ||
    process.env.E2E_MODE === 'true'
  return isDev ? 'GB' : null
}

/**
 * Block paid ticket checkout outside the UK.
 * @param {import('http').IncomingMessage} req
 * @returns {{ ok: false, error: string, code: string } | null}
 */
export function requireUkForPaidTickets(req) {
  const countryCode = resolveVisitorCountryCode(req)
  if (paidTicketBundlesAvailable(countryCode)) return null
  return {
    ok: false,
    error:
      'Paid ticket bundles are only available to visitors in the United Kingdom. Free giveaways are open worldwide.',
    code: 'uk_paid_only',
  }
}
