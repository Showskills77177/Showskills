import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import ronaldoLegacyBundle from './assets/ronaldo-legacy-bundle.png'
import showskillsLogo from './assets/showskills-logo.png'

const BUNDLE_IMAGE_URL = ronaldoLegacyBundle

const FREE_MAX_WORDS = 100

function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function TermsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close terms"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id="terms-title" className="text-lg font-semibold text-slate-900">
            Terms and Conditions
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-left text-sm leading-relaxed text-slate-600">
          <p className="mb-4 text-slate-800">
            These Terms and Conditions govern your participation in the <strong>ShowSkills Rewards</strong>{' '}
            promotion known as the &quot;35 Kick-Ups Challenge&quot; (the &quot;Competition&quot;) operated in the
            United Kingdom. By entering, you agree to be bound by these terms.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">1. Eligibility and age</h3>
          <p className="mb-3">
            The Competition is open to residents of the United Kingdom aged <strong>18 or over</strong> at the date
            of entry. Employees of the promoter, their immediate families, and anyone otherwise connected with the
            administration of the Competition may be excluded. We may require proof of age, identity, and residency
            before awarding any prize.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">2. Nature of the Competition (skill-based)</h3>
          <p className="mb-3">
            This is a <strong>skill-based competition</strong>, not a lottery or raffle. Winners are determined on the
            basis of skill and compliance with the published rules, subject to manual review. Chance plays no significant
            part in determining the outcome.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">3. How to enter</h3>
          <p className="mb-3">
            <strong>Paid route:</strong> Pay the stated entry fee and upload your video in accordance with the rules.
            <br />
            <strong>Free route:</strong> Submit the requested written answer and a valid email address. Free entries are
            afforded the <strong>same opportunity to win</strong> as paid entries, as described on this page.
          </p>
          <p className="mb-3">
            Multiple entries may be permitted only where expressly stated. Automated entries, scripts, bots, or bulk
            entries may be disqualified.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">4. Video rules and anti-cheat</h3>
          <p className="mb-3">
            Submissions must show <strong>35 kick-ups in one continuous take</strong>, with your <strong>face clearly
            visible</strong>, with <strong>no edits, cuts, or special effects</strong> that obscure continuity. We apply
            manual review and may use additional checks. Entries that cannot be verified, that appear manipulated, or
            that breach these rules may be disqualified at our sole discretion.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">5. Promotional rights and publicity</h3>
          <p className="mb-3">
            By entering, you grant the promoter a <strong>non-exclusive, royalty-free, worldwide licence</strong> to use,
            reproduce, and publish your entry (including name, voice, image, and likeness as appearing in your
            submission) for the purposes of administering the Competition, announcing results, and reasonable
            marketing related to ShowSkills Rewards, unless you notify us in writing that you withdraw this consent
            (which may affect eligibility for certain publicity-only opportunities but not a valid prize claim already
            approved).
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">6. Winner consent (photo / video)</h3>
          <p className="mb-3">
            If you win, you agree to cooperate reasonably with requests for <strong>winner verification</strong>, which
            may include providing additional photo or short video identification and proof of eligibility. Refusal to
            provide reasonable verification may result in forfeiture of the prize.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">7. Prize</h3>
          <p className="mb-3">
            The prize is described on this website. Prizes are non-transferable unless we agree otherwise. No cash
            equivalent is guaranteed. If a listed item is unavailable, we may substitute an item of similar value.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">8. Payments and refunds (paid entries)</h3>
          <p className="mb-3">
            Payments are processed by our payment provider (e.g. Stripe). <strong>Entry fees are generally
            non-refundable</strong> once your entry is submitted and accepted, except where required by law or where we
            cancel the Competition for reasons within our control (in which case we will provide a remedy as required by
            applicable regulations). Chargebacks or payment disputes may result in disqualification.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">9. Data protection</h3>
          <p className="mb-3">
            We process personal data to run the Competition, take payment where applicable, contact winners, and meet
            legal obligations. Do not include unnecessary personal data in your video beyond what is needed to verify
            your entry.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">10. Limitation of liability</h3>
          <p className="mb-3">
            To the maximum extent permitted by law, we exclude liability for loss or damage except where caused by our
            negligence or fraud. Nothing in these terms limits statutory rights applicable to consumers in the UK.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">11. Disclaimer / third parties</h3>
          <p className="mb-3">
            This Competition is <strong>not affiliated with, endorsed by, or sponsored by</strong> Cristiano Ronaldo,
            Manchester United FC, Apple Inc., or any other third party whose trademarks or products may be referenced.
            All trademarks belong to their respective owners.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-slate-900">12. General</h3>
          <p className="mb-3">
            We reserve the right to postpone, amend, or cancel the Competition if circumstances require. Our decisions
            on eligibility, rules, and winners are final in matters of procedure except where prohibited by law. These
            terms are governed by the laws of <strong>England and Wales</strong> (or your UK jurisdiction of residence
            where mandatory consumer rules apply).
          </p>

          <p className="mt-6 text-xs text-slate-500">
            Promoter: ShowSkills Rewards (update with registered entity name and contact address before going live).
          </p>
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [termsOpen, setTermsOpen] = useState(false)
  const [paidVideo, setPaidVideo] = useState(null)
  const [paidError, setPaidError] = useState('')
  const [paidLoading, setPaidLoading] = useState(false)

  const [freeAnswer, setFreeAnswer] = useState('')
  const [freeEmail, setFreeEmail] = useState('')
  const [freeError, setFreeError] = useState('')
  const [freeSuccess, setFreeSuccess] = useState(false)

  const freeWords = useMemo(() => countWords(freeAnswer), [freeAnswer])

  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ''
  const stripeCheckoutApi = import.meta.env.VITE_STRIPE_CHECKOUT_API_URL ?? ''
  const stripePaymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? ''

  const handlePaidEntry = useCallback(async () => {
    setPaidError('')
    if (!paidVideo) {
      setPaidError('Please choose a video file of your kick-ups before paying.')
      return
    }

    setPaidLoading(true)
    try {
      if (stripeCheckoutApi && stripePublishableKey) {
        const res = await fetch(stripeCheckoutApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoFileName: paidVideo.name,
            successUrl: `${window.location.origin}${window.location.pathname}?checkout=success`,
            cancelUrl: `${window.location.origin}${window.location.pathname}?checkout=cancel`,
          }),
        })
        if (!res.ok) {
          const msg = await res.text()
          throw new Error(msg || 'Could not start checkout')
        }
        const data = await res.json()
        const sessionId = data.sessionId ?? data.id
        if (!sessionId) throw new Error('Invalid checkout response: missing sessionId')

        const stripe = await loadStripe(stripePublishableKey)
        if (!stripe) throw new Error('Stripe failed to load')
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) throw new Error(error.message)
        return
      }

      if (stripePaymentLink) {
        window.location.href = stripePaymentLink
        return
      }

      setPaidError(
        'Stripe test checkout is not configured. Add VITE_STRIPE_PAYMENT_LINK (Stripe Payment Link in test mode), or set VITE_STRIPE_PUBLISHABLE_KEY and VITE_STRIPE_CHECKOUT_API_URL to your backend that creates a Checkout Session.',
      )
    } catch (e) {
      setPaidError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPaidLoading(false)
    }
  }, [paidVideo, stripeCheckoutApi, stripePublishableKey, stripePaymentLink])

  const handleFreeEntry = useCallback(
    (e) => {
      e.preventDefault()
      setFreeError('')
      setFreeSuccess(false)

      if (!freeEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(freeEmail.trim())) {
        setFreeError('Please enter a valid email address.')
        return
      }
      if (!freeAnswer.trim()) {
        setFreeError('Please answer the question.')
        return
      }
      if (freeWords > FREE_MAX_WORDS) {
        setFreeError(`Please keep your answer to ${FREE_MAX_WORDS} words or fewer.`)
        return
      }

      setFreeSuccess(true)
    },
    [freeAnswer, freeEmail, freeWords],
  )

  return (
    <div className="min-h-svh bg-white font-sans text-slate-800 antialiased">
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      <header className="border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-x-3">
            <img
              src={showskillsLogo}
              alt="ShowSkills Rewards"
              className="h-9 w-auto sm:h-10"
              width={745}
              height={235}
            />
            <p className="max-w-[11rem] text-[10px] leading-snug text-slate-500 sm:max-w-none sm:text-[11px]">
              UK skill-based competitions
            </p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline">
            Secure checkout with Stripe
          </span>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
          <div className="pointer-events-none absolute -right-24 top-8 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />

          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
            <div className="text-left">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live challenge
              </p>
              <h1 className="font-display text-4xl leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
                35 Kick-Ups Challenge – Win the Ronaldo Legacy Bundle
              </h1>
              <p className="mt-5 max-w-xl text-lg text-slate-600">
                Prove your skills. One winner. Real prizes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#enter"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
                >
                  Enter now
                </a>
                <a
                  href="#rules"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300"
                >
                  Read rules
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/80">
                <img
                  src={BUNDLE_IMAGE_URL}
                  alt="Ronaldo Legacy Bundle: signed Champions League 2008 style shirt, CR7 Museum trophy, iPhone 17 Pro Max, luxury gold case"
                  className="aspect-[1024/682] w-full bg-white object-contain"
                  width={1024}
                  height={682}
                />
                <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-left">
                  <p className="text-sm font-medium text-slate-900">Ronaldo Legacy Bundle (illustrative)</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Signed shirt · CR7 Museum trophy · iPhone 17 Pro Max · Luxury gold case
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="rules" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="text-left">
            <h2 className="font-display text-3xl tracking-tight text-slate-900">Rules</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              Fair play keeps the competition credible. Please follow every rule — entries are checked by our team.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ['35 kick-ups', 'Complete 35 kick-ups in one continuous take.'],
                ['Face visible', 'Your face must be clearly visible throughout.'],
                ['No edits or cuts', 'Single unbroken recording — no editing tricks.'],
                ['Manual review', 'We review every qualifying entry before a winner is confirmed.'],
              ].map(([title, desc]) => (
                <li
                  key={title}
                  className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 shadow-sm"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                    ✓
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm text-slate-600">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="enter" className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <div className="text-left">
              <h2 className="font-display text-3xl tracking-tight text-slate-900">Choose how to enter</h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Paid entries support the prize pool. Free entries follow the same skill and fairness standards.
              </p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                Free entries have equal chance to win.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">Paid entry</h3>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">£1</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">£1 per ticket. Pay securely with Stripe (test mode).</p>

                <div className="mt-6 flex flex-1 flex-col gap-4">
                  <div>
                    <label htmlFor="paid-video" className="block text-sm font-medium text-slate-800">
                      Kick-ups video
                    </label>
                    <input
                      id="paid-video"
                      type="file"
                      accept="video/*"
                      className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
                      onChange={(e) => {
                        setPaidVideo(e.target.files?.[0] ?? null)
                        setPaidError('')
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">MP4, MOV or similar — keep under your host&apos;s limit.</p>
                  </div>

                  {paidError ? <ErrorBanner message={paidError} /> : null}

                  <button
                    type="button"
                    onClick={handlePaidEntry}
                    disabled={paidLoading}
                    className="mt-auto w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {paidLoading ? 'Opening checkout…' : 'Pay £1 & Upload Video'}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Uses Stripe test keys / payment link from your environment.{' '}
                    <button
                      type="button"
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                      onClick={() => setTermsOpen(true)}
                    >
                      See terms
                    </button>{' '}
                    for refunds and eligibility.
                  </p>
                </div>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Free entry</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Answer the question below. Same fair process applies to all entries.
                </p>

                <form className="mt-6 flex flex-1 flex-col gap-4" onSubmit={handleFreeEntry}>
                  <div>
                    <label htmlFor="free-answer" className="block text-sm font-medium text-slate-800">
                      What is your favourite Cristiano Ronaldo goal from his time at Manchester United and why?
                    </label>
                    <textarea
                      id="free-answer"
                      rows={5}
                      maxLength={4000}
                      value={freeAnswer}
                      onChange={(e) => setFreeAnswer(e.target.value)}
                      placeholder="Max 100 words — be specific about the match and moment."
                      className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="mt-1 flex justify-between text-xs text-slate-500">
                      <span>{freeWords} / {FREE_MAX_WORDS} words</span>
                      {freeWords > FREE_MAX_WORDS ? (
                        <span className="font-medium text-red-600">Over limit</span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="free-email" className="block text-sm font-medium text-slate-800">
                      Email
                    </label>
                    <input
                      id="free-email"
                      type="email"
                      autoComplete="email"
                      value={freeEmail}
                      onChange={(e) => setFreeEmail(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="you@example.com"
                    />
                  </div>

                  {freeError ? <ErrorBanner message={freeError} /> : null}
                  {freeSuccess ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                      Thanks — your free entry has been recorded (demo: connect this form to your backend to store
                      entries).
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="mt-auto w-full rounded-xl border-2 border-emerald-600 bg-white py-3.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                  >
                    Submit Free Entry
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left">
              <img
                src={showskillsLogo}
                alt=""
                className="h-7 w-auto opacity-95 sm:h-8"
                width={200}
                height={40}
                aria-hidden
              />
              <p className="mt-3 text-sm text-slate-600">Skill-based competitions you can trust.</p>
            </div>
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="text-left text-sm font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              Full Terms and Conditions
            </button>
          </div>
          <p className="mt-8 border-t border-slate-100 pt-8 text-center text-xs leading-relaxed text-slate-500">
            This is a skill-based competition, not a lottery. Not affiliated with Cristiano Ronaldo, Manchester United
            FC or Apple.
          </p>
        </div>
      </footer>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {message}
    </p>
  )
}
