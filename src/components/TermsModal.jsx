import { useEffect } from 'react'
import { COMPETITION_NAME_POSTAL } from '../competitionData'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'

function PaidTicketNonRefundCallout({ qualifier }) {
  return (
    <div className="mb-3">
      {qualifier ? <p className="mb-2 text-zinc-400">{qualifier}</p> : null}
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-zinc-200">
        <strong>{TICKET_PURCHASE_NON_REFUND_NOTICE}</strong>
      </p>
    </div>
  )
}

export function TermsModal({ open, onClose }) {
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
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close terms"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-900/40 bg-stone-950 shadow-2xl shadow-emerald-950/20">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" aria-hidden />
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <h2 id="terms-title" className="text-lg font-semibold text-stone-100">
            Terms &amp; privacy
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-white/5 hover:text-stone-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-left text-sm leading-relaxed text-zinc-400">
          <p className="mb-4 text-zinc-200">
            These Terms and Conditions and the Privacy Policy below govern <strong>ShowSkills Rewards</strong>{' '}
            promotions in the United Kingdom, including the paid <strong>Ronaldo Legacy Bundle</strong> skill competition
            and the separate <strong>free Ronaldo shirt giveaway</strong>. By entering, you agree to these terms.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">1. Eligibility and age</h3>
          <p className="mb-3">
            Promotions are open to residents of the United Kingdom aged <strong>18 or over</strong> at the date of entry.
            Employees of the promoter, their immediate families, and anyone otherwise connected with administration may be
            excluded. We may require proof of age, identity, and residency before awarding any prize.
          </p>
          <PaidTicketNonRefundCallout qualifier="If you purchase paid ticket bundles on this site:" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">2. Paid competition — skill-based (not a lottery)</h3>
          <p className="mb-3">
            The <strong>Ronaldo Legacy Bundle</strong> draw is a <strong>skill-based competition</strong>, not a lottery
            or raffle. After purchasing ticket(s), you must submit <strong>three free-text answers</strong> about
            Cristiano Ronaldo. <strong>All answers must be correct</strong> for your entry to qualify. There are{' '}
            <strong>no multiple-choice options</strong>; answers are typed manually and judged against the correct
            solutions. <strong>Incorrect or incomplete answers do not win</strong> and do not receive a prize. Multiple
            ticket purchases are allowed where shown on the entry page; each qualifying route is described there.
          </p>
          <PaidTicketNonRefundCallout />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">3. Winner selection (paid)</h3>
          <p className="mb-3">
            Among entries that have <strong>paid, submitted answers, and answered all three questions correctly</strong>,
            the winner is selected <strong>at random</strong> from that pool. There is <strong>no prize</strong> for
            incorrect, incomplete, or unsuccessful entries. We may verify answers and eligibility before confirming a
            winner.
          </p>
          <PaidTicketNonRefundCallout />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">4. Free postal entry (Ronaldo Legacy Bundle)</h3>
          <p className="mb-3">
            You may enter the same draw <strong>without payment</strong> by post. Send your <strong>full name</strong>,{' '}
            <strong>full postal address</strong>, <strong>email address</strong>, and the{' '}
            <strong>competition name</strong> (<span className="text-zinc-300">{COMPETITION_NAME_POSTAL}</span>) to the
            promoter address shown on the website. <strong>Limit: one free postal entry per person.</strong> Free postal
            entries are afforded the <strong>same opportunity to win</strong> as paid entries, subject to the same skill
            requirement (you must submit correct answers to the three questions by the method we specify for postal
            entrants — e.g. included in your postal entry or as directed on the site).
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid online ticket bundles only (not free postal entry):" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">5. Free Ronaldo shirt giveaway (separate)</h3>
          <p className="mb-3">
            The Ronaldo shirt giveaway is a <strong>separate, free engagement giveaway</strong> for promotion only. Entry
            is <strong>free</strong> (no payment). You answer one simple qualification question; the prize is a{' '}
            <strong>Ronaldo signed shirt only</strong> (not the full bundle). It does <strong>not</strong> form part of
            the paid Ronaldo Legacy Bundle competition unless expressly stated.
          </p>
          <p className="mb-3">
            The qualification question is: <strong>{SHIRT_GIVEAWAY_QUESTION}</strong>. Correct eligible entries qualify
            for the giveaway draw. We may disqualify entries that cannot be verified or breach these rules.
          </p>
          <PaidTicketNonRefundCallout qualifier="If you purchase Legacy Bundle tickets on this site (this giveaway entry itself is free):" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">6. Promotional rights and publicity</h3>
          <p className="mb-3">
            By entering, you grant the promoter a <strong>non-exclusive, royalty-free, worldwide licence</strong> to use
            your entry (including name, voice, image, and likeness as in your submission) to run the promotions,
            announce results, and reasonable related marketing, unless you withdraw consent in writing where applicable.
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles:" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">7. Winner verification</h3>
          <p className="mb-3">
            Winners must cooperate with <strong>reasonable verification</strong> (including ID / proof of eligibility).
            Refusal may result in forfeiture.
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles:" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">8. Prizes</h3>
          <p className="mb-3">
            Prizes are as described on this site. The bundle includes (illustratively) iPhone Pro Max, Ronaldo signed
            shirt (Manchester United era), signed football with COA, and premium case. Prizes are non-transferable unless
            we agree otherwise; no cash alternative is guaranteed; we may substitute items of similar value if needed.
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles for this draw:" />

          <h3 className="mb-2 mt-6 scroll-mt-4 font-semibold text-stone-200" id="ss-terms-ticket-payments">
            9. Payments (paid tickets)
          </h3>
          <p className="mb-3">
            Payments for <strong>ticket bundles</strong> are processed by our payment providers (e.g. Stripe, PayPal).
            This section applies to <strong>paid ticket purchases only</strong> (not free postal entries or free
            giveaways).
          </p>
          <PaidTicketNonRefundCallout />
          <p className="mb-3">
            Unjustified chargebacks may result in disqualification from the promotion. Nothing in these terms limits
            your <strong>mandatory statutory rights</strong> under UK law where they apply.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200" id="privacy-policy-heading">
            10. Privacy policy & data retention
          </h3>
          <p className="mb-3">
            We collect <strong>name and email</strong> (and other details you provide, such as address for postal
            entries) <strong>for competition administration only</strong>. We <strong>do not sell</strong> your data and{' '}
            <strong>do not share it with third parties</strong> for their marketing. Data is used to run the competition,
            verify entries, contact winners, and meet legal obligations.
          </p>
          <p className="mb-3">
            Personal data is <strong>deleted within 30 days after the competition closes</strong> (or as soon as
            practicable afterwards), except where we must retain certain records to meet legal or accounting
            requirements.
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles:" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">11. Limitation of liability</h3>
          <p className="mb-3">
            To the maximum extent permitted by law, we exclude liability except where caused by our negligence or fraud.
            Nothing limits statutory consumer rights in the UK.
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles:" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">12. Disclaimer / third parties</h3>
          <p className="mb-3">
            Promotions are <strong>not affiliated with, endorsed by, or sponsored by</strong> Cristiano Ronaldo,
            Manchester United FC, Apple Inc., or other third parties referenced. Trademarks belong to their owners.
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles:" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">13. General</h3>
          <p className="mb-3">
            We may amend or cancel promotions if required. Our decisions on procedure are final where the law allows.
            Governing law: <strong>England and Wales</strong> (or mandatory UK consumer rules where applicable).
          </p>
          <PaidTicketNonRefundCallout qualifier="Paid ticket bundles:" />

          <p className="mt-6 text-xs text-zinc-500">
            Promoter: ShowSkills Rewards (insert registered entity name and full postal address before going live).
          </p>
        </div>
        <div className="border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-emerald-950 hover:brightness-110"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
