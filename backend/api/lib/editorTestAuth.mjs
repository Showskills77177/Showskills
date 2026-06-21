import { SignJWT, jwtVerify } from 'jose'
import { parseCookies } from './adminAuth.mjs'

const COOKIE = 'editor_test_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 7

function getSecret() {
  const s = process.env.ADMIN_JWT_SECRET
  if (!s || s.length < 32) return null
  return new TextEncoder().encode(s)
}

/** Off on live showskills.co.uk unless EDITOR_TEST_LOGIN=1. Auto-on for test/local hosts. */
export function isEditorTestLoginEnabled() {
  if (process.env.EDITOR_TEST_LOGIN === '0' || process.env.EDITOR_TEST_LOGIN === 'false') return false
  if (process.env.EDITOR_TEST_LOGIN === '1' || process.env.EDITOR_TEST_LOGIN === 'true') return true
  const site = String(process.env.SITE_URL || '').toLowerCase()
  if (site.includes('localhost') || site.includes('127.0.0.1')) return true
  if (site.includes('vercelshowskillstesteasynow')) return true
  if (site.includes('showskills.co.uk') && process.env.VERCEL_ENV === 'production') return false
  return process.env.NODE_ENV !== 'production'
}

export function getEditorTestCredentials() {
  return {
    user: String(process.env.EDITOR_TEST_USER || 'ruslan').trim(),
    password: String(process.env.EDITOR_TEST_PASSWORD || '1111'),
  }
}

function cookieSecure() {
  const env = process.env.VERCEL_ENV
  if (env === 'development') return false
  if (env === 'preview' || env === 'production') return true
  return process.env.NODE_ENV === 'production'
}

export function getEditorTestTokenFromReq(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie
  const cookies = parseCookies(raw)
  return cookies[COOKIE] || null
}

export async function verifyEditorTestSession(token) {
  if (!token || !isEditorTestLoginEnabled()) return null
  const secret = getSecret()
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'editor_test') return null
    return payload
  } catch {
    return null
  }
}

export async function isEditorTestSession(req) {
  const token = getEditorTestTokenFromReq(req)
  return Boolean(await verifyEditorTestSession(token))
}

export async function signEditorTestSession(username) {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_JWT_SECRET must be set (min 32 characters)')
  return new SignJWT({ role: 'editor_test', user: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret)
}

export function setEditorTestCookieHeader(token) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (cookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function clearEditorTestCookieHeader() {
  const parts = [`${COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']
  if (cookieSecure()) parts.push('Secure')
  return parts.join('; ')
}

export function verifyEditorTestPassword(username, password) {
  const { user, password: expected } = getEditorTestCredentials()
  return username === user && password === expected
}
