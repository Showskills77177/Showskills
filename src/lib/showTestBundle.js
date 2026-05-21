import { DEFAULT_TICKET_BUNDLE_ID, TEST_TICKET_BUNDLE_ID } from '../competitionData'

function stripePublishableKeyIsTest() {
  const pk = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()
  return pk.startsWith('pk_test_')
}

function hasTestBundleUrlFlag(searchParams) {
  if (searchParams?.has?.('testbundle')) return true
  if (typeof window === 'undefined') return false
  const qs = new URLSearchParams(window.location.search)
  if (qs.has('testbundle')) return true
  try {
    return sessionStorage.getItem('ss_show_test_bundle') === '1'
  } catch {
    return false
  }
}

/** Whether the £0.30 test bundle appears in the entry modal. */
export function isTestBundleVisible(searchParams) {
  const hide = import.meta.env.VITE_HIDE_TEST_BUNDLE
  if (hide === '1' || hide === 'true') return false

  if (import.meta.env.DEV) return true
  if (stripePublishableKeyIsTest()) return true
  const flag = import.meta.env.VITE_SHOW_TEST_BUNDLE
  if (flag === '1' || flag === 'true') return true
  if (hasTestBundleUrlFlag(searchParams)) return true

  // Shown by default so Stripe minimum testing works without extra env vars.
  return true
}

/** Call once on app load to remember ?testbundle=1 across navigations. */
export function persistTestBundleQueryFlag() {
  if (typeof window === 'undefined') return
  const qs = new URLSearchParams(window.location.search)
  if (!qs.has('testbundle')) return
  try {
    sessionStorage.setItem('ss_show_test_bundle', '1')
  } catch {
    /* ignore */
  }
}

/** Default bundle in the entry modal (E2E + dev + ?testbundle=1 use £0.30 Stripe-minimum tier). */
export function getInitialPaidBundleId(searchParams) {
  const forced = (import.meta.env.VITE_DEFAULT_BUNDLE_ID ?? '').trim()
  if (forced) return forced

  const e2eSim =
    import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === 'true' ||
    import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === '1'
  if (e2eSim) return TEST_TICKET_BUNDLE_ID

  if (isTestBundleVisible(searchParams)) return TEST_TICKET_BUNDLE_ID

  return DEFAULT_TICKET_BUNDLE_ID
}
