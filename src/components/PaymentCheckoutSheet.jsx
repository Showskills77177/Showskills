import { formatBundlePriceGBP } from '../competitionData'
import { ErrorBanner } from './ErrorBanner'
import { PayPalPayButton } from './PayPalPayButton'
import { StripePaymentForm } from './StripePaymentForm'

/**
 * Full-screen payment step (card, Apple Pay, PayPal) — sits above the entry modal.
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
}) {
  if (!open) return null

  const amountLabel = formatBundlePriceGBP(amountPence ?? 0)

  return (
    <div
      className="ss-payment-sheet fixed inset-0 z-[70] flex flex-col bg-stone-950"
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        {paidError ? <ErrorBanner message={paidError} /> : null}

        {preparing ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400"
              aria-hidden
            />
            <p className="text-sm text-stone-400">Loading secure payment…</p>
          </div>
        ) : null}

        {!preparing && hasStripeElements && paidStripeClientSecret ? (
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

        {!preparing && hasPayPal ? (
          <div className={hasStripeElements && paidStripeClientSecret ? 'mt-6' : ''}>
            {hasStripeElements && paidStripeClientSecret ? (
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
      </div>
    </div>
  )
}
