import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { assertStripeJsLoaded, getStripePromise } from '../lib/stripeLoader'
import {
  enablePaymentElementPointerEvents,
  focusStripeMountForIos,
  PAYMENT_ELEMENT_CONTAINER_ID,
} from '../lib/stripeFocusCompat'
import { apiUrl } from '../lib/api'

function SetupElementMount({ onReadyChange, onLoadError }) {
  const elements = useElements()
  const paymentElementRef = useRef(null)
  const pointerFixTimerRef = useRef(null)

  const applyPointerFix = useCallback(() => {
    enablePaymentElementPointerEvents()
    requestAnimationFrame(() => enablePaymentElementPointerEvents())
  }, [])

  const handleReady = useCallback(() => {
    applyPointerFix()
    pointerFixTimerRef.current = window.setInterval(applyPointerFix, 400)
    window.setTimeout(() => {
      if (pointerFixTimerRef.current) {
        clearInterval(pointerFixTimerRef.current)
        pointerFixTimerRef.current = null
      }
    }, 4000)
    onReadyChange(true)
    focusStripeMountForIos()
  }, [applyPointerFix, onReadyChange])

  useEffect(() => {
    onReadyChange(false)
    if (!elements) return undefined

    const container = document.getElementById(PAYMENT_ELEMENT_CONTAINER_ID)
    if (!container) return undefined

    let cancelled = false
    let paymentElement = null

    try {
      paymentElement = elements.create('payment', {
        layout: 'tabs',
        wallets: { applePay: 'auto', googlePay: 'auto' },
      })
      paymentElementRef.current = paymentElement
      paymentElement.on('ready', () => {
        if (!cancelled) handleReady()
      })
      paymentElement.on('loaderror', (event) => {
        if (!cancelled) {
          onReadyChange(false)
          onLoadError(event?.error?.message || 'Could not load card verification.')
        }
      })
      paymentElement.mount(`#${PAYMENT_ELEMENT_CONTAINER_ID}`)
    } catch (err) {
      onLoadError(err instanceof Error ? err.message : 'Could not load verification form.')
      return undefined
    }

    return () => {
      cancelled = true
      try {
        paymentElement?.unmount?.()
      } catch {
        /* ignore */
      }
    }
  }, [elements, handleReady, onReadyChange, onLoadError, applyPointerFix])

  return <div id={PAYMENT_ELEMENT_CONTAINER_ID} />
}

function SetupFormInner({ disabled, onError, onVerified, setupIntentId, confirmPayload }) {
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const handleVerify = useCallback(async () => {
    if (!stripe || !elements || !ready) return
    setBusy(true)
    setMsg('')
    onError('')
    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        onError(submitError.message || 'Check your card details')
        setBusy(false)
        return
      }

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}?free_verify=1`,
        },
      })

      if (error) {
        onError(error.message || 'Card verification failed')
        setBusy(false)
        return
      }

      const siId = setupIntent?.id || setupIntentId
      if (!siId || setupIntent?.status !== 'succeeded') {
        onError('Card verification was not completed. Please try again.')
        setBusy(false)
        return
      }

      const res = await fetch(apiUrl('/api/confirm-free-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...confirmPayload, setupIntentId: siId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not verify card')
      }
      onVerified({ ...data, setupIntentId: siId })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }, [stripe, elements, ready, onError, onVerified, setupIntentId, confirmPayload])

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">
        £0.00 — card verification only
      </p>
      <p className="mt-1 text-xs text-stone-500">
        Card or Apple Pay. Your card will <strong className="text-stone-400">not be charged</strong>. This helps
        prevent fake entries.
      </p>
      <div className="ss-stripe-payment-mount-wrap mt-4">
        {!ready ? (
          <div className="ss-stripe-payment-skeleton" aria-hidden>
            <div className="h-11 animate-pulse rounded-lg bg-white/5" />
            <div className="mt-3 h-11 animate-pulse rounded-lg bg-white/5" />
          </div>
        ) : null}
        <SetupElementMount onReadyChange={setReady} onLoadError={onError} />
      </div>
      {msg ? <p className="mt-2 text-sm text-teal-200/90">{msg}</p> : null}
      <button
        type="button"
        disabled={disabled || busy || !ready}
        onClick={handleVerify}
        className="mt-4 min-h-[48px] w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-base font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Verifying…' : 'Verify card (£0)'}
      </button>
    </div>
  )
}

/**
 * Stripe Setup Intent — £0 card verification for free Legacy Bundle entry.
 */
export function StripeSetupForm({
  publishableKey,
  clientSecret,
  setupIntentId,
  confirmPayload,
  onVerified,
  onError,
  disabled,
}) {
  const stripePromise = useMemo(() => getStripePromise(publishableKey), [publishableKey])
  const options = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: {
              theme: 'night',
              variables: { colorPrimary: '#14b8a6', borderRadius: '8px' },
            },
          }
        : null,
    [clientSecret],
  )
  const [stripeJsOk, setStripeJsOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    assertStripeJsLoaded(publishableKey).then((ok) => {
      if (!cancelled) {
        setStripeJsOk(ok)
        if (!ok) onError('Stripe.js failed to load. Disable ad blockers and refresh.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [publishableKey, onError])

  if (!clientSecret || !options || !stripeJsOk) return null

  return (
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      <SetupFormInner
        disabled={disabled}
        onError={onError}
        onVerified={onVerified}
        setupIntentId={setupIntentId}
        confirmPayload={confirmPayload}
      />
    </Elements>
  )
}
