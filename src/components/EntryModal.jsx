import { useEffect, useRef, useCallback } from 'react'
import { useEntryFlow } from '../entry/entryContext'

const E2E_SIMULATE_CHECKOUT =
  import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === 'true' ||
  import.meta.env.VITE_E2E_SIMULATE_CHECKOUT === '1'
import {
  COMPETITION_NAME_POSTAL,
  TICKET_BUNDLES,
  formatBundlePriceGBP,
} from '../competitionData'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import { ErrorBanner } from './ErrorBanner'
import { PayPalPayButton } from './PayPalPayButton'

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
    paidA1,
    setPaidA1,
    paidA2,
    setPaidA2,
    paidA3,
    setPaidA3,
    paidQuizError,
    paidQuizResult,
    paidFullName,
    setPaidFullName,
    paidEmail,
    setPaidEmail,
    selectedTicketBundle,
    handlePaidEntry,
    handlePaidQuizSubmit,
    markPaidCheckoutComplete,
    hasStripeCheckout,
    hasPayPal,
    payPalClientId,
    payPalCurrency,
    paypalCreateOrderApi,
    paypalCaptureOrderApi,
    kickFullName,
    setKickFullName,
    kickVideoUrl,
    setKickVideoUrl,
    kickVideoFile,
    setKickVideoFile,
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
  const kickFileInputRef = useRef(null)

  const clearKickFileInput = useCallback(() => {
    const el = kickFileInputRef.current
    if (el) el.value = ''
  }, [])

  useEffect(() => {
    if (!entryModalType) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [entryModalType])

  useEffect(() => {
    if (!entryModalType) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (termsOpen) return
      closeEntry()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entryModalType, closeEntry, termsOpen])

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
    kickups: 'Enter — 35 Kick-Ups shirt giveaway',
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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close entry"
        onClick={closeEntry}
      />
      <div
        ref={panelRef}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-950 shadow-2xl"
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

        <div className="overflow-y-auto px-5 py-4">
          {entryModalType === 'paid' ? (
            <>
              <p className="text-sm text-stone-500">
                <strong className="text-stone-300">Ronaldo Legacy Bundle draw.</strong> Pick a ticket bundle to pay online,
                or choose free postal entry for the same prize pool. Then type three Ronaldo skill answers (no multiple
                choice). All must be correct to qualify; winner picked at random from correct entries.
              </p>
              {paidPostCheckout ? (
                <form className="mt-4 flex flex-col gap-4" onSubmit={handlePaidQuizSubmit}>
                  <p className="rounded-lg border border-teal-600/30 bg-teal-950/40 px-3 py-2 text-sm text-teal-100/90">
                    Payment received — submit your answers below.
                  </p>
                  {PAID_SKILL_QUESTIONS.map((q, i) => (
                    <div key={q.id}>
                      <label htmlFor={`modal-paid-q-${q.id}`} className="block text-sm font-medium text-stone-300">
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
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                        placeholder="Type your answer"
                      />
                    </div>
                  ))}
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
                    className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
                  >
                    Submit answers
                  </button>
                </form>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-medium text-stone-300">Pay for tickets or enter by post</p>
                    <div className="mt-2 grid max-h-[min(52vh,22rem)] gap-2 overflow-y-auto pr-1 sm:max-h-none">
                      {TICKET_BUNDLES.map((b) => (
                        <label
                          key={b.id}
                          className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                            paidEntryRoute === 'tickets' && paidBundleId === b.id
                              ? 'border-teal-400/55 bg-teal-950/35 ring-1 ring-teal-500/25'
                              : 'border-white/10 bg-black/20 hover:border-white/18'
                          } ${b.featured ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.12)]' : ''}`}
                        >
                          <input
                            type="radio"
                            name="legacy-draw-entry"
                            value={b.id}
                            checked={paidEntryRoute === 'tickets' && paidBundleId === b.id}
                            onChange={() => {
                              setPaidEntryRoute('tickets')
                              setPaidBundleId(b.id)
                            }}
                            className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-black/40 text-teal-500 focus:ring-teal-600/50"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base" aria-hidden>
                                {b.emoji}
                              </span>
                              <span className="font-semibold text-stone-100">{b.title}</span>
                              {b.featured ? (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                                  Popular
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-sm text-teal-200/90">{b.line1}</p>
                            {b.line2 ? <p className="text-xs text-stone-500">{b.line2}</p> : null}
                            {b.bullets?.length ? (
                              <ul className="mt-1.5 space-y-0.5 text-xs text-stone-400">
                                {b.bullets.map((t) => (
                                  <li key={t}>✓ {t}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className="shrink-0 self-start font-display text-lg leading-none text-white tabular-nums">
                            {formatBundlePriceGBP(b.totalPence)}
                          </div>
                        </label>
                      ))}
                      <label
                        className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                          paidEntryRoute === 'postal'
                            ? 'border-stone-400/45 bg-stone-900/40 ring-1 ring-stone-500/20'
                            : 'border-white/10 bg-black/20 hover:border-white/18'
                        }`}
                      >
                        <input
                          type="radio"
                          name="legacy-draw-entry"
                          value="postal"
                          checked={paidEntryRoute === 'postal'}
                          onChange={() => setPaidEntryRoute('postal')}
                          className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-black/40 text-stone-400 focus:ring-stone-500/50"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base" aria-hidden>
                              ✉️
                            </span>
                            <span className="font-semibold text-stone-100">Free postal entry</span>
                            <span className="rounded-full bg-stone-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-300/90">
                              Same draw
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-stone-400">
                            No payment. Post your details and the three written skill answers — same Ronaldo Legacy Bundle
                            prize pool as paid tickets. One postal entry per person.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
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
                          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          placeholder="As on ID / bank card"
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
                          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
                          placeholder="you@example.com"
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
                        <span className="text-zinc-400">[Promoter UK address — add before launch]</span>
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
                  {paidEntryRoute === 'tickets' && hasStripeCheckout ? (
                    <button
                      type="button"
                      onClick={handlePaidEntry}
                      disabled={paidLoading}
                      className="w-full rounded-xl border border-teal-500/30 bg-gradient-to-r from-slate-700 to-slate-800 py-3 text-sm font-bold text-white shadow-lg transition hover:from-slate-600 hover:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {paidLoading ? 'Opening checkout…' : 'Continue to payment (card)'}
                    </button>
                  ) : null}
                  {paidEntryRoute === 'tickets' && hasPayPal ? (
                    <div className={hasStripeCheckout ? 'mt-3' : ''}>
                      {hasStripeCheckout ? (
                        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                          or pay with
                        </p>
                      ) : null}
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
                <strong className="text-lime-200/90">Different competition:</strong> completely free. Upload your 35
                kick-ups video file <span className="text-stone-400">or</span> paste an{' '}
                <strong className="text-stone-300">https</strong> link (e.g. unlisted YouTube or a private cloud share).{' '}
                <strong className="text-stone-300">Prize: signed shirt only</strong> — not the iPhone, ball, or bundle.
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
                  <label htmlFor="modal-kick-video-file" className="block text-sm font-medium text-stone-300">
                    Video file (optional if you use a link)
                  </label>
                  <input
                    id="modal-kick-video-file"
                    ref={kickFileInputRef}
                    type="file"
                    accept="video/*,.mp4,.webm,.mov,.m4v,.mkv"
                    className="mt-2 block w-full text-sm text-stone-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900/50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-100 hover:file:bg-emerald-800/50"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setKickVideoFile(f)
                      if (f) {
                        setKickVideoUrl('')
                        setKickError('')
                      }
                    }}
                  />
                  {kickVideoFile ? (
                    <p className="mt-1 text-xs text-stone-500">Selected: {kickVideoFile.name}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="modal-kick-video-url" className="block text-sm font-medium text-stone-300">
                    Or video link (https only)
                  </label>
                  <input
                    id="modal-kick-video-url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    value={kickVideoUrl}
                    onChange={(e) => {
                      const v = e.target.value
                      setKickVideoUrl(v)
                      setKickError('')
                      if (v.trim()) {
                        setKickVideoFile(null)
                        clearKickFileInput()
                      }
                    }}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40"
                    placeholder="https://..."
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

        <div className="border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={closeEntry}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-stone-300 transition hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
