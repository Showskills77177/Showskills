import { countryDisplayName } from '../../../shared/trafficSource.mjs'

/** @param {import('http').IncomingMessage} req */
export function getCountryCodeFromRequest(req) {
  const raw =
    req.headers['x-vercel-ip-country'] ||
    req.headers['cf-ipcountry'] ||
    req.headers['x-country-code'] ||
    req.headers['cloudfront-viewer-country']
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX') return null
  return code
}

/** @param {import('http').IncomingMessage} req */
export function getCountryFromRequest(req) {
  const code = getCountryCodeFromRequest(req)
  return {
    countryCode: code,
    countryName: code ? countryDisplayName(code) : null,
  }
}
