import { setSecurityHeaders } from './securityHeaders.mjs'

function allowedOrigins() {
  const raw = (process.env.ALLOWED_ORIGINS || process.env.SITE_URL || '').trim()
  if (!raw) return null
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export function applyCors(req, res) {
  setSecurityHeaders(res)
  const list = allowedOrigins()
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin.replace(/\/$/, '') : ''
  if (!list) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return
  }
  if (origin && list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
}

export function applyCorsPreflight(req, res) {
  applyCors(req, res)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
