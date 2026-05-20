import { useCallback, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { stripeElementsAppearance } from '../lib/stripeAppearance'
import { getStripePromise } from '../lib/stripeLoader'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { apiUrl } from '../lib/api'

/** Billing details for confirmPayment when Payment Element fields are disabled. */
function buildConfirmParams(recordPayload) {
  const email = (recordPayload?.customerEmail || '').trim()
  const name = (recordPayload?.customerFullName || '').trim()
  return {
    receipt_email: email || undefined,
    payment_method_data: {
      billing_details: {
        name: name || undefined,
        email: email || undefined,
      },
    },
  }
}

function PayButton({
  disabled,
  onError,
  onSuccess,
  paymentIntentId,
  recordPayload,
  elementReady,
  compactMobile,
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return
    setPaying(true)
    onError('')
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: buildConfirmParams(recordPayload),
      })
      if (error) {
        onError(error.message || 'Payment failed')
        setPaying(false)
        return
      }
      const piId = paymentIntent?.id || paymentIntentId
      if (!piId) {
        onError('Payment status unclear. Contact support with your email.')
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
      onError(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }, [stripe, elements, onError, onSuccess, paymentIntentId, recordPayload])

  return (
    <button
      type="button"
      disabled={disabled || paying || !stripe || !elements || !elementReady}
      onClick={handlePay}
      className={`mt-3 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
        compactMobile ? 'min-h-[48px] py-3.5 text-base' : 'py-3 text-sm'
      }`}
    >
      {paying ? 'Processing…' : 'Pay now'}
    </button>
  )
}

function PaymentFields({ disabled, onError, onSuccess, paymentIntentId, recordPayload, compact }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [elementReady, setElementReady] = useState(false)

  return (
    <>
      {!compact ? (
        <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">Card, Apple Pay, Google Pay</p>
      ) : null}
      {!elementReady ? (
        <p className="ss-stripe-payment-loading mt-3 text-sm text-stone-500" aria-live="polite">
          Loading payment options…
        </p>
      ) : null}
      <div className={`ss-stripe-payment-element mt-3 ${elementReady ? 'ss-stripe-payment-element--ready' : ''}`}>
        <PaymentElement
          onReady={() => setElementReady(true)}
          onLoadError={(e) => {
            onError(e?.error?.message || 'Could not load payment form. Try refreshing or another browser.')
          }}
          options={{
            layout: isMobile ? 'accordion' : 'tabs',
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
              link: 'never',
            },
            fields: { billingDetails: { email: 'never', name: 'never', phone: 'never', address: 'never' } },
            terms: { card: 'never', applePay: 'never', googlePay: 'never', link: 'never' },
            business: { name: 'ShowSkills Rewards' },
          }}
        />
      </div>
      <PayButton
        disabled={disabled}
        elementReady={elementReady}
        onError={onError}
        onSuccess={onSuccess}
        paymentIntentId={paymentIntentId}
        recordPayload={recordPayload}
        compactMobile={isMobile}
      />
    </>
  )
}

/**
 * Embedded Stripe Payment Element — Apple Pay on Safari/iOS when domain is registered in Stripe.
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
  compact = false,
}) {
  const stripePromise = useMemo(() => getStripePromise(publishableKey), [publishableKey])
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: stripeElementsAppearance,
      loader: 'auto',
    }),
    [clientSecret],
  )

  if (!clientSecret) return null

  return (
    <div
      className={
        compact
          ? 'ss-stripe-payment-shell'
          : 'ss-stripe-payment-shell rounded-xl border border-teal-500/25 bg-black/25 p-4'
      }
    >
      <Elements key={clientSecret} stripe={stripePromise} options={options}>
        <PaymentFields
          disabled={disabled}
          onError={onError}
          onSuccess={onSuccess}
          paymentIntentId={paymentIntentId}
          recordPayload={recordPayload}
          compact={compact}
        />
      </Elements>
    </div>
  )
}
