import { FREE_ENTRY_ERRORS } from '../../../shared/freeEntryLimits.mjs'
import { clientIp } from './rateLimit.mjs'

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map()

function cacheGet(ip) {
  const hit = cache.get(ip)
  if (!hit || Date.now() > hit.expiresAt) {
    cache.delete(ip)
    return null
  }
  return hit.value
}

function cacheSet(ip, value) {
  cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function isVpnCheckDisabled() {
  if (process.env.E2E_MODE === '1' || process.env.E2E_MODE === 'true') return true
  if (process.env.VPN_CHECK_DISABLED === '1' || process.env.VPN_CHECK_DISABLED === 'true') return true
  return false
}

export function isPrivateOrLocalIp(ip) {
  const s = String(ip || '').trim().toLowerCase()
  if (!s || s === 'unknown') return true
  if (s === '::1' || s.startsWith('fe80:') || s.startsWith('fc') || s.startsWith('fd')) return true
  if (s.startsWith('::ffff:')) {
    const v4 = s.slice(7)
    return isPrivateOrLocalIp(v4)
  }
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

async function lookupIphub(ip, apiKey) {
  const res = await fetch(`https://v2.api.iphub.info/ip/${encodeURIComponent(ip)}`, {
    headers: { 'X-Key': apiKey },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`IPHub HTTP ${res.status}`)
  const data = await res.json()
  if (data?.block === 1) {
    return { blocked: true, provider: 'iphub', reason: 'proxy_or_hosting' }
  }
  return { blocked: false, provider: 'iphub' }
}

async function lookupIpApi(ip) {
  const res = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,proxy,hosting`,
    { signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) throw new Error(`ip-api HTTP ${res.status}`)
  const data = await res.json()
  if (data?.status !== 'success') {
    return { blocked: false, provider: 'ip-api', uncertain: true }
  }
  if (data.proxy === true || data.hosting === true) {
    return { blocked: true, provider: 'ip-api', reason: data.proxy ? 'proxy' : 'hosting' }
  }
  return { blocked: false, provider: 'ip-api' }
}

/**
 * Returns whether the IP should be treated as VPN/proxy/datacenter.
 * On lookup failure, does not block (logged) so a provider outage does not lock everyone out.
 */
export async function detectVpnOrProxy(ip) {
  const normalized = String(ip || '').trim()
  if (isPrivateOrLocalIp(normalized)) {
    return { blocked: false, skipped: true, reason: 'private_ip' }
  }

  const cached = cacheGet(normalized)
  if (cached) return cached

  if (isVpnCheckDisabled()) {
    const result = { blocked: false, skipped: true, reason: 'disabled' }
    cacheSet(normalized, result)
    return result
  }

  const iphubKey = (process.env.IPHUB_API_KEY || process.env.IPHUB_KEY || '').trim()

  try {
    const result = iphubKey
      ? await lookupIphub(normalized, iphubKey)
      : await lookupIpApi(normalized)
    cacheSet(normalized, result)
    return result
  } catch (err) {
    console.warn('[vpn] lookup failed:', err?.message || err)
    const result = { blocked: false, uncertain: true, reason: 'lookup_failed' }
    cacheSet(normalized, result)
    return result
  }
}

/** Server-side guard for public entry APIs. */
export async function checkVpnForRequest(req) {
  const ip = clientIp(req)
  const detection = await detectVpnOrProxy(ip)
  if (!detection.blocked) {
    return { ok: true, ip, detection }
  }
  return {
    ok: false,
    ip,
    detection,
    error: FREE_ENTRY_ERRORS.vpnNotAllowed,
    code: 'vpn_not_allowed',
  }
}
