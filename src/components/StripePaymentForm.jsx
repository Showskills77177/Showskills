import { useCallback, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { stripeElementsAppearance } from '../lib/stripeAppearance'
import { apiUrl } from '../lib/api'

function PayButton({ amountLabel, disabled, onError, onSuccess, paymentIntentId, recordPayload }) {
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
      disabled={disabled || paying || !stripe || !elements}
      onClick={handlePay}
      className="mt-4 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {paying ? 'Processing…' : `Pay ${amountLabel}`}
    </button>
  )
}

/**
 * Embedded Stripe Payment Element (card, Apple Pay, Google Pay when eligible).
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
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey])
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: stripeElementsAppearance,
    }),
    [clientSecret],
  )

  if (!clientSecret) return null

  return (
    <div className="rounded-xl border border-teal-500/25 bg-black/25 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">Secure card payment</p>
      <Elements stripe={stripePromise} options={options}>
        <div className="mt-3">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>
        <PayButton
          amountLabel={amountLabel}
          disabled={disabled}
          onError={onError}
          onSuccess={onSuccess}
          paymentIntentId={paymentIntentId}
          recordPayload={recordPayload}
        />
      </Elements>
      <p className="mt-2 text-center text-[10px] text-stone-500">Powered by Stripe</p>
    </div>
  )
}
