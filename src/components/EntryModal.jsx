import { useEffect, useRef, useState } from 'react'
import { useEntryFlow } from '../entry/entryContext'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'

const E2E_SIMULATE_CHECKOUT =
  import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === 'true' ||
  import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === '1'
import {
  COMPETITION_NAME_POSTAL,
  formatBundlePriceGBP,
  validatePaidSkillAnswers,
} from '../competitionData'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import { ErrorBanner } from './ErrorBanner'
import { preloadStripe } from '../lib/stripeLoader'
import { PaymentCheckoutSheet } from './PaymentCheckoutSheet'
import { PayPalPayButton } from './PayPalPayButton'
import { TicketBundlePicker } from './TicketBundlePicker'

export function EntryModal() {
  const {
    entryModalType,
    closeEntry,
    openTerms,
    termsOpen,
    paidBundleId,
    setPaidBundleId,
    paidEntryRoute,
    setPaidEntryRoute,
    paidConsent,
    setPaidConsent,
    paidError,
    setPaidError,
    paidLoading,
    paidPostCheckout,
    paidOrderRef,
    paidTicketNumbers,
    paidA1,
    setPaidA1,
    paidA2,
    setPaidA2,
    paidA3,
    setPaidA3,
    paidQuizError,
    paidQuizResult,
    paidQuizSubmitted,
    paidQuizSubmitting,
    paidEmailConfirmationSent,
    visibleTicketBundles,
    showTestBundle,
    paidFullName,
    setPaidFullName,
    paidEmail,
    setPaidEmail,
    selectedTicketBundle,
    handlePaidEntry,
    handlePaidQuizSubmit,
    markPaidCheckoutComplete,
    hasStripeCheckout,
    hasStripeElements,
    stripePublishableKey,
    paidStripeClientSecret,
    paidStripePaymentIntentId,
    paidStripePreparing,
    prepareStripePayment,
    closeStripePayment,
    paidFormReadyForPayment,
    hasPayPal,
    payPalClientId,
    payPalCurrency,
    paypalCreateOrderApi,
    paypalCaptureOrderApi,
    kickFullName,
    setKickFullName,
    kickAnswer,
    setKickAnswer,
    kickEmail,
    setKickEmail,
    kickConsent,
    setKickConsent,
    kickError,
    setKickError,
    kickSuccess,
    handleKickupsGiveawaySubmit,
    PAID_SKILL_QUESTIONS,
  } = useEntryFlow()

  const panelRef = useRef(null)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)

  const showPaymentSheet =
    paymentSheetOpen &&
    entryModalType === 'paid' &&
    !paidPostCheckout &&
    paidEntryRoute === 'tickets'

  function handleClosePaymentSheet() {
    closeStripePayment()
    setPaymentSheetOpen(false)
    setPaidError('')
  }

  async function handlePayNow() {
    if (!paidFormReadyForPayment) {
      setPaidError('Enter your full name, email, and agree to the terms before paying.')
      return
    }
    setPaidError('')
    if (hasStripeElements && !paidStripeClientSecret) {
      const ready = await prepareStripePayment()
      if (!ready) return
    }
    if (hasStripeElements && !paidStripeClientSecret) return
    if (hasStripeElements && stripePublishableKey) preloadStripe(stripePublishableKey)
    setPaymentSheetOpen(true)
  }

  const paidAnswerValidation =
    paidQuizResult != null ? validatePaidSkillAnswers(paidA1, paidA2, paidA3) : null
  const paidAnswerInputClass = (questionIndex) => {
    const base =
      'mt-2 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2'
    if (!paidAnswerValidation) {
      return `${base} border-white/10 bg-black/30 text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:ring-teal-900/40`
    }
    const correct =
      questionIndex === 0
        ? paidAnswerValidation.q1
        : questionIndex === 1
          ? paidAnswerValidation.q2
          : paidAnswerValidation.q3
    if (!correct) {
      return `${base} border-red-500/80 bg-red-950/45 text-red-100 placeholder:text-red-400/40 focus:border-red-500/70 focus:ring-red-900/50`
    }
    return `${base} border-white/10 bg-black/30 text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:ring-teal-900/40`
  }

  useEffect(() => {
    if (!entryModalType) return
    const scrollY = window.scrollY
    const { style } = document.body
    const prev = {
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow,
    }
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.width = '100%'
    style.overflow = 'hidden'
    return () => {
      style.position = prev.position
      style.top = prev.top
      style.width = prev.width
      style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [entryModalType])

  useEffect(() => {
    if (!entryModalType) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (termsOpen) return
      if (paymentSheetOpen) {
        handleClosePaymentSheet()
        return
      }
      closeEntry()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entryModalType, closeEntry, termsOpen, paymentSheetOpen])

  useEffect(() => {
    if (!entryModalType) setPaymentSheetOpen(false)
  }, [entryModalType])

  useEffect(() => {
    setPaymentSheetOpen(false)
  }, [paidBundleId, paidEntryRoute])

  useEffect(() => {
    if (entryModalType === 'paid' && paidPostCheckout) {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector('input')?.focus()
      })
    }
  }, [entryModalType, paidPostCheckout])

  if (!entryModalType) return null

  const titles = {
    paid: 'Enter — Ronaldo Legacy Bundle',
    kickups: 'Enter — Ronaldo shirt giveaway',
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/80"
        aria-label="Close entry"
        onClick={closeEntry}
      />
      <div
        ref={panelRef}
        className={`relative z-10 flex max-h-[min(92vh,920px)] w-full flex-col rounded-2xl border border-white/10 bg-stone-950 shadow-2xl ${
          entryModalType === 'paid'
            ? 'ss-entry-modal-panel ss-entry-modal-panel--paid max-w-lg overflow-hidden sm:max-w-xl'
            : 'max-w-lg overflow-hidden'
        }`}
      >
        <div
          className={`h-1 w-full ${
            entryModalType === 'kickups'
              ? 'bg-gradient-to-r from-lime-500/80 via-emerald-500/60 to-transparent'
              : 'bg-gradient-to-r from-teal-500/70 via-emerald-500/50 to-transparent'
          }`}
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 id="entry-modal-title" className="text-lg font-semibold leading-snug text-stone-100">
            {titles[entryModalType]}
          </h2>
          <button
            type="button"
            onClick={closeEntry}
            className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-stone-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="ss-entry-modal-body flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="ss-entry-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {entryModalType === 'paid' ? (
            <>
              <p className="text-sm text-stone-500">
                <strong className="text-stone-300">Ronaldo Legacy Bundle draw.</strong> Pick a ticket bundle to pay online,
                or choose free postal entry for the same prize pool. Then type three Ronaldo skill answers (no multiple
                choice). All must be correct to qualify; winner picked at random from correct entries.
              </p>
              {paidPostCheckout && paidQuizSubmitted ? (
                <div className="mt-4 flex flex-col gap-4 text-center">
                  <div className="rounded-2xl border border-emerald-600/35 bg-gradient-to-b from-emerald-950/50 to-stone-950/80 px-5 py-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                      Entry complete
                    </p>
                    <h3 className="mt-2 font-display text-2xl tracking-wide text-emerald-50">Thank you</h3>
                    <p className="mt-3 text-sm text-stone-300">Your answers are submitted.</p>
                    {paidQuizResult === 'qualified' ? (
                      <p className="mt-3 rounded-lg border border-emerald-700/40 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-100/95">
                        All three answers were correct — you qualify for the draw.
                      </p>
                    ) : (
                      <p className="mt-3 rounded-lg border border-amber-700/35 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90">
                        Thanks for entering. One or more answers were incorrect, so you do not qualify for the prize
                        under the terms.
                      </p>
                    )}
                    {paidOrderRef ? (
                      <p className="mt-4 text-xs text-stone-500">
                        Order: <span className="font-mono text-stone-400">{paidOrderRef}</span>
                      </p>
                    ) : null}
                    {paidTicketNumbers.length ? (
                      <p className="mt-2 text-xs text-stone-500">
                        Ticket{paidTicketNumbers.length === 1 ? '' : 's'}:{' '}
                        <span className="font-mono text-teal-200/90">{paidTicketNumbers.join(', ')}</span>
                      </p>
                    ) : null}
                    <p className="mt-4 text-xs leading-relaxed text-stone-500">
                      {paidEmailConfirmationSent
                        ? 'A confirmation email has been sent (check inbox and spam).'
                        : 'If email is configured, a confirmation will arrive shortly.'}{' '}
                      Stripe or PayPal may send a separate payment receipt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEntry}
                    className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-base font-bold text-white shadow-lg transition hover:brightness-110"
                  >
                    Done
                  </button>
                </div>
              ) : paidPostCheckout ? (
                <form className="mt-4 flex flex-col gap-4" onSubmit={handlePaidQuizSubmit}>
                  <div className="rounded-lg border border-teal-600/30 bg-teal-950/40 px-3 py-3 text-sm text-teal-100/90">
                    <p className="font-medium text-teal-50">Payment received</p>
                    {paidOrderRef ? (
                      <p className="mt-1 text-xs text-teal-200/80">
                        Order reference: <span className="font-mono">{paidOrderRef}</span>
                      </p>
                    ) : null}
                    {paidTicketNumbers.length ? (
                      <div className="mt-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-teal-300/90">
                          Your ticket number{paidTicketNumbers.length === 1 ? '' : 's'}
                        </p>
                        <ul className="mt-1 space-y-0.5 font-mono text-xs text-teal-50">
                          {paidTicketNumbers.map((num) => (
                            <li key={num}>{num}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="mt-2 text-teal-100/90">
                      Submit your three skill answers below now.{' '}
                      <strong className="text-teal-50">You only qualify for the draw if all answers are correct.</strong>{' '}
                      One confirmation email (receipt, ticket numbers, and result) is sent after you submit.
                      Stripe or PayPal may also send their own payment receipt.
                    </p>
                    {paidQuizResult ? (
                      <p className="mt-2 text-xs text-teal-200/80">
                        {paidQuizResult === 'qualified'
                          ? 'Confirmation email sent (if email is configured).'
                          : 'Confirmation email sent with your result (if email is configured).'}
                      </p>
                    ) : null}
                  </div>
                  {PAID_SKILL_QUESTIONS.map((q, i) => {
                    const qCorrect = paidAnswerValidation
                      ? i === 0
                        ? paidAnswerValidation.q1
                        : i === 1
                          ? paidAnswerValidation.q2
                          : paidAnswerValidation.q3
                      : null
                    const showIncorrect = paidQuizResult && qCorrect === false
                    return (
                      <div key={q.id}>
                        <label
                          htmlFor={`modal-paid-q-${q.id}`}
                          className={`block text-sm font-medium ${showIncorrect ? 'text-red-300' : 'text-stone-300'}`}
                        >
                          {i + 1}. {q.prompt}
                        </label>
                        <input
                          id={`modal-paid-q-${q.id}`}
                          type="text"
                          autoComplete="off"
                          value={i === 0 ? paidA1 : i === 1 ? paidA2 : paidA3}
                          onChange={(e) => {
                            const v = e.target.value
                            if (i === 0) setPaidA1(v)
                            else if (i === 1) setPaidA2(v)
                            else setPaidA3(v)
                          }}
                          className={paidAnswerInputClass(i)}
                          placeholder="Type your answer"
                          aria-invalid={showIncorrect || undefined}
                        />
                        {showIncorrect ? (
                          <p className="mt-1 text-xs font-medium text-red-400">Incorrect</p>
                        ) : null}
                      </div>
                    )
                  })}
                  {paidQuizError ? <ErrorBanner message={paidQuizError} /> : null}
                  {paidQuizResult === 'qualified' ? (
                    <p className="rounded-lg border border-emerald-700/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100/95">
                      All correct — you qualify for the draw.
                    </p>
                  ) : null}
                  {paidQuizResult === 'not_qualified' ? (
                    <p className="rounded-lg border border-amber-700/35 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90">
                      One or more answers incorrect — no prize under the terms.
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={paidQuizSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paidQuizSubmitting ? 'Submitting…' : 'Submit answers'}
                  </button>
                </form>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {showTestBundle ? (
                    <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/85">
                      Test ticket (£0.01) is available in the bundle list for checkout testing.
                    </p>
                  ) : null}
                  <TicketBundlePicker
                    paidBundleId={paidBundleId}
                    setPaidBundleId={setPaidBundleId}
                    paidEntryRoute={paidEntryRoute}
                    setPaidEntryRoute={setPaidEntryRoute}
                    selectedTicketBundle={selectedTicketBundle}
                    visibleTicketBundles={visibleTicketBundles}
                  />
                  {paidEntryRoute === 'tickets' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="modal-paid-fullname" className="block text-sm font-medium text-stone-300">
                          Full name (for your entry)
                        </label>
                        <input
                          id="modal-paid-fullname"
                          type="text"
                          autoComplete="name"
                          value={paidFullName}
                          onChange={(e) => setPaidFullName(e.target.value)}
                          className="mt-2 w-full select-text rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          placeholder="As on ID / bank card"
                          spellCheck={false}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="modal-paid-email" className="block text-sm font-medium text-stone-300">
                          Email
                        </label>
                        <input
                          id="modal-paid-email"
                          type="email"
                          autoComplete="email"
                          value={paidEmail}
                          onChange={(e) => setPaidEmail(e.target.value)}
                          className="mt-2 w-full select-text rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          placeholder="you@example.com"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  ) : null}
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-stone-300">
                    <input
                      type="checkbox"
                      checked={paidConsent}
                      onChange={(e) => setPaidConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-teal-500 focus:ring-teal-600/50"
                    />
                    <span>
                      I agree to the{' '}
                      <button
                        type="button"
                        className="font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300"
                        onClick={openTerms}
                      >
                        Terms &amp; Conditions and Privacy Policy
                      </button>
                      .
                    </span>
                  </label>
                  {paidError ? <ErrorBanner message={paidError} /> : null}
                  {paidEntryRoute === 'postal' ? (
                    <div className="rounded-xl border border-stone-500/25 bg-stone-900/35 px-3 py-3 text-sm leading-relaxed text-stone-400">
                      <p className="font-medium text-stone-300">Send by post (postcard or sealed envelope)</p>
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        <li>Full name</li>
                        <li>Full postal address</li>
                        <li>Email address</li>
                        <li>
                          Competition name: <span className="text-stone-200">{COMPETITION_NAME_POSTAL}</span>
                        </li>
                        <li>Written answers to all three skill questions (same as online)</li>
                      </ul>
                      <p className="mt-3 text-xs text-zinc-500">
                        <strong className="text-zinc-400">Limit:</strong> one free postal entry per person. Post to:{' '}
                        <span className="text-zinc-400">ShowSkills Rewards, 35 Irvine Street, Flat 3, L7 8SY</span>
                      </p>
                    </div>
                  ) : null}
                  {!hasStripeCheckout && !hasPayPal && paidEntryRoute === 'tickets' && !E2E_SIMULATE_CHECKOUT ? (
                    <ErrorBanner message="Payments are not configured. Add Stripe and/or PayPal (see .env.example)." />
                  ) : null}
                  {paidEntryRoute === 'tickets' && (hasStripeCheckout || hasPayPal || E2E_SIMULATE_CHECKOUT) ? (
                    <p className="rounded-lg border border-amber-800/35 bg-amber-950/25 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-100/90">
                      {TICKET_PURCHASE_NON_REFUND_NOTICE}
                    </p>
                  ) : null}
                  {paidEntryRoute === 'tickets' && E2E_SIMULATE_CHECKOUT ? (
                    <button
                      type="button"
                      onClick={handlePaidEntry}
                      disabled={paidLoading}
                      className="w-full rounded-xl border border-amber-500/40 bg-amber-950/50 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {paidLoading ? 'Working…' : 'Continue (E2E simulated checkout)'}
                    </button>
                  ) : null}
                  {paidEntryRoute === 'tickets' && (hasStripeElements || hasPayPal || E2E_SIMULATE_CHECKOUT) ? (
                    <button
                      type="button"
                      onClick={handlePayNow}
                      disabled={paidStripePreparing || !paidFormReadyForPayment}
                      className="min-h-[52px] w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-lg font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {paidStripePreparing ? 'Loading…' : 'Pay now'}
                    </button>
                  ) : null}
                  {paidEntryRoute === 'tickets' && (hasStripeElements || hasPayPal) && !showPaymentSheet ? (
                    <p className="text-center text-xs text-stone-500">
                      Total {formatBundlePriceGBP(selectedTicketBundle?.totalPence ?? 0)} — choose card, Apple Pay, or
                      PayPal on the next screen.
                    </p>
                  ) : null}
                  {paidEntryRoute === 'tickets' && hasPayPal && !hasStripeElements ? (
                    <div className="mt-3">
                      <PayPalPayButton
                        clientId={payPalClientId}
                        currency={payPalCurrency}
                        createOrderUrl={paypalCreateOrderApi}
                        captureOrderUrl={paypalCaptureOrderApi}
                        bundleId={paidBundleId}
                        ticketQuantity={selectedTicketBundle?.qty ?? 1}
                        customerEmail={paidEmail}
                        customerFullName={paidFullName}
                        disabled={
                          !paidConsent ||
                          !paidFullName.trim() ||
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidEmail.trim())
                        }
                        onPaid={markPaidCheckoutComplete}
                        onError={(msg) => setPaidError(msg)}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}

          {entryModalType === 'kickups' ? (
            <>
              <p className="text-sm text-stone-500">
                <strong className="text-lime-200/90">Free giveaway:</strong> answer one simple qualification question to
                enter the Ronaldo shirt draw. <strong className="text-stone-300">Prize: signed shirt only</strong> — not
                the iPhone, ball, or Legacy Bundle.
              </p>
              <form className="mt-4 flex flex-col gap-4" onSubmit={handleKickupsGiveawaySubmit}>
                <div>
                  <label htmlFor="modal-kick-name" className="block text-sm font-medium text-stone-300">
                    Full name
                  </label>
                  <input
                    id="modal-kick-name"
                    type="text"
                    autoComplete="name"
                    value={kickFullName}
                    onChange={(e) => setKickFullName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="modal-kick-answer" className="block text-sm font-medium text-stone-300">
                    Qualification question
                  </label>
                  <p className="mt-1 text-sm text-stone-500">{SHIRT_GIVEAWAY_QUESTION}</p>
                  <input
                    id="modal-kick-answer"
                    type="text"
                    autoComplete="off"
                    value={kickAnswer}
                    onChange={(e) => {
                      setKickAnswer(e.target.value)
                      setKickError('')
                    }}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
                    placeholder="Type the answer"
                  />
                </div>
                <div>
                  <label htmlFor="modal-kick-email" className="block text-sm font-medium text-stone-300">
                    Email
                  </label>
                  <input
                    id="modal-kick-email"
                    type="email"
                    autoComplete="email"
                    value={kickEmail}
                    onChange={(e) => setKickEmail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
                    placeholder="you@example.com"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-stone-300">
                  <input
                    type="checkbox"
                    checked={kickConsent}
                    onChange={(e) => setKickConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-600/50"
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      className="font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                      onClick={openTerms}
                    >
                      Terms &amp; Conditions and Privacy Policy
                    </button>
                    .
                  </span>
                </label>
                {kickError ? <ErrorBanner message={kickError} /> : null}
                {kickSuccess ? (
                  <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200/90">
                    Thanks — your submission was received.
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-lime-700 to-emerald-700 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
                >
                  Submit giveaway entry
                </button>
              </form>
            </>
          ) : null}

          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={closeEntry}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-stone-300 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>

      <PaymentCheckoutSheet
        open={showPaymentSheet}
        onClose={handleClosePaymentSheet}
        amountPence={selectedTicketBundle?.totalPence ?? 0}
        bundleTitle={selectedTicketBundle?.title}
        bundleLine={selectedTicketBundle?.line1}
        preparing={paidStripePreparing}
        paidError={paidError}
        hasStripeElements={hasStripeElements}
        stripePublishableKey={stripePublishableKey}
        paidStripeClientSecret={paidStripeClientSecret}
        paidStripePaymentIntentId={paidStripePaymentIntentId}
        paidFormReadyForPayment={paidFormReadyForPayment}
        recordPayload={{
          customerEmail: paidEmail.trim(),
          customerFullName: paidFullName.trim(),
          bundleId: paidBundleId,
        }}
        onStripeSuccess={(info) => {
          setPaymentSheetOpen(false)
          markPaidCheckoutComplete(info)
        }}
        onStripeError={(msg) => setPaidError(msg)}
        onRetryPayment={prepareStripePayment}
        hasPayPal={hasPayPal}
        payPalClientId={payPalClientId}
        payPalCurrency={payPalCurrency}
        paypalCreateOrderApi={paypalCreateOrderApi}
        paypalCaptureOrderApi={paypalCaptureOrderApi}
        paidBundleId={paidBundleId}
        ticketQuantity={selectedTicketBundle?.qty ?? 1}
        customerEmail={paidEmail}
        customerFullName={paidFullName}
        paidConsent={paidConsent}
        onPayPalPaid={(info) => {
          setPaymentSheetOpen(false)
          markPaidCheckoutComplete(info)
        }}
        onPayPalError={(msg) => setPaidError(msg)}
        onClearError={() => setPaidError('')}
      />
    </div>
  )
}
