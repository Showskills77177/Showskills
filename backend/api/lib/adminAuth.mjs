import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'admin_session'
const MAX_AGE_SEC = 60 * 60 * 8

function getSecret() {
  const s = process.env.ADMIN_JWT_SECRET
  if (!s || s.length < 32) return null
  return new TextEncoder().encode(s)
}

export { COOKIE as ADMIN_COOKIE_NAME }

export async function signAdminSession() {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_JWT_SECRET must be set (min 32 characters)')
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret)
}

export async function verifyAdminSession(token) {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin') return null
    return payload
  } catch {
    return null
  }
}

export function parseCookies(header) {
  const out = {}
  if (!header || typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    out[k] = decodeURIComponent(v)
  }
  return out
}

export function getAdminTokenFromReq(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie
  const cookies = parseCookies(raw)
  return cookies[COOKIE] || null
}

export async function requireAdmin(req) {
  const token = getAdminTokenFromReq(req)
  const payload = await verifyAdminSession(token)
  if (!payload) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
  return payload
}

/**
 * `vercel dev` uses http://127.0.0.1 — browsers ignore `Secure` cookies there, so login would
 * return 200 but the session cookie would never stick. Use VERCEL_ENV when present.
 */
function adminCookieSecure() {
  const env = process.env.VERCEL_ENV
  if (env === 'development') return false
  if (env === 'preview' || env === 'production') return true
  return process.env.NODE_ENV === 'production'
}

export function setAdminCookieHeader(token) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (adminCookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function clearAdminCookieHeader() {
  const parts = [`${COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']
  if (adminCookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function isAdminAuthConfigured() {
  return Boolean(
    process.env.ADMIN_USER?.trim() &&
      (process.env.ADMIN_PASSWORD?.trim() || process.env.ADMIN_PASSWORD_HASH?.trim()) &&
      process.env.ADMIN_JWT_SECRET &&
      process.env.ADMIN_JWT_SECRET.length >= 32,
  )
}
