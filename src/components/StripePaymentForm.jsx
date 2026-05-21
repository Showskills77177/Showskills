import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripePromise } from '../lib/stripeLoader'
import {
  buildConfirmParams,
  buildPaymentElementOptions,
  buildStripeElementsOptions,
} from '../lib/stripePaymentConfig'
import { apiUrl } from '../lib/api'

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

function PaySubmitButton({ disabled, paying, ready, amountLabel, onPay }) {
  return (
    <button
      type="button"
      disabled={disabled || paying || !ready}
      onClick={onPay}
      className="ss-stripe-pay-button mt-4 min-h-[52px] w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-base font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {paying ? 'Processing…' : amountLabel ? `Pay ${amountLabel}` : 'Pay now'}
    </button>
  )
}

function PaymentElementMount({ recordPayload, onReadyChange, onLoadError, onChangeMessage }) {
  const elements = useElements()
  const elementOptions = useMemo(() => buildPaymentElementOptions(recordPayload), [recordPayload])
  const mountedRef = useRef(false)

  useEffect(() => {
    onReadyChange(false)
    mountedRef.current = false
  }, [recordPayload?.customerEmail, recordPayload?.customerFullName, onReadyChange])

  useEffect(() => {
    if (!elements || mountedRef.current) return
    let cancelled = false
    elements.fetchUpdates?.().catch(() => {})
    const t = requestAnimationFrame(() => {
      if (!cancelled) mountedRef.current = true
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(t)
    }
  }, [elements, elementOptions])

  return (
    <div id="ss-stripe-payment-mount" className="ss-stripe-payment-mount">
      <PaymentElement
        id="ss-payment-element"
        options={elementOptions}
        onReady={() => onReadyChange(true)}
        onLoadError={(event) => {
          onReadyChange(false)
          onLoadError(event?.error?.message || 'Could not load payment methods.')
        }}
        onChange={(event) => {
          if (event.complete) onChangeMessage('')
          else if (event.empty) onChangeMessage('')
        }}
      />
    </div>
  )
}

function PaymentFormInner({
  amountLabel,
  disabled,
  onError,
  onSuccess,
  paymentIntentId,
  recordPayload,
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [elementReady, setElementReady] = useState(false)
  const [paying, setPaying] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState('info')

  const setError = useCallback(
    (msg) => {
      setStatusTone('error')
      setStatusMessage(msg)
      onError(msg)
    },
    [onError],
  )

  const handlePay = useCallback(async () => {
    if (!stripe || !elements || !elementReady) return
    setPaying(true)
    setStatusMessage('')
    onError('')
    try {
      let confirmParams
      try {
        confirmParams = buildConfirmParams(recordPayload)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Missing customer details')
        setPaying(false)
        return
      }

      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Check your payment details')
        setPaying(false)
        return
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams,
      })

      if (error) {
        setError(error.message || 'Payment failed')
        setPaying(false)
        return
      }

      const piId = paymentIntent?.id || paymentIntentId
      if (!piId) {
        setError('Payment status unclear. Contact support with your email.')
        setPaying(false)
        return
      }

      const res = await fetch(apiUrl('/api/record-stripe-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentIntentId: piId,
          ...recordPayload,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save your purchase')
      }
      if (data.skipped) {
        throw new Error(
          data.reason === 'no_database'
            ? 'Payment received but tickets could not be saved (database not configured). Contact support with your email.'
            : 'Payment received but your tickets could not be saved. Contact support with your email.',
        )
      }
      onSuccess({
        orderRef: data.orderRef,
        ticketNumbers: Array.isArray(data.ticketNumbers) ? data.ticketNumbers : [],
        emailSent: Boolean(data.emailSent),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }, [stripe, elements, elementReady, onError, onSuccess, paymentIntentId, recordPayload, setError])

  useEffect(() => {
    if (elementReady) return
    const t = setTimeout(() => {
      setError(
        'Payment methods are taking too long to load. In Brave or Safari, allow cookies for this site and disable shields, then try again.',
      )
    }, 20_000)
    return () => clearTimeout(t)
  }, [elementReady, setError])

  const stripeLoaded = Boolean(stripe && elements)

  return (
    <div className="ss-stripe-payment-panel">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">
        Card, Apple Pay, Google Pay, PayPal
      </p>
      <p className="mt-1 text-xs text-stone-500">
        Choose a method below. Your name and email from the previous step are used for this payment.
      </p>

      {!elementReady ? (
        <div className="ss-stripe-payment-skeleton mt-4" aria-hidden>
          <div className="h-11 animate-pulse rounded-lg bg-white/5" />
          <div className="mt-3 h-11 animate-pulse rounded-lg bg-white/5" />
          <div className="mt-3 h-11 animate-pulse rounded-lg bg-white/5" />
        </div>
      ) : null}

      <PaymentElementMount
        recordPayload={recordPayload}
        onReadyChange={setElementReady}
        onLoadError={setError}
        onChangeMessage={setStatusMessage}
      />

      <PaymentStatusMessage status={statusTone} message={statusMessage} />

      <PaySubmitButton
        amountLabel={amountLabel}
        disabled={disabled}
        paying={paying}
        ready={stripeLoaded && elementReady}
        onPay={handlePay}
      />
    </div>
  )
}

/**
 * Modern Stripe Payment Element (not legacy Card Element).
 * Supports card, wallets, and PayPal when enabled in Stripe Dashboard + PaymentIntent.
 */
export function StripePaymentForm({
  publishableKey,
  clientSecret,
  paymentIntentId,
  amountLabel,
  recordPayload,
  onSuccess,
  onError,
  disabled,
}) {
  const stripePromise = useMemo(() => getStripePromise(publishableKey), [publishableKey])
  const elementsOptions = useMemo(
    () => (clientSecret ? buildStripeElementsOptions(clientSecret) : null),
    [clientSecret],
  )

  if (!clientSecret || !elementsOptions) return null

  return (
    <div className="ss-stripe-payment-shell">
      <Elements
        key={clientSecret}
        stripe={stripePromise}
        options={elementsOptions}
      >
        <PaymentFormInner
          amountLabel={amountLabel}
          disabled={disabled}
          onError={onError}
          onSuccess={onSuccess}
          paymentIntentId={paymentIntentId}
          recordPayload={recordPayload}
        />
      </Elements>
    </div>
  )
}
