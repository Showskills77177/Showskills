import { useCallback, useEffect, useRef, useState } from 'react'
import { loadCashflowsConstructor } from '../lib/loadCashflows'
import { apiUrl } from '../lib/api'
import { CardBrandLogos } from './CardBrandLogos'

const FIELD_IDS = {
  number: 'ss-cf-card-number',
  name: 'ss-cf-card-name',
  expiry: 'ss-cf-card-expiry',
  cvc: 'ss-cf-card-cvc',
  pay: 'ss-cf-pay-button',
  applePay: 'ss-cf-apple-pay',
}

/** Cashflows replaces these inputs with iframes — create outside React to avoid re-render conflicts. */
function createCardInput(id, { inputMode, autoComplete, type = 'tel' }) {
  const input = document.createElement('input')
  input.id = id
  input.type = type
  input.inputMode = inputMode
  input.autocomplete = autoComplete
  input.className = 'ss-cf-field'
  input.setAttribute('aria-required', 'true')
  return input
}

function mountCardField(host, id, options) {
  if (!host) return null
  host.replaceChildren()
  const input = createCardInput(id, options)
  host.appendChild(input)
  return input
}

function PaymentStatusMessage({ status, message }) {
  if (!message) return null
  const tone =
    status === 'error'
      ? 'border-red-500/35 bg-red-950/40 text-red-200'
      : 'border-teal-500/30 bg-teal-950/35 text-teal-100/90'
  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm ${tone}`}
      role={status === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {message}
    </p>
  )
}

/**
 * Cashflows Embedded Checkout — card iframes + Apple Pay (when enabled in Cashflows Portal).
 */
export function CashflowsPaymentForm({
  intentToken,
  isIntegration,
  paymentJobReference,
  amountLabel,
  recordPayload,
  disabled,
  onSuccess,
  onError,
}) {
  const numberHostRef = useRef(null)
  const nameHostRef = useRef(null)
  const expiryHostRef = useRef(null)
  const cvcHostRef = useRef(null)
  const payButtonRef = useRef(null)
  const applePayRef = useRef(null)
  const initGenerationRef = useRef(0)
  const checkoutStartedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [paying, setPaying] = useState(false)
  const [applePayVisible, setApplePayVisible] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const reportError = useCallback(
    (message) => {
      const msg = typeof message === 'string' ? message : 'Payment could not be completed. Please try again.'
      setStatus({ type: 'error', message: msg })
      onError?.(msg)
    },
    [onError],
  )

  const confirmOnServer = useCallback(async () => {
    const res = await fetch(apiUrl('/api/record-cashflows-payment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        paymentJobReference,
        ...recordPayload,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Could not confirm payment')
    }
    if (data.skipped) {
      throw new Error('Payment received but tickets could not be saved. Contact support with your email.')
    }
    onSuccess?.({
      orderRef: data.orderRef,
      ticketNumbers: Array.isArray(data.ticketNumbers) ? data.ticketNumbers : [],
      emailSent: Boolean(data.emailSent),
      customerEmail: data.customerEmail,
      customerFullName: data.customerFullName,
      resumeToken: data.resumeToken,
    })
  }, [paymentJobReference, recordPayload, onSuccess])

  useEffect(() => {
    if (!intentToken) return undefined

    const generation = ++initGenerationRef.current
    let cancelled = false
    setReady(false)
    setApplePayVisible(false)
    setStatus({ type: '', message: '' })
    checkoutStartedRef.current = false

    const clearHosts = () => {
      numberHostRef.current?.replaceChildren()
      nameHostRef.current?.replaceChildren()
      expiryHostRef.current?.replaceChildren()
      cvcHostRef.current?.replaceChildren()
    }

    ;(async () => {
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (cancelled || generation !== initGenerationRef.current) return

        const payBtn = payButtonRef.current
        const appleBtn = applePayRef.current
        if (!payBtn) {
          throw new Error('Payment button is not ready. Please try again.')
        }

        const numberEl = mountCardField(numberHostRef.current, FIELD_IDS.number, {
          inputMode: 'numeric',
          autoComplete: 'cc-number',
        })
        const nameEl = mountCardField(nameHostRef.current, FIELD_IDS.name, {
          inputMode: 'text',
          autoComplete: 'cc-name',
          type: 'text',
        })
        const expiryEl = mountCardField(expiryHostRef.current, FIELD_IDS.expiry, {
          inputMode: 'numeric',
          autoComplete: 'cc-exp',
        })
        const cvcEl = mountCardField(cvcHostRef.current, FIELD_IDS.cvc, {
          inputMode: 'numeric',
          autoComplete: 'cc-csc',
        })

        if (!numberEl || !nameEl || !expiryEl || !cvcEl) {
          throw new Error('Secure card fields could not be mounted. Please try again.')
        }

        if (disabled) {
          numberEl.disabled = true
          nameEl.disabled = true
          expiryEl.disabled = true
          cvcEl.disabled = true
        }

        const Cashflows = await loadCashflowsConstructor()
        if (cancelled || generation !== initGenerationRef.current) return

        const cf = new Cashflows(intentToken, Boolean(isIntegration))
        await cf.initCard(numberEl, nameEl, expiryEl, cvcEl, payBtn)
        if (appleBtn) {
          await cf.initApplePay(appleBtn)
        }

        if (cancelled || generation !== initGenerationRef.current) return

        const checkoutPromise = cf.checkout()
        checkoutStartedRef.current = true

        if (appleBtn) {
          const syncAppleVisibility = () => {
            if (!appleBtn.hidden) setApplePayVisible(true)
          }
          syncAppleVisibility()
          const observer = new MutationObserver(syncAppleVisibility)
          observer.observe(appleBtn, { attributes: true, attributeFilter: ['hidden'] })
          setTimeout(syncAppleVisibility, 1200)
          checkoutPromise.finally(() => observer.disconnect())
        }

        checkoutPromise
          .then(async () => {
            if (cancelled || generation !== initGenerationRef.current) return
            setPaying(true)
            setStatus({ type: 'info', message: 'Confirming your payment…' })
            await confirmOnServer()
          })
          .catch((e) => {
            if (cancelled || generation !== initGenerationRef.current) return
            setPaying(false)
            reportError(e instanceof Error ? e.message : String(e))
          })
          .finally(() => {
            if (!cancelled && generation === initGenerationRef.current) setPaying(false)
          })

        if (!cancelled && generation === initGenerationRef.current) setReady(true)
      } catch (e) {
        if (!cancelled && generation === initGenerationRef.current) {
          clearHosts()
          reportError(
            e instanceof Error
              ? e.message
              : 'Could not load secure card fields. Check your connection and try again.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
      clearHosts()
    }
  }, [intentToken, isIntegration, confirmOnServer, reportError])

  return (
    <div className="ss-cashflows-pay space-y-4">
      <CardBrandLogos className="pb-1" />

      <button
        ref={applePayRef}
        id={FIELD_IDS.applePay}
        type="button"
        hidden={!applePayVisible}
        className={`apple-pay-button w-full ${applePayVisible ? '' : 'hidden'}`}
        aria-label="Pay with Apple Pay"
        disabled={disabled || paying || !ready}
      />

      {applePayVisible ? (
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          or pay by card
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-stone-500">
        Card details are entered in secure Cashflows fields on this page. Payments are processed by Cashflows — we
        never see your full card number.
      </p>

      <div className="space-y-3">
        <div>
          <label htmlFor={FIELD_IDS.number} className="ss-cf-label">
            Card number
          </label>
          <div ref={numberHostRef} />
        </div>
        <div>
          <label htmlFor={FIELD_IDS.name} className="ss-cf-label">
            Name on card
          </label>
          <div ref={nameHostRef} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={FIELD_IDS.expiry} className="ss-cf-label">
              Expiry
            </label>
            <div ref={expiryHostRef} />
          </div>
          <div>
            <label htmlFor={FIELD_IDS.cvc} className="ss-cf-label">
              CVC
            </label>
            <div ref={cvcHostRef} />
          </div>
        </div>
      </div>

      <PaymentStatusMessage status={status.type} message={status.message} />

      <button
        ref={payButtonRef}
        id={FIELD_IDS.pay}
        type="button"
        disabled={disabled || paying || !ready}
        className="ss-cf-pay-button min-h-[48px] w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-base font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {paying ? 'Processing…' : amountLabel ? `Pay ${amountLabel}` : 'Pay with card'}
      </button>

      {!ready && !status.message ? (
        <p className="text-center text-xs text-stone-500" role="status">
          Loading secure card fields…
        </p>
      ) : null}
    </div>
  )
}
