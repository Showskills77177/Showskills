import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatBundlePriceGBP } from '../competitionData'
import { ErrorBanner } from './ErrorBanner'
import { PayPalPayButton } from './PayPalPayButton'
import { StripePaymentForm } from './StripePaymentForm'

/**
 * Full-screen payment step (card, Apple Pay, PayPal) — portaled to document.body for Safari.
 */
export function PaymentCheckoutSheet({
  open,
  onClose,
  amountPence,
  bundleTitle,
  bundleLine,
  preparing,
  paidError,
  hasStripeElements,
  stripePublishableKey,
  paidStripeClientSecret,
  paidStripePaymentIntentId,
  paidFormReadyForPayment,
  recordPayload,
  onStripeSuccess,
  onStripeError,
  onRetryPayment,
  hasPayPal,
  payPalClientId,
  payPalCurrency,
  paypalCreateOrderApi,
  paypalCaptureOrderApi,
  paidBundleId,
  ticketQuantity,
  customerEmail,
  customerFullName,
  paidConsent,
  onPayPalPaid,
  onPayPalError,
  onClearError,
}) {
  useEffect(() => {
    if (open && onClearError) onClearError()
  }, [open, onClearError])

  useEffect(() => {
    if (!open) return
    document.documentElement.classList.add('ss-payment-sheet-open')
    return () => {
      document.documentElement.classList.remove('ss-payment-sheet-open')
    }
  }, [open])

  if (!open) return null

  const amountLabel = formatBundlePriceGBP(amountPence ?? 0)
  const stripeReady = hasStripeElements && Boolean(paidStripeClientSecret)
  const showStripeEmpty = hasStripeElements && !preparing && !paidStripeClientSecret

  const sheet = (
    <div
      className="ss-payment-sheet fixed inset-0 z-[100] flex flex-col bg-stone-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-sheet-title"
    >
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-teal-500/80 via-emerald-500/60 to-transparent" aria-hidden />
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 text-stone-300 hover:bg-white/5"
          aria-label="Back to entry form"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h2 id="payment-sheet-title" className="text-base font-semibold text-stone-100 sm:text-lg">
            How would you like to pay?
          </h2>
          <p className="truncate text-sm text-teal-200/90">
            {bundleTitle ? `${bundleTitle} · ` : ''}
            <span className="font-display tabular-nums text-white">{amountLabel}</span>
          </p>
          {bundleLine ? <p className="truncate text-xs text-stone-500">{bundleLine}</p> : null}
        </div>
      </header>

      <div className="ss-payment-sheet-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {paidError ? <ErrorBanner message={paidError} /> : null}

        {preparing ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400"
              aria-hidden
            />
            <p className="text-sm text-stone-400">Setting up payment…</p>
          </div>
        ) : null}

        {showStripeEmpty ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="max-w-sm text-sm text-stone-400">
              Card payment could not be loaded. Check your connection, disable content blockers for this site, or try
              again.
            </p>
            {onRetryPayment ? (
              <button
                type="button"
                onClick={() => onRetryPayment()}
                className="rounded-xl border border-teal-500/40 bg-teal-950/50 px-5 py-2.5 text-sm font-semibold text-teal-100 hover:bg-teal-900/40"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {stripeReady ? (
          <StripePaymentForm
            publishableKey={stripePublishableKey}
            clientSecret={paidStripeClientSecret}
            paymentIntentId={paidStripePaymentIntentId}
            amountLabel={amountLabel}
            recordPayload={recordPayload}
            disabled={!paidFormReadyForPayment}
            onSuccess={onStripeSuccess}
            onError={onStripeError}
            compact
          />
        ) : null}

        {hasPayPal ? (
          <div className={stripeReady ? 'mt-6' : ''}>
            {stripeReady ? (
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                or
              </p>
            ) : null}
            <PayPalPayButton
              clientId={payPalClientId}
              currency={payPalCurrency}
              createOrderUrl={paypalCreateOrderApi}
              captureOrderUrl={paypalCaptureOrderApi}
              bundleId={paidBundleId}
              ticketQuantity={ticketQuantity}
              customerEmail={customerEmail}
              customerFullName={customerFullName}
              disabled={
                !paidConsent ||
                !customerFullName?.trim() ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail?.trim() || '')
              }
              onPaid={onPayPalPaid}
              onError={onPayPalError}
            />
          </div>
        ) : null}

        {!preparing && !stripeReady && !hasPayPal && !showStripeEmpty ? (
          <p className="py-12 text-center text-sm text-stone-500">No payment methods are configured.</p>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return sheet
  return createPortal(sheet, document.body)
}
