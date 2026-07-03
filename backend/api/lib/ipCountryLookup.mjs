import { isPrivateOrLocalIp } from './vpnDetection.mjs'
import { query } from './db.mjs'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** @type {Map<string, { countryCode: string, expiresAt: number }>} */
const cache = new Map()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Resolve ISO country code from a public IP (ip-api.com, same provider as VPN checks).
 * @param {string | null | undefined} ip
 * @returns {Promise<string | null>}
 */
export async function lookupCountryCodeFromIp(ip) {
  const normalized = String(ip || '').trim()
  if (!normalized || isPrivateOrLocalIp(normalized)) return null

  const cached = cache.get(normalized)
  if (cached && Date.now() < cached.expiresAt) return cached.countryCode

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,countryCode`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    const code =
      data?.status === 'success' && typeof data.countryCode === 'string'
        ? data.countryCode.trim().toUpperCase()
        : null
    if (!code || !/^[A-Z]{2}$/.test(code)) return null
    cache.set(normalized, { countryCode: code, expiresAt: Date.now() + CACHE_TTL_MS })
    return code
  } catch (err) {
    console.warn('[ip-country] lookup failed:', normalized, err?.message || err)
    return null
  }
}

/**
 * Backfill country_code on all WC Ball sessions sharing this IP.
 * @param {string} ip
 * @param {string} countryCode
 */
export async function persistWorldCupBallCountryForIp(ip, countryCode) {
  const normalizedIp = String(ip || '').trim()
  const code = String(countryCode || '')
    .trim()
    .toUpperCase()
  if (!normalizedIp || !/^[A-Z]{2}$/.test(code)) return 0

  const r = await query(
    `UPDATE world_cup_ball_sessions
     SET country_code = $2
     WHERE ip_address = $1 AND (country_code IS NULL OR TRIM(country_code) = '')`,
    [normalizedIp, code],
  )
  return Number(r.rowCount ?? r.changes ?? 0)
}

/**
 * Resolve countries for IPs missing on session rows; persists results for future loads.
 * @param {string[]} ips
 * @param {{ maxLookups?: number, delayMs?: number }} [options]
 * @returns {Promise<Map<string, string>>}
 */
export async function resolveAndPersistCountriesForIps(ips, options = {}) {
  const maxLookups = Math.max(1, Math.min(options.maxLookups ?? 20, 45))
  const delayMs = options.delayMs ?? 300
  const unique = [...new Set(ips.map((ip) => String(ip || '').trim()).filter(Boolean))].slice(0, maxLookups)
  /** @type {Map<string, string>} */
  const resolved = new Map()

  for (let i = 0; i < unique.length; i += 1) {
    const ip = unique[i]
    const code = await lookupCountryCodeFromIp(ip)
    if (code) {
      resolved.set(ip, code)
      await persistWorldCupBallCountryForIp(ip, code)
    }
    if (i < unique.length - 1 && delayMs > 0) await sleep(delayMs)
  }

  return resolved
}
