import { DEFAULT_TICKET_BUNDLE_ID, TEST_TICKET_BUNDLE_ID } from '../competitionData'

/** Whether the £0.30 test bundle appears in the entry modal. */
export function isTestBundleVisible(searchParams) {
  if (import.meta.env.DEV) return true
  const flag = import.meta.env.VITE_SHOW_TEST_BUNDLE
  if (flag === '1' || flag === 'true') return true
  return Boolean(searchParams?.has?.('testbundle'))
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
