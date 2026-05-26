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

    let cancelled = false
    setReady(false)
    setApplePayVisible(false)
    setStatus({ type: '', message: '' })
    checkoutStartedRef.current = false

    ;(async () => {
      try {
        const Cashflows = await loadCashflowsConstructor()
        if (cancelled) return

        const cf = new Cashflows(intentToken, Boolean(isIntegration))
        const inits = [
          cf.initCard(
            `#${FIELD_IDS.number}`,
            `#${FIELD_IDS.name}`,
            `#${FIELD_IDS.expiry}`,
            `#${FIELD_IDS.cvc}`,
            `#${FIELD_IDS.pay}`,
          ),
          cf.initApplePay(`#${FIELD_IDS.applePay}`),
        ]

        await Promise.all(inits)
        if (cancelled) return

        const checkoutPromise = cf.checkout()
        checkoutStartedRef.current = true

        const appleBtn = document.getElementById(FIELD_IDS.applePay)
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
            if (cancelled) return
            setPaying(true)
            setStatus({ type: 'info', message: 'Confirming your payment…' })
            await confirmOnServer()
          })
          .catch((e) => {
            if (cancelled) return
            setPaying(false)
            reportError(e instanceof Error ? e.message : String(e))
          })
          .finally(() => {
            if (!cancelled) setPaying(false)
          })

        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) {
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
    }
  }, [intentToken, isIntegration, confirmOnServer, reportError])

  return (
    <div className="ss-cashflows-pay space-y-4">
      <CardBrandLogos className="pb-1" />

      <button
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
          <input
            id={FIELD_IDS.number}
            type="tel"
            inputMode="numeric"
            autoComplete="cc-number"
            className="ss-cf-field"
            disabled={disabled || paying}
            aria-required
          />
        </div>
        <div>
          <label htmlFor={FIELD_IDS.name} className="ss-cf-label">
            Name on card
          </label>
          <input
            id={FIELD_IDS.name}
            type="text"
            autoComplete="cc-name"
            className="ss-cf-field"
            disabled={disabled || paying}
            aria-required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={FIELD_IDS.expiry} className="ss-cf-label">
              Expiry
            </label>
            <input
              id={FIELD_IDS.expiry}
              type="tel"
              inputMode="numeric"
              autoComplete="cc-exp"
              className="ss-cf-field"
              disabled={disabled || paying}
              aria-required
            />
          </div>
          <div>
            <label htmlFor={FIELD_IDS.cvc} className="ss-cf-label">
              CVC
            </label>
            <input
              id={FIELD_IDS.cvc}
              type="tel"
              inputMode="numeric"
              autoComplete="cc-csc"
              className="ss-cf-field"
              disabled={disabled || paying}
              aria-required
            />
          </div>
        </div>
      </div>

      <PaymentStatusMessage status={status.type} message={status.message} />

      <button
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
