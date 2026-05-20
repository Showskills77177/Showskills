import { useCallback, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { stripeElementsAppearance } from '../lib/stripeAppearance'
import { getStripePromise } from '../lib/stripeLoader'
import { apiUrl } from '../lib/api'

function PayButton({ amountLabel, disabled, onError, onSuccess, paymentIntentId, recordPayload, elementReady }) {
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
        confirmParams: {
          receipt_email: recordPayload.customerEmail,
        },
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
      className="mt-4 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {paying ? 'Processing…' : `Pay ${amountLabel}`}
    </button>
  )
}

/**
 * Embedded Stripe Payment Element (card only — faster load, fewer Safari issues).
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
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: stripeElementsAppearance,
      loader: 'auto',
    }),
    [clientSecret],
  )
  const [elementReady, setElementReady] = useState(false)

  if (!clientSecret) return null

  return (
    <div className="ss-stripe-payment-shell rounded-xl border border-teal-500/25 bg-black/25 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">Secure card payment</p>
      {!elementReady ? (
        <p className="ss-stripe-payment-loading mt-3 text-sm text-stone-500" aria-live="polite">
          Loading secure card form…
        </p>
      ) : null}
      <Elements key={clientSecret} stripe={stripePromise} options={options}>
        <div className={`ss-stripe-payment-element mt-3 ${elementReady ? 'ss-stripe-payment-element--ready' : ''}`}>
          <PaymentElement
            onReady={() => setElementReady(true)}
            onLoadError={(e) => {
              onError(e?.error?.message || 'Could not load card form. Try refreshing or another browser.')
            }}
            options={{
              layout: 'tabs',
              wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
              fields: { billingDetails: { email: 'never', name: 'never', phone: 'never', address: 'never' } },
              terms: { card: 'never', applePay: 'never', googlePay: 'never', link: 'never' },
              business: { name: 'ShowSkills Rewards' },
            }}
          />
        </div>
        <PayButton
          amountLabel={amountLabel}
          disabled={disabled}
          elementReady={elementReady}
          onError={onError}
          onSuccess={onSuccess}
          paymentIntentId={paymentIntentId}
          recordPayload={recordPayload}
        />
      </Elements>
    </div>
  )
}
