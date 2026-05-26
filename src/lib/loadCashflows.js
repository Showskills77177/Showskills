/** Lazy-load Cashflows Embedded Checkout client (bundled from package source). */
import { normalizeCashflowsFieldIframe } from './cashflowsFocusCompat.js'

let cashflowsCtorPromise

function patchCashflowsConstructor(Ctor) {
  if (Ctor.__ssPatchedInitCard) return Ctor
  const originalInitCard = Ctor.prototype.initCard
  Ctor.prototype.initCard = function patchedInitCard(...args) {
    return originalInitCard.apply(this, args).then((result) => {
      const preparations = this._preparationIds
      if (preparations && typeof preparations === 'object') {
        for (const key of Object.keys(preparations)) {
          const iframe = preparations[key]?.iframe
          if (iframe) normalizeCashflowsFieldIframe(iframe)
        }
      }
      return result
    })
  }
  Ctor.__ssPatchedInitCard = true
  return Ctor
}

export function loadCashflowsConstructor() {
  if (!cashflowsCtorPromise) {
    cashflowsCtorPromise = import('cashflows-clientlib-js/src/cashflows.js').then((mod) => {
      const Ctor = mod.Cashflows || mod.default
      if (typeof Ctor !== 'function') {
        throw new Error('Cashflows client library did not export a constructor')
      }
      return patchCashflowsConstructor(Ctor)
    })
  }
  return cashflowsCtorPromise
}
