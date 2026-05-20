const buckets = new Map()

/**
 * Lightweight per-IP rate limit (in-memory; resets per server instance).
 * For production at scale, prefer Redis / edge rate limiting.
 */
export function rateLimit(key, { windowMs = 60_000, max = 30 } = {}) {
  const now = Date.now()
  let entry = buckets.get(key)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    buckets.set(key, entry)
  }
  entry.count += 1
  if (entry.count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
  }
  return { ok: true }
}

export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

export function applyRateLimit(req, res, opts) {
  const ip = clientIp(req)
  const pathKey = typeof opts?.pathKey === 'string' ? opts.pathKey : 'api'
  const result = rateLimit(`${pathKey}:${ip}`, opts)
  if (!result.ok) {
    res.setHeader('Retry-After', String(result.retryAfterSec))
    return { blocked: true, retryAfterSec: result.retryAfterSec }
  }
  return { blocked: false }
}
