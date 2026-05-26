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
function createCardInput(id, { inputMode, autoComplete, type = 'tel', placeholder = '' }) {
  const input = document.createElement('input')
  input.id = id
  input.type = type
  input.inputMode = inputMode
  input.autocomplete = autoComplete
  input.placeholder = placeholder
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
 * Covers Cashflows iframe demo placeholders (e.g. 0000 / 000) until the shopper taps the field.
 * Placeholders live inside cross-origin iframes and cannot be removed via CSS.
 */
function SecureCardField({ label, htmlFor, hostRef, ready, revealed, onReveal, maskPlaceholder }) {
  return (
    <div className="ss-cf-row">
      <label htmlFor={htmlFor} className="ss-cf-label">
        {label}
      </label>
      <div
        className={`ss-cf-field-wrap${revealed ? ' ss-cf-field-wrap--revealed' : ''}`}
        onPointerDown={() => {
          if (!revealed) onReveal()
        }}
      >
        <div ref={hostRef} className="ss-cf-field-host" />
        {ready && maskPlaceholder && !revealed ? (
          <div className="ss-cf-field-cover" aria-hidden="true" />
        ) : null}
      </div>
    </div>
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
  const [revealed, setRevealed] = useState({
    number: false,
    name: false,
    expiry: false,
    cvc: false,
  })

  const revealField = useCallback((key) => {
    setRevealed((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }, [])

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
    const onValidate = (event) => {
      if (event?.data?.event === 'validate') {
        setRevealed({ number: true, name: true, expiry: true, cvc: true })
      }
    }
    window.addEventListener('message', onValidate)
    return () => window.removeEventListener('message', onValidate)
  }, [])

  useEffect(() => {
    if (!intentToken) return undefined

    const generation = ++initGenerationRef.current
    let cancelled = false
    setReady(false)
    setApplePayVisible(false)
    setStatus({ type: '', message: '' })
    setRevealed({ number: false, name: false, expiry: false, cvc: false })
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

        const appleBtn = applePayRef.current
        if (!document.getElementById(FIELD_IDS.pay)) {
          throw new Error('Payment button is not ready. Please try again.')
        }

        const numberEl = mountCardField(numberHostRef.current, FIELD_IDS.number, {
          inputMode: 'numeric',
          autoComplete: 'cc-number',
          placeholder: '',
        })
        const nameEl = mountCardField(nameHostRef.current, FIELD_IDS.name, {
          inputMode: 'text',
          autoComplete: 'cc-name',
          type: 'text',
          placeholder: '',
        })
        const expiryEl = mountCardField(expiryHostRef.current, FIELD_IDS.expiry, {
          inputMode: 'numeric',
          autoComplete: 'cc-exp',
          placeholder: '',
        })
        const cvcEl = mountCardField(cvcHostRef.current, FIELD_IDS.cvc, {
          inputMode: 'numeric',
          autoComplete: 'cc-csc',
          placeholder: '',
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
        // Cashflows only accepts an <input> or a CSS selector for the pay control — not HTMLButtonElement.
        await cf.initCard(numberEl, nameEl, expiryEl, cvcEl, `#${FIELD_IDS.pay}`)
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
    <div className="ss-cashflows-pay">
      <div className="ss-checkout-card-panel">
        <div className="ss-checkout-card-panel__head">
          <div className="flex items-center gap-2">
            <span className="ss-checkout-lock" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-stone-100">Debit or credit card</h3>
          </div>
          <CardBrandLogos className="!justify-end !gap-1.5" />
        </div>

        <button
          ref={applePayRef}
          id={FIELD_IDS.applePay}
          type="button"
          hidden={!applePayVisible}
          className={`apple-pay-button w-full ${applePayVisible ? 'mb-4' : 'hidden'}`}
          aria-label="Pay with Apple Pay"
          disabled={disabled || paying || !ready}
        />

        {applePayVisible ? (
          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            or pay by card
          </p>
        ) : null}

        <div className="ss-checkout-fields space-y-3">
          <SecureCardField
            label="Card number"
            htmlFor={FIELD_IDS.number}
            hostRef={numberHostRef}
            ready={ready}
            revealed={revealed.number}
            onReveal={() => revealField('number')}
            maskPlaceholder
          />
          <SecureCardField
            label="Name on card"
            htmlFor={FIELD_IDS.name}
            hostRef={nameHostRef}
            ready={ready}
            revealed={revealed.name}
            onReveal={() => revealField('name')}
          />
          <div className="grid grid-cols-2 gap-3">
            <SecureCardField
              label="Expiry"
              htmlFor={FIELD_IDS.expiry}
              hostRef={expiryHostRef}
              ready={ready}
              revealed={revealed.expiry}
              onReveal={() => revealField('expiry')}
              maskPlaceholder
            />
            <SecureCardField
              label="Security code"
              htmlFor={FIELD_IDS.cvc}
              hostRef={cvcHostRef}
              ready={ready}
              revealed={revealed.cvc}
              onReveal={() => revealField('cvc')}
              maskPlaceholder
            />
          </div>
        </div>

        <p className="ss-checkout-trust mt-3 text-center text-[11px] leading-relaxed text-stone-500">
          Card details are encrypted in secure Cashflows fields. We never see your full card number.
        </p>
      </div>

      <PaymentStatusMessage status={status.type} message={status.message} />

      <button
        ref={payButtonRef}
        id={FIELD_IDS.pay}
        type="button"
        disabled={disabled || paying || !ready}
        className="ss-cf-pay-button mt-4 min-h-[50px] w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-base font-bold text-white shadow-lg shadow-teal-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {paying ? 'Processing…' : amountLabel ? `Pay ${amountLabel}` : 'Pay with card'}
      </button>

      {!ready && !status.message ? (
        <p className="mt-3 text-center text-xs text-stone-500" role="status">
          Loading secure card fields…
        </p>
      ) : null}
    </div>
  )
}
