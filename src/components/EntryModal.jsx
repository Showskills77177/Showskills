import { useEffect, useRef, useState } from 'react'
import { useEntryFlow } from '../entry/entryContext'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'

const E2E_SIMULATE_CHECKOUT =
  import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === 'true' ||
  import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === '1'
import {
  COMPETITION_NAME_POSTAL,
  formatBundlePriceGBP,
} from '../competitionData'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import {
  CONSOLATION_PRIZE_FREE_APPLIES,
  CONSOLATION_PRIZE_PAID_THRESHOLD,
  CONSOLATION_PRIZE_SUMMARY,
  CONSOLATION_NOT_AWARDED_GENERIC,
  CONSOLATION_NOT_AWARDED_PAID_BELOW_THRESHOLD,
  formatConsolationAwardMessage,
  LEGACY_SKILL_ONE_ATTEMPT_NOTICE,
  paidSpendQualifiesForConsolation,
} from '../../shared/consolationShirtGiveaway.mjs'
import { PromoterAddress } from './PromoterAddress'
import { ErrorBanner } from './ErrorBanner'
import { ModalPortal } from './ModalPortal'
import { PaymentCheckoutSheet } from './PaymentCheckoutSheet'
import { PayPalPayButton } from './PayPalPayButton'
import { EntryTermsConsent } from './EntryTermsConsent'
import { TicketBundlePicker } from './TicketBundlePicker'
import { CashflowsPaymentForm } from './CashflowsPaymentForm'
import { PHONE_COLLECTION_NOTICE } from '../../shared/contactPhone.mjs'

