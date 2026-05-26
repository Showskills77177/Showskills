/** Lazy-load Cashflows Embedded Checkout client (bundled from package source). */
let cashflowsCtorPromise

export function loadCashflowsConstructor() {
  if (!cashflowsCtorPromise) {
    cashflowsCtorPromise = import('cashflows-clientlib-js/src/cashflows.js').then((mod) => {
      const Ctor = mod.Cashflows || mod.default
      if (typeof Ctor !== 'function') {
        throw new Error('Cashflows client library did not export a constructor')
      }
      return Ctor
    })
  }
  return cashflowsCtorPromise
}
