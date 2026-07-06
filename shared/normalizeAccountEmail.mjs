/**
 * Canonical email for one-account-per-person checks (Gmail aliases, etc.).
 */
export function normalizeAccountEmail(email) {
  const raw = String(email || '').trim().toLowerCase()
  if (!raw.includes('@')) return raw

  const at = raw.lastIndexOf('@')
  let local = raw.slice(0, at)
  let domain = raw.slice(at + 1)

  if (domain === 'googlemail.com') domain = 'gmail.com'

  if (domain === 'gmail.com') {
    const plus = local.indexOf('+')
    if (plus >= 0) local = local.slice(0, plus)
    local = local.replace(/\./g, '')
  }

  return `${local}@${domain}`
}
