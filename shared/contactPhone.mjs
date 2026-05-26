/** Copy shown beside phone fields on entry forms. */
export const PHONE_COLLECTION_NOTICE =
  'We ask for a mobile number so we can contact you if you win or need to verify your entry. It is used only for this competition and removed after the relevant competition period ends, unless we must keep it longer by law.'

/**
 * @param {string} raw
 * @returns {{ ok: true, phone: string } | { ok: false, error: string }}
 */
export function validateContactPhone(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    return { ok: false, error: 'Please enter a mobile or contact phone number.' }
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    return {
      ok: false,
      error: 'Please enter a valid phone number (at least 10 digits, including country code if outside the UK).',
    }
  }
  return { ok: true, phone: trimmed.slice(0, 32) }
}
