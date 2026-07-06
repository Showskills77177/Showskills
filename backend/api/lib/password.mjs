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

export async function verifyAdminPassword(plain) {
  const stored = await getStoredAdminPasswordHash()
  if (stored) {
    return bcrypt.compare(plain, stored)
  }

  const hash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (hash) {
    return bcrypt.compare(plain, hash)
  }
  const p = process.env.ADMIN_PASSWORD?.trim() ?? ''
  if (!p) return false
  return plain === p
}
