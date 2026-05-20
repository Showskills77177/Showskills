/** Whether the £0.01 test bundle appears in the entry modal. */
export function isTestBundleVisible(searchParams) {
  if (import.meta.env.DEV) return true
  const flag = import.meta.env.VITE_SHOW_TEST_BUNDLE
  if (flag === '1' || flag === 'true') return true
  return Boolean(searchParams?.has?.('testbundle'))
}
