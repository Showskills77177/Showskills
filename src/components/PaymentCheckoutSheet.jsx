import { useEffect } from 'react'
import { formatBundlePriceGBP } from '../competitionData'
import { ErrorBanner } from './ErrorBanner'
import { PayPalPayButton } from './PayPalPayButton'
import { StripePaymentForm } from './StripePaymentForm'

/**
 * Payment step overlaid inside the entry modal (single layer — no nested native dialogs).
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
  const showStandalonePayPal = hasPayPal && !hasStripeElements

  const payPalDisabled =
    !paidConsent ||
    !customerFullName?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail?.trim() || '')

  return (
    <div
      className="ss-payment-sheet absolute inset-0 z-20 flex items-center justify-center rounded-2xl p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-sheet-title"
    >
      <div
        className="absolute inset-0 rounded-2xl bg-black/75"
        role="presentation"
        onClick={onClose}
        onKeyDown={() => {}}
      />
      <div
        className="ss-payment-sheet-panel relative z-10 flex max-h-[min(88%,720px)] w-full max-w-lg flex-col overflow-visible rounded-xl border border-teal-500/35 bg-stone-950 shadow-2xl sm:max-w-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 w-full shrink-0 rounded-t-xl bg-gradient-to-r from-teal-500/80 via-emerald-500/60 to-transparent"
          aria-hidden
        />
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-white/10 text-stone-300 hover:bg-white/5"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="payment-sheet-title" className="text-base font-semibold text-stone-100 sm:text-lg">
              Complete payment
            </h2>
            <p className="truncate text-sm text-teal-200/90">
              {bundleTitle ? `${bundleTitle} · ` : ''}
              <span className="font-display tabular-nums text-white">{amountLabel}</span>
            </p>
            {bundleLine ? <p className="truncate text-xs text-stone-500">{bundleLine}</p> : null}
          </div>
        </header>

        {paidError ? (
          <div className="shrink-0 px-4 pt-3 sm:px-5">
            <ErrorBanner message={paidError} />
          </div>
        ) : null}

        {preparing ? (
          <div className="flex shrink-0 flex-col items-center justify-center gap-3 px-4 py-14 text-center">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400"
              aria-hidden
            />
            <p className="text-sm text-stone-400">Preparing secure checkout…</p>
          </div>
        ) : null}

        {showStripeEmpty ? (
          <div className="flex shrink-0 flex-col items-center gap-4 px-4 py-10 text-center">
            <p className="max-w-md text-sm text-stone-400">
              Secure checkout could not start. Allow cookies for this site (Safari / Brave) and try again.
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
          <div className="ss-payment-stripe-zone shrink-0 px-4 py-4 sm:px-5 sm:py-5">
            <StripePaymentForm
              publishableKey={stripePublishableKey}
              clientSecret={paidStripeClientSecret}
              paymentIntentId={paidStripePaymentIntentId}
              amountLabel={amountLabel}
              recordPayload={recordPayload}
              disabled={!paidFormReadyForPayment}
              onSuccess={onStripeSuccess}
              onError={onStripeError}
            />
          </div>
        ) : null}

        {stripeReady && hasPayPal ? (
          <div className="shrink-0 border-t border-white/10 px-4 pb-5 pt-2 sm:px-5">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              or pay with PayPal
            </p>
            <PayPalPayButton
              clientId={payPalClientId}
              currency={payPalCurrency}
              createOrderUrl={paypalCreateOrderApi}
              captureOrderUrl={paypalCaptureOrderApi}
              bundleId={paidBundleId}
              ticketQuantity={ticketQuantity}
              customerEmail={customerEmail}
              customerFullName={customerFullName}
              disabled={payPalDisabled}
              onPaid={onPayPalPaid}
              onError={onPayPalError}
            />
          </div>
        ) : null}

        {showStandalonePayPal && !preparing ? (
          <div className="shrink-0 px-4 py-5 sm:px-5">
            <PayPalPayButton
              clientId={payPalClientId}
              currency={payPalCurrency}
              createOrderUrl={paypalCreateOrderApi}
              captureOrderUrl={paypalCaptureOrderApi}
              bundleId={paidBundleId}
              ticketQuantity={ticketQuantity}
              customerEmail={customerEmail}
              customerFullName={customerFullName}
              disabled={payPalDisabled}
              onPaid={onPayPalPaid}
              onError={onPayPalError}
            />
          </div>
        ) : null}

        {!preparing && !stripeReady && !showStandalonePayPal && !showStripeEmpty ? (
          <p className="px-4 py-10 text-center text-sm text-stone-500">No payment methods are configured.</p>
        ) : null}
      </div>
    </div>
  )
}
