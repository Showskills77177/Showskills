import { useCallback, useEffect, useRef, useState } from 'react'
import { loadCashflowsConstructor } from '../lib/loadCashflows'
import { apiUrl } from '../lib/api'
import { CardBrandLogos } from './CardBrandLogos'
import {
  applyCashflowsHostFieldTheme,
  focusCashflowsMountForIos,
  isApplePayEmbeddedAvailable,
  enableCashflowsIframePointerEvents,
  scheduleCashflowsPointerFix,
} from '../lib/cashflowsFocusCompat'

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
  input.placeholder = ''
  input.className = 'ss-cf-field'
  input.setAttribute('aria-required', 'true')
  return input
}

function mountCardField(host, id, options) {
  if (!host) return null
  host.replaceChildren()
  const input = createCardInput(id, options)
  applyCashflowsHostFieldTheme(input)
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

function CardField({ label, htmlFor, hostRef, size }) {
  return (
    <div className="ss-cf-row">
      <label htmlFor={htmlFor} className="ss-cf-label">
        {label}
      </label>
      <div className={`ss-cf-field-host ss-cf-field-host--${size}`}>
        <div ref={hostRef} className="ss-cf-field-host__slot" />
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
  /** `free_verify` — £0 card authorisation for Legacy free online entry */
  flow = 'purchase',
  payButtonLabel,
  panelTitle = 'Debit or credit card',
}) {
  const isFreeVerify = flow === 'free_verify'
  const mountRef = useRef(null)
  const numberHostRef = useRef(null)
  const nameHostRef = useRef(null)
  const expiryHostRef = useRef(null)
  const cvcHostRef = useRef(null)
  const initGenerationRef = useRef(0)
  const pointerFixCleanupRef = useRef(null)
  const prepIdToFieldRef = useRef({})

  const applePaySupported = isApplePayEmbeddedAvailable()

  const [ready, setReady] = useState(false)
  const [paying, setPaying] = useState(false)
  const [applePayVisible, setApplePayVisible] = useState(false)
  const [applePayUnavailable, setApplePayUnavailable] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const mapPreparationIds = useCallback(() => {
    const map = {}
    const pairs = [
      [numberHostRef, 'number'],
      [nameHostRef, 'name'],
      [expiryHostRef, 'expiry'],
      [cvcHostRef, 'cvc'],
    ]
    for (const [ref, key] of pairs) {
      const iframe = ref.current?.querySelector('iframe[data-uuid]')
      const uuid = iframe?.getAttribute('data-uuid')
      if (uuid) map[uuid] = key
    }
    prepIdToFieldRef.current = map
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
    if (isFreeVerify) {
      const res = await fetch(apiUrl('/api/confirm-cashflows-free-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentJobReference,
          token: intentToken,
          ...recordPayload,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not verify card')
      }
      onSuccess?.({
        verified: true,
        paymentJobReference,
        ...data,
      })
      return
    }

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
  }, [isFreeVerify, intentToken, paymentJobReference, recordPayload, onSuccess])

  useEffect(() => {
    if (!intentToken) return undefined

    const generation = ++initGenerationRef.current
    let cancelled = false
    setReady(false)
    setApplePayVisible(false)
    setApplePayUnavailable(false)
    setStatus({ type: '', message: '' })
    prepIdToFieldRef.current = {}
    pointerFixCleanupRef.current?.()
    pointerFixCleanupRef.current = null

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

        if (!document.getElementById(FIELD_IDS.pay)) {
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
        await cf.initCard(numberEl, nameEl, expiryEl, cvcEl, `#${FIELD_IDS.pay}`)
        enableCashflowsIframePointerEvents(mountRef.current)
        mapPreparationIds()

        if (applePaySupported && document.getElementById(FIELD_IDS.applePay)) {
          await cf.initApplePay(`#${FIELD_IDS.applePay}`)
        }

        if (cancelled || generation !== initGenerationRef.current) return

        pointerFixCleanupRef.current = scheduleCashflowsPointerFix(mountRef.current)

        const checkoutPromise = cf.checkout()

        const appleBtn = document.getElementById(FIELD_IDS.applePay)
        if (appleBtn && applePaySupported) {
          const syncAppleVisibility = () => {
            if (!appleBtn.hidden) setApplePayVisible(true)
          }
          syncAppleVisibility()
          const observer = new MutationObserver(syncAppleVisibility)
          observer.observe(appleBtn, { attributes: true, attributeFilter: ['hidden'] })
          setTimeout(syncAppleVisibility, 1200)
          setTimeout(() => {
            if (!appleBtn.hidden) return
            setApplePayUnavailable(true)
          }, 2500)
          checkoutPromise.finally(() => observer.disconnect())
        }

        checkoutPromise
          .then(async () => {
            if (cancelled || generation !== initGenerationRef.current) return
            setPaying(true)
            setStatus({
              type: 'info',
              message: isFreeVerify ? 'Confirming card verification…' : 'Confirming your payment…',
            })
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

        if (!cancelled && generation === initGenerationRef.current) {
          setReady(true)
          focusCashflowsMountForIos()
        }
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
      pointerFixCleanupRef.current?.()
      pointerFixCleanupRef.current = null
      clearHosts()
    }
  }, [
    intentToken,
    isIntegration,
    confirmOnServer,
    reportError,
    applePaySupported,
    disabled,
    mapPreparationIds,
  ])

  return (
    <div ref={mountRef} className="ss-cashflows-pay">
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
            <h3 className="text-sm font-semibold text-stone-100">{panelTitle}</h3>
          </div>
          <CardBrandLogos className="!justify-end !gap-1.5" />
        </div>

        {applePaySupported ? (
          <>
            <button
              id={FIELD_IDS.applePay}
              type="button"
              hidden={!applePayVisible}
              className={`apple-pay-button w-full ${applePayVisible ? 'mb-2' : 'hidden'}`}
              aria-label="Pay with Apple Pay"
              disabled={disabled || paying || !ready}
              data-ss-cf-ignore-focus
            />
            {applePayVisible ? (
              <p className="mb-3 text-center text-[10px] leading-relaxed text-stone-500">
                Apple Pay opens in Safari on iPhone or Mac — use card below on other browsers.
              </p>
            ) : applePayUnavailable ? (
              <p className="mb-3 text-center text-[10px] leading-relaxed text-amber-200/80">
                Apple Pay is not available in this browser session (check Wallet on Mac, domain
                verification, or use card below). Safari card autofill is not the same as the Apple
                Pay button above.
              </p>
            ) : null}
            {applePayVisible ? (
              <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                or pay by card
              </p>
            ) : null}
          </>
        ) : null}

        <div className="ss-checkout-fields space-y-3">
          <CardField
            label="Card number"
            htmlFor={FIELD_IDS.number}
            hostRef={numberHostRef}
            size="card"
          />
          <CardField
            label="Name on card"
            htmlFor={FIELD_IDS.name}
            hostRef={nameHostRef}
            size="name"
          />
          {isIntegration ? (
            <p className="text-[11px] leading-relaxed text-amber-200/85">
              Sandbox: use name <strong className="font-semibold">Luke Skywalker</strong> for a successful payment.
              Other names (e.g. Han Solo) fail 3D Secure on purpose. On the simulator page, choose{' '}
              <strong className="font-semibold">Authentication successful</strong>.
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-stone-500">
              Use the name on your card and complete your bank&apos;s 3D Secure step (app or SMS). A random name
              often causes &quot;3D Secure Authentication Failed&quot;.
            </p>
          )}
          <div className="ss-cf-inline-fields">
            <CardField
              label="Expiry"
              htmlFor={FIELD_IDS.expiry}
              hostRef={expiryHostRef}
              size="expiry"
            />
            <CardField
              label="Security code"
              htmlFor={FIELD_IDS.cvc}
              hostRef={cvcHostRef}
              size="cvc"
            />
          </div>
        </div>

        <p className="ss-checkout-trust mt-3 text-center text-[11px] leading-relaxed text-stone-500">
          {isFreeVerify
            ? '£0.00 authorisation only — your card will not be charged. Secured by Cashflows.'
            : 'Secured by Cashflows — card details never touch our servers.'}
        </p>
      </div>

      <PaymentStatusMessage status={status.type} message={status.message} />

      <input
        id={FIELD_IDS.pay}
        type="button"
        value={
          paying
            ? isFreeVerify
              ? 'Verifying…'
              : 'Processing…'
            : payButtonLabel || (amountLabel ? `Pay ${amountLabel}` : 'Pay with card')
        }
        disabled={disabled || paying || !ready}
        data-ss-cf-ignore-focus
        className="ss-cf-pay-button mt-4 min-h-[50px] w-full cursor-pointer rounded-xl border-0 bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-base font-bold text-white shadow-lg shadow-teal-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {!ready && !status.message ? (
        <p className="mt-3 text-center text-xs text-stone-500" role="status">
          Loading secure card fields…
        </p>
      ) : null}
    </div>
  )
}
