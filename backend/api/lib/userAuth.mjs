import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'user_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 30

function getSecret() {
  const s = process.env.USER_JWT_SECRET?.trim() || process.env.ADMIN_JWT_SECRET?.trim()
  if (!s || s.length < 32) return null
  return new TextEncoder().encode(s)
}

export { COOKIE as USER_COOKIE_NAME }

export function isUserAuthConfigured() {
  return Boolean(getSecret())
}

/**
 * @param {{ sub: string, email: string }} opts
 */
export async function signUserSession(opts) {
  const secret = getSecret()
  if (!secret) throw new Error('USER_JWT_SECRET or ADMIN_JWT_SECRET must be set (min 32 characters)')
  const sub = typeof opts.sub === 'string' ? opts.sub.trim() : ''
  const email = typeof opts.email === 'string' ? opts.email.trim().toLowerCase() : ''
  if (!sub || !email) throw new Error('Invalid user session payload')
  return new SignJWT({ role: 'user', sub, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret)
}

export async function verifyUserSession(token) {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'user') return null
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) return null
    if (typeof payload.email !== 'string' || !payload.email.trim()) return null
    return payload
  } catch {
    return null
  }
}

function parseCookies(header) {
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

export function getUserTokenFromReq(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie
  const cookies = parseCookies(raw)
  return cookies[COOKIE] || null
}

export async function requireUser(req) {
  const token = getUserTokenFromReq(req)
  const payload = await verifyUserSession(token)
  if (!payload || payload.role !== 'user') {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
  return payload
}

function userCookieSecure() {
  const env = process.env.VERCEL_ENV
  if (env === 'development') return false
  if (env === 'preview' || env === 'production') return true
  return process.env.NODE_ENV === 'production'
}

export function setUserCookieHeader(token) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (userCookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function clearUserCookieHeader() {
  const parts = [`${COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']
  if (userCookieSecure()) parts.push('Secure')
  return parts.join('; ')
}
