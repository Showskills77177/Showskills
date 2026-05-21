import { useEffect } from 'react'
import { formatBundlePriceGBP } from '../competitionData'
import { ErrorBanner } from './ErrorBanner'
import { PayPalPayButton } from './PayPalPayButton'
import { StripePaymentForm } from './StripePaymentForm'

/**
 * Payment popup over the entry modal (not full browser window).
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

  if (!open) return null

  const amountLabel = formatBundlePriceGBP(amountPence ?? 0)
  const stripeReady = hasStripeElements && Boolean(paidStripeClientSecret)
  const showStripeEmpty = hasStripeElements && !preparing && !paidStripeClientSecret

  return (
    <div
      className="ss-payment-popup absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 rounded-2xl bg-black/75"
        aria-label="Back to entry form"
        onClick={onClose}
      />
      <div className="ss-payment-popup-panel relative z-10 flex max-h-[min(92%,540px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-teal-500/30 bg-stone-950 shadow-2xl shadow-black/50">
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-teal-500/80 via-emerald-500/60 to-transparent" aria-hidden />
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-300 hover:bg-white/5"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="payment-sheet-title" className="text-sm font-semibold text-stone-100 sm:text-base">
              How would you like to pay?
            </h2>
            <p className="truncate text-xs text-teal-200/90 sm:text-sm">
              {bundleTitle ? `${bundleTitle} · ` : ''}
              <span className="font-display tabular-nums text-white">{amountLabel}</span>
            </p>
            {bundleLine ? <p className="truncate text-[11px] text-stone-500">{bundleLine}</p> : null}
          </div>
        </header>

        <div className="ss-payment-popup-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          {paidError ? <ErrorBanner message={paidError} /> : null}

          {preparing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400"
                aria-hidden
              />
              <p className="text-sm text-stone-400">Setting up payment…</p>
            </div>
          ) : null}

          {showStripeEmpty ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-stone-400">
                Card payment could not load. In Brave/Safari, allow cookies for this site and disable shields for
                showskills.co.uk, then try again.
              </p>
              {onRetryPayment ? (
                <button
                  type="button"
                  onClick={() => onRetryPayment()}
                  className="rounded-xl border border-teal-500/40 bg-teal-950/50 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-900/40"
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
            <div className={stripeReady ? 'mt-4' : ''}>
              {stripeReady ? (
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
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
            <p className="py-8 text-center text-sm text-stone-500">No payment methods are configured.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
