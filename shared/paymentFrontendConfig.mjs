/**
 * When to show Cashflows checkout UI. Server still needs CASHFLOWS_* env vars.
 * Production builds default to on so a missing VITE_CASHFLOWS_ENABLED at build time does not hide Pay now.
 */
export function isCashflowsFrontendEnabled(env = import.meta.env) {
  const v = String(env.VITE_CASHFLOWS_ENABLED ?? '')
    .trim()
    .toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  if (v === '1' || v === 'true' || v === 'yes') return true
  // Default on in dev and production unless explicitly disabled.
  return true
}
