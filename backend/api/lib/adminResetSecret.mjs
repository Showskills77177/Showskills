export const ADMIN_RESET_SECRET_QUESTION = 'What city were you born in?'

function normalizeSecretAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
}

export function adminResetSecretConfigured() {
  return Boolean(normalizeSecretAnswer(process.env.ADMIN_RESET_SECRET_ANSWER))
}

export function getAdminResetSecretQuestion() {
  return (process.env.ADMIN_RESET_SECRET_QUESTION || ADMIN_RESET_SECRET_QUESTION).trim()
}

export function verifyAdminResetSecretAnswer(candidate) {
  const expected = normalizeSecretAnswer(process.env.ADMIN_RESET_SECRET_ANSWER)
  if (!expected) return false
  return normalizeSecretAnswer(candidate) === expected
}
