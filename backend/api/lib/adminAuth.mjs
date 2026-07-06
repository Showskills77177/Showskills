import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'admin_session'
const SMS_PENDING_COOKIE = 'admin_sms_pending'
const RESET_PENDING_COOKIE = 'admin_reset_pending'
const MAX_AGE_SEC = 60 * 60 * 8
const SMS_PENDING_MAX_AGE_SEC = 60 * 10
const RESET_PENDING_MAX_AGE_SEC = 60 * 15

function getSecret() {
  const s = process.env.ADMIN_JWT_SECRET
  if (!s || s.length < 32) return null
  return new TextEncoder().encode(s)
}

export { COOKIE as ADMIN_COOKIE_NAME, SMS_PENDING_COOKIE as ADMIN_SMS_PENDING_COOKIE_NAME, RESET_PENDING_COOKIE as ADMIN_RESET_PENDING_COOKIE_NAME }

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

/** @param {string} codeHash — SHA-256 of OTP (stored only in HttpOnly cookie) */
export async function signAdminSmsPending(codeHash) {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_JWT_SECRET must be set (min 32 characters)')
  return new SignJWT({ role: 'admin_sms_pending', otp: codeHash })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SMS_PENDING_MAX_AGE_SEC}s`)
    .sign(secret)
}

export async function verifyAdminSmsPending(token) {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin_sms_pending') return null
    const otp = typeof payload.otp === 'string' ? payload.otp : ''
    if (!otp) return null
    return payload
  } catch {
    return null
  }
}

export function getAdminSmsPendingFromReq(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie
  const cookies = parseCookies(raw)
  return cookies[SMS_PENDING_COOKIE] || null
}

function cookieParts(name, value, maxAge) {
  const parts = [`${name}=${value}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax']
  if (adminCookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function setAdminSmsPendingCookieHeader(token) {
  return cookieParts(SMS_PENDING_COOKIE, token, SMS_PENDING_MAX_AGE_SEC)
}

export function clearAdminSmsPendingCookieHeader() {
  return cookieParts(SMS_PENDING_COOKIE, '', 0)
}

/** @param {string} codeHash — SHA-256 of password-reset OTP */
export async function signAdminResetPending(codeHash) {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_JWT_SECRET must be set (min 32 characters)')
  return new SignJWT({ role: 'admin_reset_pending', otp: codeHash })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${RESET_PENDING_MAX_AGE_SEC}s`)
    .sign(secret)
}

export async function verifyAdminResetPending(token) {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin_reset_pending') return null
    const otp = typeof payload.otp === 'string' ? payload.otp : ''
    if (!otp) return null
    return payload
  } catch {
    return null
  }
}

export function getAdminResetPendingFromReq(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie
  const cookies = parseCookies(raw)
  return cookies[RESET_PENDING_COOKIE] || null
}

export function setAdminResetPendingCookieHeader(token) {
  return cookieParts(RESET_PENDING_COOKIE, token, RESET_PENDING_MAX_AGE_SEC)
}

export function clearAdminResetPendingCookieHeader() {
  return cookieParts(RESET_PENDING_COOKIE, '', 0)
}

export function isAdminAuthConfigured() {
  return adminAuthConfigStatus().ok
}

/** Safe for API responses — never exposes secret values. */
export function adminAuthConfigStatus() {
  const user = Boolean(process.env.ADMIN_USER?.trim())
  const password = Boolean(process.env.ADMIN_PASSWORD?.trim())
  const passwordHash = Boolean(process.env.ADMIN_PASSWORD_HASH?.trim())
  const jwtRaw = process.env.ADMIN_JWT_SECRET ?? ''
  const jwt = Boolean(jwtRaw.trim())
  const jwtLongEnough = jwtRaw.trim().length >= 32
  const missing = []
  if (!user) missing.push('ADMIN_USER')
  if (!password && !passwordHash) missing.push('ADMIN_PASSWORD or ADMIN_PASSWORD_HASH')
  if (!jwt) missing.push('ADMIN_JWT_SECRET')
  else if (!jwtLongEnough) missing.push('ADMIN_JWT_SECRET (must be 32+ characters)')
  return {
    ok: user && (password || passwordHash) && jwt && jwtLongEnough,
    missing,
    hasAdminUser: user,
    hasAdminPassword: password,
    hasAdminPasswordHash: passwordHash,
    adminJwtSecretLength: jwtRaw.trim().length,
  }
}
