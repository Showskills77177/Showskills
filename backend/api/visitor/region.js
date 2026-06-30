import { json } from '../lib/http.mjs'
import { countryDisplayName } from '../../../shared/trafficSource.mjs'
import {
  giveawaysAvailableInternationally,
  isUkCountryCode,
  paidTicketBundlesAvailable,
} from '../../../shared/regionAvailability.mjs'
import { localeForCountryCode } from '../../../shared/i18n/geoLocale.mjs'
import { resolveVisitorCountryCode } from '../lib/requireUkForPaidTickets.mjs'

/** GET /api/visitor/region — public geo + product availability for the site shell. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const countryCode = resolveVisitorCountryCode(req)
  const suggestedLocale = localeForCountryCode(countryCode)
  res.setHeader('Cache-Control', 'no-store')
  return json(res, 200, {
    countryCode,
    countryName: countryCode ? countryDisplayName(countryCode) : null,
    isUk: isUkCountryCode(countryCode),
    paidBundlesAvailable: paidTicketBundlesAvailable(countryCode),
    giveawaysInternational: giveawaysAvailableInternationally(),
    suggestedLocale,
  })
}
