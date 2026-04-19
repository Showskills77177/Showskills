import bcrypt from 'bcryptjs'

export async function verifyAdminPassword(plain) {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (hash) {
    return bcrypt.compare(plain, hash)
  }
  const p = process.env.ADMIN_PASSWORD?.trim() ?? ''
  if (!p) return false
  return plain === p
}