export function EntryModal() {
  const {
    entryModalType,
    closeEntry,
    openTerms,
    termsOpen,
    paidBundleId,
    setPaidBundleId,
    paidCompetitionSlug,
    paidEntryMethods,
    postalCompetitionName,
    paidCompetitionTitle,
    paidCompetitionTitle,
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
    paidQuizAnswers,
    setPaidQuizAnswer,
    paidSkillQuestions,
    paidQuizValidation,
    paidQuizError,
    paidQuizResult,
    paidConsolationShirtEntries,
    paidQuizSubmitted,
    paidQuizSubmitting,
    paidEmailConfirmationSent,
    visibleTicketBundles,
    paidFullName,
    setPaidFullName,
    paidEmail,
    setPaidEmail,
    paidPhone,
    setPaidPhone,
    kickPhone,
    setKickPhone,
    selectedTicketBundle,
    handlePaidEntry,
    handlePaidQuizSubmit,
    markPaidCheckoutComplete,
    hasCardCheckout,
    paymentNotConfiguredMessage,
    hasCashflowsEmbedded,
    googlePayEnabled,
    googlePayMerchantId,
    hasEmbeddedCardCheckout,
    paidCashflowsToken,
    paidCashflowsJobRef,
    paidCashflowsIntegration,
    paidCardPreparing,
    prepareEmbeddedCardPayment,
    closeCardPayment,
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
    kickVpnBlocked,
    kickCheckingVpn,
    handleKickupsGiveawaySubmit,
    freeAddressLine1,
    setFreeAddressLine1,
    freeAddressLine2,
    setFreeAddressLine2,
    freeCity,
    setFreeCity,
    freePostcode,
    setFreePostcode,
    freePreparing,
    freeCardVerified,
    freeQuizSubmitting,
    hasCashflowsFreeVerify,
    freeVerifyPayload,
    handleStartFreeVerification,
    handleFreeCardVerified,
    handleFreeQuizSubmit,
  } = useEntryFlow()

  const panelRef = useRef(null)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)

  const showPaymentSheet =
    hasEmbeddedCardCheckout &&
    paymentSheetOpen &&
    entryModalType === 'paid' &&
    !paidPostCheckout &&
    paidEntryRoute === 'tickets'

  function handleClosePaymentSheet() {
    closeCardPayment()
    setPaymentSheetOpen(false)
    setPaidError('')
  }

  async function handlePayNow() {
    if (!paidFormReadyForPayment) {
      setPaidError('Enter your full name, email, phone number, and agree to the terms before paying.')
      return
    }
    setPaidError('')

    if (hasCashflowsEmbedded) {
      setPaymentSheetOpen(true)
      if (!paidCashflowsToken) await prepareEmbeddedCardPayment()
      return
    }

    setPaidError('Card payment is not configured. Use PayPal below or contact support.')
  }

  const skillQuestionCount = paidSkillQuestions.length
  const skillQuestionLabel =
    skillQuestionCount === 1 ? 'skill question' : `${skillQuestionCount} skill questions`

  const paidAnswerInputClass = (questionKey) => {
    const base =
      'mt-2 w-full rounded-lg border px-3 py-2 text-base focus:outline-none focus:ring-2'
    if (!paidQuizValidation) {
      return `${base} border-white/10 bg-black/30 text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:ring-teal-900/40`
    }
    const correct = paidQuizValidation[questionKey]
    if (correct === false) {
      return `${base} border-red-500/80 bg-red-950/45 text-red-100 placeholder:text-red-400/40 focus:border-red-500/70 focus:ring-red-900/50`
    }
    return `${base} border-white/10 bg-black/30 text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:ring-teal-900/40`
  }

  function renderLegacyNotQualifiedMessage() {
    if (paidConsolationShirtEntries > 0) {
      return formatConsolationAwardMessage({ entryCount: paidConsolationShirtEntries })
    }
    if (
      paidEntryRoute === 'tickets' &&
      selectedTicketBundle &&
      !paidSpendQualifiesForConsolation(selectedTicketBundle.totalPence)
    ) {
      return CONSOLATION_NOT_AWARDED_PAID_BELOW_THRESHOLD
    }
    if (paidEntryRoute === 'free_online') {
      return `${CONSOLATION_PRIZE_SUMMARY} You did not qualify for the main draw on this attempt.`
    }
    return CONSOLATION_NOT_AWARDED_GENERIC
  }

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


  if (!entryModalType) return null

  const titles = {
    paid: `Enter — ${paidCompetitionTitle}`,
    kickups: 'Enter — Ronaldo shirt giveaway',
  }

  const panelWidthClass =
    entryModalType === 'paid'
      ? showPaymentSheet
        ? 'sm:max-w-3xl'
        : 'sm:max-w-xl'
      : 'sm:max-w-xl'

  return (
    <ModalPortal>
      <div
        className="ss-entry-modal-overlay fixed inset-0 z-[60] flex items-end justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
      >
        <div
          className="absolute inset-0 bg-black/80"
          role="presentation"
          onClick={() => (showPaymentSheet ? handleClosePaymentSheet() : closeEntry())}
          onKeyDown={() => {}}
        />
        <div
          ref={panelRef}
          inert={showPaymentSheet}
          className={`ss-entry-modal-panel relative z-10 flex max-h-[min(90dvh,920px)] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-stone-950 shadow-2xl sm:max-h-[min(92vh,920px)] ${panelWidthClass} ${
            entryModalType === 'paid' ? 'ss-entry-modal-panel--paid' : ''
          } ${showPaymentSheet ? 'ss-entry-modal-panel--behind-payment' : ''}`}
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

        <div className="ss-entry-modal-body flex min-h-0 flex-1 flex-col">
          <div className="ss-entry-modal-scroll min-h-0 flex-1 px-4 py-4 sm:px-5">
          {entryModalType === 'paid' ? (
            <>
              <p className="text-sm text-stone-500">
                <strong className="text-stone-300">{paidCompetitionTitle}.</strong> Pick a ticket bundle to pay online,
                free online entry (£0 card verify), or free postal entry for the same prize pool. Then answer the skill
                questions (no multiple choice). <strong className="text-stone-400">All must be correct to qualify</strong>{' '}
                for the main draw — you have <strong className="text-stone-400">one attempt</strong> per entry. The winner
                is picked at random from correct entries only.
              </p>
              <p className="mt-2 rounded-lg border border-stone-600/30 bg-stone-900/40 px-3 py-2.5 text-xs leading-relaxed text-stone-400">
                <strong className="text-stone-300">Consolation prize:</strong> {CONSOLATION_PRIZE_SUMMARY}{' '}
                {CONSOLATION_PRIZE_PAID_THRESHOLD} {CONSOLATION_PRIZE_FREE_APPLIES} {TICKET_PURCHASE_NON_REFUND_NOTICE}
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
                        {renderLegacyNotQualifiedMessage()}
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
                      Your payment provider may send a separate payment receipt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEntry}
                    className="ss-pay-cta w-full rounded-xl py-3.5 text-base transition hover:brightness-110"
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
                      Submit your {skillQuestionLabel} below now.{' '}
                      <strong className="text-teal-50">You only qualify for the main draw if all answers are correct.</strong>{' '}
                      {LEGACY_SKILL_ONE_ATTEMPT_NOTICE} One confirmation email (receipt, ticket numbers, and result) is sent after you submit.
                      Your payment provider may also send its own payment receipt.
                    </p>
                    <p className="mt-3 rounded-lg border border-stone-600/35 bg-stone-900/45 px-3 py-2.5 text-sm text-stone-200">
                      Please take your time and think carefully about the answers.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="modal-paid-quiz-fullname" className="block text-sm font-medium text-stone-300">
                        Full name (for your entry)
                      </label>
                      <input
                        id="modal-paid-quiz-fullname"
                        type="text"
                        autoComplete="name"
                        value={paidFullName}
                        onChange={(e) => setPaidFullName(e.target.value)}
                        className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                        placeholder="As on ID / bank card"
                        spellCheck={false}
                        autoCapitalize="words"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="modal-paid-quiz-email" className="block text-sm font-medium text-stone-300">
                        Email
                      </label>
                      <input
                        id="modal-paid-quiz-email"
                        type="email"
                        autoComplete="email"
                        value={paidEmail}
                        onChange={(e) => setPaidEmail(e.target.value)}
                        className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-stone-500">
                    Confirm the name and email you used to pay so we can link your entry (especially after returning from
                    card checkout on Safari).
                  </p>
                  {paidSkillQuestions.map((q, i) => {
                    const questionKey = q.questionKey || q.id
                    const showIncorrect = paidQuizResult && paidQuizValidation?.[questionKey] === false
                    return (
                      <div key={questionKey}>
                        <label
                          htmlFor={`modal-paid-q-${questionKey}`}
                          className={`block text-sm font-medium ${showIncorrect ? 'text-red-300' : 'text-stone-300'}`}
                        >
                          {i + 1}. {q.prompt}
                        </label>
                        <input
                          id={`modal-paid-q-${questionKey}`}
                          type="text"
                          autoComplete="off"
                          value={paidQuizAnswers[questionKey] || ''}
                          onChange={(e) => setPaidQuizAnswer(questionKey, e.target.value)}
                          className={`ss-entry-field ${paidAnswerInputClass(questionKey)}`}
                          placeholder="Type your answer"
                          aria-invalid={showIncorrect || undefined}
                          autoCapitalize="off"
                          autoCorrect="off"
                        />
                        {showIncorrect ? (
                          <p className="mt-1 text-xs font-medium text-red-400">Incorrect</p>
                        ) : null}
                      </div>
                    )
                  })}
                  {paidQuizError ? <ErrorBanner message={paidQuizError} /> : null}
                  {paidQuizResult ? (
                    <p className="text-xs text-teal-200/80">
                      {paidQuizResult === 'qualified'
                        ? 'Confirmation email sent (if email is configured).'
                        : 'Confirmation email sent with your result (if email is configured).'}
                    </p>
                  ) : null}
                  {paidQuizResult === 'qualified' ? (
                    <p className="rounded-lg border border-emerald-700/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100/95">
                      All correct — you qualify for the draw.
                    </p>
                  ) : null}
                  {paidQuizResult === 'not_qualified' ? (
                    <p className="rounded-lg border border-amber-700/35 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90">
                      {renderLegacyNotQualifiedMessage()}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={paidQuizSubmitting}
                    className="ss-pay-cta w-full rounded-xl py-3 text-sm transition hover:brightness-110 disabled:cursor-not-allowed"
                  >
                    {paidQuizSubmitting ? 'Submitting…' : 'Submit answers'}
                  </button>
                </form>
              ) : (
                <div className="mt-4 flex flex-col gap-5">
                  <TicketBundlePicker
                    paidBundleId={paidBundleId}
                    setPaidBundleId={setPaidBundleId}
                    paidEntryRoute={paidEntryRoute}
                    setPaidEntryRoute={setPaidEntryRoute}
                    selectedTicketBundle={selectedTicketBundle}
                    visibleTicketBundles={visibleTicketBundles}
                    entryMethods={paidEntryMethods}
                    postalCompetitionName={postalCompetitionName}
                    competitionTitle={paidCompetitionTitle}
                  />
                  {paidEntryRoute === 'free_online' ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor="modal-free-fullname" className="block text-sm font-medium text-stone-300">
                            Full name
                          </label>
                          <input
                            id="modal-free-fullname"
                            type="text"
                            autoComplete="name"
                            value={paidFullName}
                            onChange={(e) => setPaidFullName(e.target.value)}
                            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="modal-free-email" className="block text-sm font-medium text-stone-300">
                            Email
                          </label>
                          <input
                            id="modal-free-email"
                            type="email"
                            autoComplete="email"
                            value={paidEmail}
                            onChange={(e) => setPaidEmail(e.target.value)}
                            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          />
                        </div>
                        <EntryPhoneField
                          id="modal-free-phone"
                          value={paidPhone}
                          onChange={setPaidPhone}
                        />
                        <div className="sm:col-span-2">
                          <label htmlFor="modal-free-addr1" className="block text-sm font-medium text-stone-300">
                            Address line 1
                          </label>
                          <input
                            id="modal-free-addr1"
                            type="text"
                            autoComplete="street-address"
                            value={freeAddressLine1}
                            onChange={(e) => setFreeAddressLine1(e.target.value)}
                            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="modal-free-addr2" className="block text-sm font-medium text-stone-300">
                            Address line 2 (optional)
                          </label>
                          <input
                            id="modal-free-addr2"
                            type="text"
                            autoComplete="address-line2"
                            value={freeAddressLine2}
                            onChange={(e) => setFreeAddressLine2(e.target.value)}
                            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          />
                        </div>
                        <div>
                          <label htmlFor="modal-free-city" className="block text-sm font-medium text-stone-300">
                            Town / city
                          </label>
                          <input
                            id="modal-free-city"
                            type="text"
                            autoComplete="address-level2"
                            value={freeCity}
                            onChange={(e) => setFreeCity(e.target.value)}
                            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          />
                        </div>
                        <div>
                          <label htmlFor="modal-free-postcode" className="block text-sm font-medium text-stone-300">
                            Postcode
                          </label>
                          <input
                            id="modal-free-postcode"
                            type="text"
                            autoComplete="postal-code"
                            value={freePostcode}
                            onChange={(e) => setFreePostcode(e.target.value)}
                            className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          />
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-stone-500">
                        Max 3 free online entries per name and address. Verify your card first (£0.00 authorisation, no
                        charge), then answer the {skillQuestionLabel}. {LEGACY_SKILL_ONE_ATTEMPT_NOTICE}{' '}
                        {CONSOLATION_PRIZE_SUMMARY} {CONSOLATION_PRIZE_FREE_APPLIES}
                      </p>
                      {freeCardVerified ? (
                        <form className="flex flex-col gap-4" onSubmit={handleFreeQuizSubmit}>
                          <div className="rounded-lg border border-teal-600/30 bg-teal-950/40 px-3 py-3 text-sm text-teal-100/90">
                            <p className="font-medium text-teal-50">Card verified</p>
                            <p className="mt-1 text-teal-100/90">
                            Answer all {skillQuestionLabel} below. You only qualify for the main draw if every answer is
                              correct. {LEGACY_SKILL_ONE_ATTEMPT_NOTICE} If you get them wrong, you receive 2 automatic entries into the separate Free Ronaldo Shirt Giveaway.
                            </p>
                          </div>
                          {paidSkillQuestions.map((q, i) => {
                            const questionKey = q.questionKey || q.id
                            return (
                              <div key={questionKey}>
                                <label
                                  htmlFor={`modal-free-q-${questionKey}`}
                                  className="block text-sm font-medium text-stone-300"
                                >
                                  {i + 1}. {q.prompt}
                                </label>
                                <input
                                  id={`modal-free-q-${questionKey}`}
                                  type="text"
                                  value={paidQuizAnswers[questionKey] || ''}
                                  onChange={(e) => setPaidQuizAnswer(questionKey, e.target.value)}
                                  className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                                  placeholder="Type your answer"
                                />
                              </div>
                            )
                          })}
                          <button
                            type="submit"
                            disabled={freeQuizSubmitting}
                            className="ss-pay-cta min-h-[48px] w-full rounded-xl py-3.5 text-base transition hover:brightness-110 disabled:cursor-not-allowed"
                          >
                            {freeQuizSubmitting ? 'Submitting…' : 'Submit free entry'}
                          </button>
                        </form>
                      ) : !paidCashflowsToken ? (
                        <button
                          type="button"
                          onClick={handleStartFreeVerification}
                          disabled={freePreparing || !hasCashflowsFreeVerify}
                          className="ss-pay-cta min-h-[48px] w-full rounded-xl py-3.5 text-base transition hover:brightness-110 disabled:cursor-not-allowed"
                        >
                          {freePreparing ? 'Preparing verification…' : 'Continue to card verification (£0)'}
                        </button>
                      ) : (
                        <CashflowsPaymentForm
                          intentToken={paidCashflowsToken}
                          isIntegration={paidCashflowsIntegration}
                          paymentJobReference={paidCashflowsJobRef}
                          amountLabel="£0.00"
                          recordPayload={freeVerifyPayload}
                          flow="free_verify"
                          panelTitle="Card verification (£0)"
                          payButtonLabel="Verify card (£0)"
                          googlePayEnabled={false}
                          onSuccess={handleFreeCardVerified}
                          onError={(msg) => setPaidError(msg)}
                          disabled={!paidConsent}
                        />
                      )}
                    </>
                  ) : null}
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
                          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          placeholder="As on ID / bank card"
                          spellCheck={false}
                          autoCapitalize="words"
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
                          className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          placeholder="you@example.com"
                          spellCheck={false}
                          autoCapitalize="none"
                          autoCorrect="off"
                        />
                      </div>
                      <EntryPhoneField
                        id="modal-paid-phone"
                        value={paidPhone}
                        onChange={setPaidPhone}
                      />
                    </div>
                  ) : null}
                  <EntryTermsConsent
                    checked={paidConsent}
                    onChange={setPaidConsent}
                    onOpenTerms={openTerms}
                    variant="teal"
                  />
                  {paidError ? <ErrorBanner message={paidError} /> : null}
                  {paidEntryRoute === 'postal' ? (
                    <div className="rounded-xl border border-stone-500/25 bg-stone-900/35 px-3 py-3 text-sm leading-relaxed text-stone-400">
                      <p className="font-medium text-stone-300">Send by post (postcard or sealed envelope)</p>
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        <li>Full name</li>
                        <li>Full postal address</li>
                        <li>Email address</li>
                        <li>
                          Competition name: <span className="text-stone-200">{postalCompetitionName}</span>
                        </li>
                        <li>Written answers to all skill questions (same as online)</li>
                      </ul>
                      <p className="mt-3 text-xs font-medium text-zinc-400">Post to:</p>
                      <PromoterAddress className="mt-1 text-sm text-zinc-300" />
                      <p className="mt-2 text-xs text-zinc-500">
                        <strong className="text-zinc-400">Limit:</strong> one free postal entry per person.
                      </p>
                    </div>
                  ) : null}
                  {paymentNotConfiguredMessage && paidEntryRoute === 'tickets' ? (
                    <ErrorBanner message={paymentNotConfiguredMessage} />
                  ) : null}
                  {paidEntryRoute === 'tickets' &&
                  !paymentNotConfiguredMessage &&
                  (hasCardCheckout || hasPayPal || E2E_SIMULATE_CHECKOUT) &&
                  !showPaymentSheet ? (
                    <div className="ss-entry-checkout-actions flex flex-col gap-3 border-t border-white/10 pt-4">
                      <p className="rounded-lg border border-amber-800/35 bg-amber-950/25 px-3 py-2.5 text-center text-[11px] font-medium leading-snug text-amber-100/90">
                        {TICKET_PURCHASE_NON_REFUND_NOTICE}
                      </p>
                      <p className="rounded-lg border border-stone-600/30 bg-stone-900/40 px-3 py-2.5 text-center text-[11px] leading-snug text-stone-400">
                        <strong className="text-stone-300">Skill quiz:</strong> {LEGACY_SKILL_ONE_ATTEMPT_NOTICE}{' '}
                        {CONSOLATION_PRIZE_PAID_THRESHOLD}
                      </p>
                      {E2E_SIMULATE_CHECKOUT ? (
                        <button
                          type="button"
                          onClick={handlePaidEntry}
                          disabled={paidLoading}
                          className="min-h-[48px] w-full rounded-xl border border-amber-500/40 bg-amber-950/50 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {paidLoading ? 'Working…' : 'Continue (E2E simulated checkout)'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handlePayNow}
                        disabled={paidLoading || paidCardPreparing || !paidFormReadyForPayment}
                        className="ss-pay-cta min-h-[48px] w-full shrink-0 rounded-xl py-3.5 text-base transition hover:brightness-110 disabled:cursor-not-allowed sm:text-lg"
                      >
                        {paidLoading || paidCardPreparing ? 'Preparing secure checkout…' : 'Pay now'}
                      </button>
                      {hasCashflowsEmbedded ? (
                        <p className="text-center text-xs leading-relaxed text-stone-500">
                          Total {formatBundlePriceGBP(selectedTicketBundle?.totalPence ?? 0)} — pay by card on the
                          next screen (secure fields on this site), then complete the quiz.
                        </p>
                      ) : null}
                      {hasCashflowsEmbedded && hasPayPal ? (
                        <p className="text-center text-xs leading-relaxed text-stone-500">
                          Total {formatBundlePriceGBP(selectedTicketBundle?.totalPence ?? 0)} — card or PayPal on the
                          next screen.
                        </p>
                      ) : null}
                      {hasPayPal ? (
                        <div className="pt-1">
                          {hasCashflowsEmbedded ? (
                            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                              or pay with PayPal
                            </p>
                          ) : null}
                          <PayPalPayButton
                            clientId={payPalClientId}
                            currency={payPalCurrency}
                            createOrderUrl={paypalCreateOrderApi}
                            captureOrderUrl={paypalCaptureOrderApi}
                            bundleId={paidBundleId}
                            competition={paidCompetitionSlug}
                            ticketQuantity={selectedTicketBundle?.qty ?? 1}
                            customerEmail={paidEmail}
                            customerFullName={paidFullName}
                            customerPhone={paidPhone}
                            disabled={!paidFormReadyForPayment}
                            onPaid={markPaidCheckoutComplete}
                            onError={(msg) => setPaidError(msg)}
                          />
                        </div>
                      ) : null}
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
                the iPhone, ball, or Legacy Bundle. One entry per device — a second email from the same phone or computer
                is not allowed. VPNs are not permitted.
              </p>
              {kickCheckingVpn ? (
                <p className="mt-3 text-sm text-stone-500">Checking your connection…</p>
              ) : null}
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
                    className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
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
                    className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
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
                    className="ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
                    placeholder="you@example.com"
                  />
                </div>
                <EntryPhoneField id="modal-kick-phone" value={kickPhone} onChange={setKickPhone} variant="emerald" />
                <EntryTermsConsent
                  checked={kickConsent}
                  onChange={setKickConsent}
                  onOpenTerms={openTerms}
                  variant="emerald"
                />
                {kickError ? <ErrorBanner message={kickError} /> : null}
                {kickSuccess ? (
                  <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200/90">
                    Thanks — your submission was received.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={kickVpnBlocked || kickCheckingVpn}
                  className="w-full rounded-xl bg-gradient-to-r from-lime-700 to-emerald-700 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Submit giveaway entry
                </button>
              </form>
            </>
          ) : null}

          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={closeEntry}
            className="min-h-[44px] w-full rounded-xl border border-white/10 py-2.5 text-base font-semibold text-stone-300 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>

        </div>
      </div>

          {hasEmbeddedCardCheckout ? (
          <PaymentCheckoutSheet
            open={showPaymentSheet}
        onClose={handleClosePaymentSheet}
        amountPence={selectedTicketBundle?.totalPence ?? 0}
        bundleTitle={selectedTicketBundle?.title}
        bundleLine={selectedTicketBundle?.line1}
        preparing={paidCardPreparing}
        paidError={paidError}
        hasCashflowsEmbedded={hasCashflowsEmbedded}
        paidCashflowsToken={paidCashflowsToken}
        paidCashflowsJobRef={paidCashflowsJobRef}
        paidCashflowsIntegration={paidCashflowsIntegration}
        paidFormReadyForPayment={paidFormReadyForPayment}
        googlePayEnabled={googlePayEnabled}
        googlePayMerchantId={googlePayMerchantId}
        recordPayload={{
          customerEmail: paidEmail.trim(),
          customerFullName: paidFullName.trim(),
          customerPhone: paidPhone.trim(),
          bundleId: paidBundleId,
        }}
        onCardSuccess={(info) => {
          setPaymentSheetOpen(false)
          markPaidCheckoutComplete(info)
        }}
        onCardError={(msg) => setPaidError(msg)}
        onRetryPayment={prepareEmbeddedCardPayment}
        hasPayPal={hasPayPal}
        payPalClientId={payPalClientId}
        payPalCurrency={payPalCurrency}
        paypalCreateOrderApi={paypalCreateOrderApi}
        paypalCaptureOrderApi={paypalCaptureOrderApi}
        paidBundleId={paidBundleId}
        ticketQuantity={selectedTicketBundle?.qty ?? 1}
        customerEmail={paidEmail}
        customerFullName={paidFullName}
        customerPhone={paidPhone}
        paidConsent={paidConsent}
        onPayPalPaid={(info) => {
          setPaymentSheetOpen(false)
          markPaidCheckoutComplete(info)
        }}
        onPayPalError={(msg) => setPaidError(msg)}
      />
          ) : null}
    </ModalPortal>
  )
}

function EntryPhoneField({ id, value, onChange, variant = 'teal' }) {
  const ring = variant === 'emerald' ? 'focus:ring-emerald-900/40 focus:border-emerald-600/50' : 'focus:ring-teal-900/40 focus:border-teal-600/50'
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="block text-sm font-medium text-stone-300">
        Mobile / contact phone
      </label>
      <input
        id={id}
        type="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`ss-entry-field mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 ${ring}`}
        placeholder="e.g. 07XXX XXXXXX"
      />
      <p className="mt-2 text-xs leading-relaxed text-stone-500">{PHONE_COLLECTION_NOTICE}</p>
    </div>
  )
}
