import { countryDisplayName } from '../../../shared/trafficSource.mjs'

const GEO_HEADER_NAMES = [
  'x-vercel-ip-country',
  'cf-ipcountry',
  'x-country-code',
  'cloudfront-viewer-country',
]

/** @param {import('http').IncomingMessage} req @param {string} name */
function readRequestHeader(req, name) {
  const headers = req?.headers
  if (!headers) return null
  const lower = name.toLowerCase()
  let raw = headers[lower] ?? headers[name]
  if (raw == null && typeof headers.get === 'function') {
    raw = headers.get(name) ?? headers.get(lower)
  }
  if (Array.isArray(raw)) raw = raw[0]
  return typeof raw === 'string' ? raw : null
}

/** @param {import('http').IncomingMessage} req */
export function getCountryCodeFromRequest(req) {
  const override = process.env.VISITOR_COUNTRY?.trim().toUpperCase()
  if (override && /^[A-Z]{2}$/.test(override) && override !== 'XX') return override

  for (const name of GEO_HEADER_NAMES) {
    const raw = readRequestHeader(req, name)
    if (!raw) continue
    const code = raw.trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(code) && code !== 'XX') return code
  }
  return null
}

/** @param {import('http').IncomingMessage} req */
export function getCountryFromRequest(req) {
  const code = getCountryCodeFromRequest(req)
  return {
    countryCode: code,
    countryName: code ? countryDisplayName(code) : null,
  }
}
