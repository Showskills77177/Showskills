import { useEffect, useRef } from 'react'
import { formatBundlePriceGBP } from '../competitionData'
import { attachCashflowsFocusCompat } from '../lib/cashflowsFocusCompat'
import { ErrorBanner } from './ErrorBanner'
import { PayPalPayButton } from './PayPalPayButton'
import { CashflowsPaymentForm } from './CashflowsPaymentForm'

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
  hasCashflowsEmbedded,
  paidCashflowsToken,
  paidCashflowsJobRef,
  paidCashflowsIntegration,
  paidFormReadyForPayment,
  googlePayEnabled,
  googlePayMerchantId,
  recordPayload,
  onCardSuccess,
  onCardError,
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
  customerPhone,
  newsletterOptIn,
  paidConsent,
  onPayPalPaid,
  onPayPalError,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open || !panelRef.current) return undefined
    return attachCashflowsFocusCompat(panelRef.current)
  }, [open])

  if (!open) return null

  const amountLabel = formatBundlePriceGBP(amountPence ?? 0)
  const cashflowsReady = hasCashflowsEmbedded && Boolean(paidCashflowsToken && paidCashflowsJobRef)
  const showCardEmpty = hasCashflowsEmbedded && !preparing && !cashflowsReady && !paidError
  const showStandalonePayPal = hasPayPal && !hasCashflowsEmbedded

  const payPalDisabled =
    !paidConsent ||
    !customerFullName?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail?.trim() || '')

  return (
    <div
      className="ss-payment-sheet fixed inset-0 z-[61] flex items-end justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Close payment"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="ss-payment-sheet-panel relative z-10 flex w-full max-w-lg flex-col rounded-xl border border-teal-500/35 bg-stone-950 shadow-2xl sm:max-h-[min(96vh,1080px)] sm:max-w-3xl lg:max-w-5xl lg:max-h-[min(96vh,1160px)] xl:max-w-6xl xl:max-h-[min(96vh,1200px)]"
      >
        <div
          className="h-1 w-full shrink-0 rounded-t-xl bg-gradient-to-r from-teal-500/80 via-emerald-500/60 to-transparent"
          aria-hidden
        />
        <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
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
                Secure checkout
              </h2>
              <p className="text-xs text-stone-500">256-bit encrypted payment</p>
            </div>
          </div>
          {cashflowsReady || preparing ? (
            <div className="ss-checkout-order-summary mt-3 rounded-xl border border-teal-500/20 bg-teal-950/25 px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">Your order</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-stone-100">
                    {bundleTitle || 'Ticket bundle'}
                  </p>
                  {bundleLine ? <p className="truncate text-xs text-stone-500">{bundleLine}</p> : null}
                </div>
                <p className="shrink-0 font-display text-lg font-bold tabular-nums text-white">{amountLabel}</p>
              </div>
            </div>
          ) : null}
        </header>

        <div className="ss-payment-sheet-body flex min-h-0 flex-1 flex-col overflow-hidden">
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

          {showCardEmpty ? (
            <div className="flex shrink-0 flex-col items-center gap-4 overflow-y-auto px-4 py-10 text-center">
              <p className="max-w-md text-sm text-stone-400">
                Secure checkout could not start. Try again in a moment. If this keeps happening, check your
                connection or contact support.
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

          {cashflowsReady ? (
            <div className="ss-payment-cashflows-zone min-h-0 flex-1 overflow-visible px-4 py-4 sm:px-5 sm:py-5">
              <CashflowsPaymentForm
                intentToken={paidCashflowsToken}
                isIntegration={paidCashflowsIntegration}
                paymentJobReference={paidCashflowsJobRef}
                amountLabel={amountLabel}
                recordPayload={recordPayload}
                disabled={!paidFormReadyForPayment}
                googlePayEnabled={googlePayEnabled}
                googlePayMerchantId={googlePayMerchantId}
                onSuccess={onCardSuccess}
                onError={onCardError}
              />
            </div>
          ) : null}

          {cashflowsReady && hasPayPal ? (
            <div className="shrink-0 border-t border-white/10 px-4 pb-5 pt-4 sm:px-5">
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
                customerPhone={customerPhone}
                newsletterOptIn={newsletterOptIn}
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
                customerPhone={customerPhone}
                newsletterOptIn={newsletterOptIn}
                disabled={payPalDisabled}
                onPaid={onPayPalPaid}
                onError={onPayPalError}
              />
            </div>
          ) : null}

          {!preparing && !cashflowsReady && !showStandalonePayPal && !showCardEmpty ? (
            <p className="px-4 py-10 text-center text-sm text-stone-500">No payment methods are configured.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
