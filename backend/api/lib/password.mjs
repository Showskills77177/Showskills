import bcrypt from 'bcryptjs'
import { getStoredAdminPasswordHash } from './adminPasswordStore.mjs'

const BCRYPT_ROUNDS = 12

export async function hashAdminPassword(plain) {
  const password = typeof plain === 'string' ? plain : ''
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function hashUserPassword(plain) {
  const password = typeof plain === 'string' ? plain : ''
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyUserPassword(plain, storedHash) {
  const hash = typeof storedHash === 'string' ? storedHash.trim() : ''
  if (!hash || typeof plain !== 'string') return false
  return bcrypt.compare(plain, hash)
}

/**
 * Where admin password verification will look first (safe for diagnostics; no secrets).
 * Verification may still accept env credentials when a stale DB hash does not match.
 * @returns {Promise<'database'|'env_hash'|'env_plain'|'none'>}
 */
export async function getAdminPasswordSource() {
  try {
    const stored = await getStoredAdminPasswordHash()
    if (stored) return 'database'
  } catch {
    /* DB unavailable — fall through to env */
  }
  if (process.env.ADMIN_PASSWORD_HASH?.trim()) return 'env_hash'
  if (process.env.ADMIN_PASSWORD?.trim()) return 'env_plain'
  return 'none'
}

async function verifyAgainstEnvPassword(plain) {
  const candidate = typeof plain === 'string' ? plain : ''
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (hash && (await bcrypt.compare(candidate, hash))) return true
  const p = process.env.ADMIN_PASSWORD?.trim() ?? ''
  if (!p) return false
  return candidate === p || candidate.trim() === p
}

/**
 * Prefer DB hash (password-reset), but fall back to Vercel env password/hash so a
 * forgotten DB password cannot permanently lock out Production ADMIN_PASSWORD.
 * Deployed via normal GitHub → Vercel main push.
 */
export async function verifyAdminPassword(plain) {
  const candidate = typeof plain === 'string' ? plain : ''
  try {
    const stored = await getStoredAdminPasswordHash()
    if (stored && (await bcrypt.compare(candidate, stored))) return true
  } catch {
    /* DB unavailable — try env */
  }
  return verifyAgainstEnvPassword(candidate)
}
