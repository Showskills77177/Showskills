const STORAGE_KEY = 'ss_paid_entry_contact'

/** Remember name, email, phone across payment redirect / full page reload. */
export function savePaidEntryContact({ email, fullName, phone }) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: (email || '').trim(),
        fullName: (fullName || '').trim(),
        phone: (phone || '').trim(),
      }),
    )
  } catch {
    /* ignore */
  }
}

/** @returns {{ email: string, fullName: string, phone: string } | null} */
export function loadPaidEntryContact() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return {
      email: typeof data.email === 'string' ? data.email.trim() : '',
      fullName: typeof data.fullName === 'string' ? data.fullName.trim() : '',
      phone: typeof data.phone === 'string' ? data.phone.trim() : '',
    }
  } catch {
    return null
  }
}

export function clearPaidEntryContact() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
