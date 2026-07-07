import { useEffect } from 'react'
import { COMPETITION_NAME_POSTAL, POSTAL_ENTRY_ADDRESS, NO_PURCHASE_ENTRY_NOTICE } from '../competitionData'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../../shared/ticketCheckoutNotice.mjs'
import {
  MINIMUM_SALES_DEFAULT_RULE,
  MINIMUM_SALES_EXCEPTION_RULE,
  MINIMUM_SALES_TERMS_INTRO,
  TICKET_NON_REFUND_SKILL_AND_VOLUNTARY,
} from '../../shared/competitionMinimumSalesPolicy.mjs'
import { SHIRT_GIVEAWAY_QUESTION, SHIRT_GIVEAWAY_SEASON_LABEL } from '../../shared/shirtGiveaway.mjs'
import {
  WORLD_CUP_BALL_TERMS_SECTIONS,
} from '../../shared/worldCupBallGiveawayRules.mjs'
import { WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY } from '../../shared/worldCupBallPhotography.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../shared/worldCupBallGiveaway.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'
import { UK_AVAILABILITY_NOTICE } from '../../shared/siteAvailability.mjs'
import { LegalDisclaimerNotice } from './LegalDisclaimerNotice'
import { PrizeAuthenticityNotice } from './PrizeAuthenticityNotice'
import { WinnerPhotographyConsentTerms } from './WinnerPhotographyConsentTerms'
import { WINNER_PHOTOGRAPHY_BUNDLE_TERMS_SUMMARY } from '../../shared/winnerPhotographyConsent.mjs'

function PaidTicketNonRefundCallout() {
  return (
    <p className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2.5 text-zinc-200">
      <strong>{TICKET_NON_REFUND_SKILL_AND_VOLUNTARY}</strong>
    </p>
  )
}

export function PrivacyPolicySection() {
  const mail = SHOWSKILLS_CONTACT_EMAIL
  return (
    <>
      <div
        className="my-8 border-t border-emerald-900/40 pt-8"
        id="privacy-policy-heading"
        aria-labelledby="privacy-policy-title"
      >
        <h2 id="privacy-policy-title" className="text-base font-semibold text-stone-100">
          Privacy Policy
        </h2>
        <p className="mt-2 text-sm text-zinc-500 md:text-xs">Last updated: 7 July 2026</p>
        <p className="mt-4 text-zinc-300">
          At <strong>ShowSkills Rewards</strong>, we respect your privacy and are committed to protecting your personal
          data. This Privacy Policy explains how we collect, use, and protect your information when you use our
          website. It supplements the competition rules above and applies to all promotions on this site.
        </p>
        <p className="mt-4 rounded-lg border border-teal-800/40 bg-teal-950/30 px-3 py-2.5 text-zinc-200">
          {NO_PURCHASE_ENTRY_NOTICE} Paid ticket purchase is optional where free postal or free online entry is offered
          for the same draw, subject to the same skill requirements.
        </p>
        <p className="mt-4 rounded-lg border border-stone-700/50 bg-stone-900/40 px-3 py-2.5 text-zinc-200">
          <strong>Third parties &amp; imagery:</strong> ShowSkills Rewards is{' '}
          <strong>
            not affiliated with, endorsed by, sponsored by, or officially connected to Cristiano Ronaldo, CR7,
            Manchester United Football Club, or Apple Inc.
          </strong>{' '}
          We may use <strong>AI-generated or edited images for illustration only</strong> and do{' '}
          <strong>not use official promotional imagery</strong> from those parties. See the{' '}
          <a
            href="#ss-terms-legal-disclaimer"
            className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
          >
            Legal disclaimer in the Terms above
          </a>{' '}
          for full details.
        </p>
      </div>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.1 Information we collect</h3>
      <p className="mb-2">We only collect the minimum information necessary to run our competitions:</p>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>Name, email address, and mobile phone number (when you enter a competition or buy tickets online)</li>
        <li>
          Payment information (processed securely by our payment providers, e.g. <strong>Cashflows</strong> and/or{' '}
          <strong>PayPal</strong> — we do <strong>not</strong> store your full card number, CVV, or other card credentials
          on our servers)
        </li>
        <li>
          For <strong>free online entry</strong> to the Signed Legacy Bundle, we may ask you to complete a{' '}
          <strong>£0.00 card authorisation</strong> (verification only — you are not charged). Your card details are
          entered only into <strong>Cashflows&apos; secure payment fields</strong>.{' '}
          <strong>ShowSkills Rewards does not receive, store, or retain your card details</strong> from that £0
          authorisation; Cashflows processes it under their own terms and security standards. We may keep a payment
          reference or verification identifier to prevent duplicate or fraudulent entries.
        </li>
        <li>Answers to skill-based questions (paid entries after purchase and free postal or giveaway routes)</li>
        <li>
          <strong>{WORLD_CUP_BALL_GIVEAWAY_LABEL}:</strong> quiz answers, connection (IP address) checks for one attempt per
          connection, and — if you do not win — which questions you answered incorrectly (shown to you in your browser
          during the attempt only)
        </li>
        <li>Postal address (only if you submit a free postal entry)</li>
        <li>
          <strong>Contact telephone number</strong> — collected at online entry so we can reach you if you win or need
          to verify your entry. We use it only for competition administration and prize fulfilment, and we delete it
          after the relevant competition period ends unless a longer period is required by law or to resolve a dispute.
        </li>
        <li>IP address and basic technical data (for security and anonymous analytics)</li>
        <li>
          <strong>Optional user account (My account):</strong> if you create a free ShowSkills Rewards login, we
          store your email, full name, and a <strong>secure password hash</strong> (we never store your plain-text
          password). You may optionally add a phone number, billing address, and delivery address in your profile.
          We also store account creation and last sign-in times, newsletter preferences, and competition entry
          history linked to your account (paid tickets, giveaways, and skill-quiz status). A secure{' '}
          <strong>session cookie</strong> keeps you signed in on your device until you log out or the session
          expires.
        </li>
      </ul>
      <p className="mb-2">We do not collect:</p>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>
          Your plain-text password — only a one-way hash is stored for account logins; payment card numbers and CVV
          are handled only by our payment providers
        </li>
        <li>Government ID numbers through the website (we may ask winners to verify identity separately)</li>
        <li>Date of birth on the entry form (eligibility is based on you confirming you meet the age requirement)</li>
        <li>Any special category / sensitive personal data</li>
      </ul>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200" id="ss-privacy-user-accounts">
        P.1a Optional user accounts — what we store and deletion
      </h3>
      <p className="mb-2">
        Creating a <strong>ShowSkills Rewards account</strong> is <strong>optional</strong>. You can still enter many
        promotions as a guest using your email at checkout. If you register, we collect and store only what is needed
        to run your account:
      </p>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>
          <strong>Account details:</strong> email address, full name, password (stored as a secure hash only)
        </li>
        <li>
          <strong>Profile (optional):</strong> phone number, billing address, and delivery address — only if you choose
          to add them
        </li>
        <li>
          <strong>Newsletter preferences:</strong> whether you receive competition and giveaway emails (account
          registration subscribes you by default; you can change this in My account or via links in our emails)
        </li>
        <li>
          <strong>Entry history:</strong> paid tickets, free giveaway entries, and skill-quiz completion status linked
          to your account so you can view them in <strong>My account</strong>
        </li>
        <li>
          <strong>Security &amp; access:</strong> account creation date, last sign-in time, a secure{' '}
          <strong>user session cookie</strong> while you are logged in, and short-lived hashed codes if you use{' '}
          <strong>Forgot password</strong> (sent to your email)
        </li>
      </ul>
      <p className="mb-3 rounded-lg border border-teal-800/40 bg-teal-950/30 px-3 py-2.5 text-zinc-200">
        <strong>Delete your account:</strong> you can permanently delete your login at any time from{' '}
        <strong>My account → Delete account</strong>, entering your password to confirm. Deletion removes your profile
        details (name, phone, addresses) and invalidates your password. Your account email is{' '}
        <strong>anonymised</strong> on our systems. Records needed for legal, tax, fraud prevention, or completed
        transactions (for example ticket purchases already made) may be kept in anonymised or minimal form where the law
        requires — account deletion does not erase every historical order audit record. After deletion you cannot sign
        in with the same credentials; you may register again with the same email unless our abuse rules prevent it.
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.2 How we use your information</h3>
      <p className="mb-2">We use your personal data only for:</p>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>Administering competitions and contacting winners (by email and telephone where provided)</li>
        <li>Processing ticket payments and sending purchase or entry confirmations</li>
        <li>
          Running <strong>£0.00 card verification</strong> for eligible free online entries (anti-fraud and duplicate
          prevention — we do not store card details from this step)
        </li>
        <li>Verifying skill answers and qualifying entries</li>
        <li>Responding to enquiries via our contact form or email</li>
        <li>Improving our website (anonymous analytics, e.g. Vercel Analytics)</li>
        <li>
          Running your <strong>optional user account</strong> — sign-in, profile settings, entry history, password
          reset, newsletter preferences, and account deletion (see{' '}
          <a
            href="#ss-privacy-user-accounts"
            className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
          >
            user accounts
          </a>{' '}
          above)
        </li>
        <li>
          <strong>Winner announcements:</strong> if you win, we may photograph or film you with the prize and use
          those images or videos on our website, social media, and promotional materials — see{' '}
          <a
            href="#ss-privacy-winner-photography"
            className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
          >
            winner photography &amp; promotional consent
          </a>{' '}
          below and in the Terms above
        </li>
      </ul>

      <WinnerPhotographyConsentTerms
        id="ss-privacy-winner-photography"
        headingLevel="h3"
        showTitle
      />
      <p className="mb-3 text-zinc-300">
        Where we rely on your agreement to this use, you may withdraw consent for future promotional use by contacting
        us; this does not affect content already published in good faith before withdrawal, and refusing photography
        when you win is subject to the valid-reason rules in our Terms.
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.3 Legal basis for processing</h3>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>
          <strong>Contract</strong> — to fulfil your competition entry and payments
        </li>
        <li>
          <strong>Legitimate interests</strong> — to run, secure, and improve our service
        </li>
        <li>
          <strong>Consent</strong> — where you agree to winner photography and promotional use (see winner photography
          section above)
        </li>
        <li>
          <strong>Legal obligation</strong> — where required by law (e.g. prize winner verification or tax records)
        </li>
      </ul>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.4 Sharing your information</h3>
      <p className="mb-2">We share your data only with:</p>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>
          <strong>Cashflows</strong> and/or <strong>PayPal</strong> — secure payment processing
        </li>
        <li>
          <strong>Email providers</strong> (e.g. Resend) — competition-related emails such as confirmations and results
        </li>
        <li>
          <strong>Legal authorities</strong> — if required by law
        </li>
      </ul>
      <p className="mb-3">
        We <strong>do not sell</strong> your personal data to third parties for their marketing.
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.5 How long we keep your data</h3>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>
          <strong>Competition entries:</strong> up to <strong>90 days</strong> after the relevant competition ends,
          unless a longer period is needed to resolve disputes or meet legal duties
        </li>
        <li>
          <strong>Winner data:</strong> basic details may be kept longer for legal, tax, and record-keeping purposes
        </li>
        <li>
          <strong>Winner photos and videos:</strong> retained for as long as needed for winner announcements and
          reasonable promotional use on ShowSkills Rewards channels, unless you ask us to remove specific content and
          we can do so without undermining records of a completed draw
        </li>
        <li>
          <strong>Payment data:</strong> handled by our payment providers under their own retention policies — we do not
          hold your card details from paid checkout or from a £0 authorisation
        </li>
        <li>
          <strong>Free online verification references:</strong> we may retain a Cashflows payment or verification
          reference (not card numbers) for a limited time to enforce entry limits and resolve disputes
        </li>
        <li>
          <strong>User account data:</strong> kept while your account is active. If you delete your account, profile
          and login data are removed or anonymised promptly; minimal purchase or entry audit records may be retained
          where required by law (see{' '}
          <a
            href="#ss-privacy-user-accounts"
            className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
          >
            account deletion
          </a>
          )
        </li>
      </ul>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.6 Your rights</h3>
      <p className="mb-2">Under UK data protection law, you have the right to:</p>
      <ul className="mb-3 list-inside list-disc space-y-1">
        <li>Access the personal data we hold about you</li>
        <li>Request correction or deletion of your data</li>
        <li>Object to or restrict certain processing</li>
        <li>Withdraw consent where processing is based on consent</li>
        <li>Lodge a complaint with the ICO (Information Commissioner&apos;s Office)</li>
        <li>
          <strong>Delete your account</strong> yourself from My account (password confirmation required), or contact us
          if you need help
        </li>
      </ul>
      <p className="mb-3">
        To exercise any of these rights, email{' '}
        <a
          href={`mailto:${mail}`}
          className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
        >
          {mail}
        </a>{' '}
        or use the <strong>contact form</strong> on this website. The data controller is{' '}
        <span className="text-zinc-300">{POSTAL_ENTRY_ADDRESS}</span>.
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.7 Cookies</h3>
      <p className="mb-3">
        We use <strong>essential</strong> cookies and similar technologies so the site works (e.g. admin sessions where
        applicable, <strong>user session cookies</strong> when you are signed in to My account, and payment checkout).
        We use <strong>anonymous analytics</strong> to understand how the site is used. We do <strong>not</strong> use
        advertising or cross-site tracking cookies.
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.8 International transfers</h3>
      <p className="mb-3">
        Some service providers (e.g. payment or email) may process data outside the UK. Where this happens, we rely on
        appropriate safeguards such as UK adequacy regulations or contractual protections offered by those providers.
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.9 Prize authenticity</h3>
      <PrizeAuthenticityNotice headingLevel="h4" id="ss-privacy-prize-authenticity" showHeading={false} />

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.10 Intellectual property &amp; illustrative content</h3>
      <LegalDisclaimerNotice headingLevel="h4" id="ss-privacy-legal-disclaimer" />

      <h3 className="mb-2 mt-6 font-semibold text-stone-200" id="ss-privacy-third-party-apis">
        P.11 Third-party services &amp; APIs (including Pinterest)
      </h3>
      <p className="mb-3">
        To operate our website and internal content tools, we use trusted third-party services. These providers process
        data only as needed to deliver their service to us, under their own terms and privacy policies.
      </p>
      <ul className="mb-3 list-inside list-disc space-y-2">
        <li>
          <strong>Payment processing</strong> (e.g. Cashflows, PayPal) — card and payment details are handled by the
          payment provider; we do not store full card numbers on our servers.
        </li>
        <li>
          <strong>Email &amp; hosting</strong> — transactional email and site hosting infrastructure.
        </li>
        <li>
          <strong>Stock imagery &amp; creative APIs</strong> — our internal &quot;Eyes of Football&quot; production tools
          (staging/admin only, not a public consumer Pinterest login) may use the{' '}
          <strong>Pinterest API</strong> and <strong>Pexels API</strong> to search for or retrieve images used when
          assembling YouTube Shorts. This is server-to-server: we do <strong>not</strong> collect Pinterest account
          data from website visitors through this integration. API credentials are stored securely on our servers and
          are not published in the public site. Images are used for editorial/video production in line with each
          provider&apos;s terms.
        </li>
        <li>
          <strong>Text-to-speech</strong> — narration for internal video drafts may use Microsoft Edge neural TTS via a
          server library; no voice biometric data is collected from users for this purpose.
        </li>
      </ul>
      <p className="mb-3">
        For more information about how Pinterest handles data, see{' '}
        <a
          href="https://policy.pinterest.com/en/privacy-policy"
          className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pinterest&apos;s Privacy Policy
        </a>
        . For Pexels, see{' '}
        <a
          href="https://www.pexels.com/privacy-policy/"
          className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pexels Privacy Policy
        </a>
        .
      </p>
      <p className="mb-3">
        Questions about our use of third-party APIs:{' '}
        <a
          href={`mailto:${mail}`}
          className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
        >
          {mail}
        </a>
        .
      </p>

      <h3 className="mb-2 mt-6 font-semibold text-stone-200">P.12 Changes to this policy</h3>
      <p className="mb-3">
        We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date above will change when we
        do. Significant changes may also be noted on the website where appropriate.
      </p>
    </>
  )
}

export function TermsModal({ open, onClose }) {
  // No body scroll lock — it breaks keyboard input in Safari/Brave (entry modal + card iframes).

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="ss-terms-modal-root fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75"
        aria-label="Close terms"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,1080px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-900/40 bg-stone-950 shadow-2xl shadow-emerald-950/20 sm:max-w-4xl lg:max-h-[min(94vh,1160px)] lg:max-w-5xl xl:max-w-6xl xl:max-h-[min(94vh,1200px)]">
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
        <div className="overflow-y-auto px-5 py-5 text-left text-base leading-relaxed text-zinc-400 ss-terms-modal-body sm:px-6">
          <p className="mb-4 text-zinc-200">
            These Terms and Conditions and the Privacy Policy below govern <strong>ShowSkills Rewards</strong>{' '}
            promotions in the United Kingdom, including the paid <strong>Signed Legacy Bundle</strong> skill competition
            and the separate <strong>free Ronaldo shirt giveaway</strong>. You may also create an optional{' '}
            <strong>user account</strong> to view entry history and manage your profile. By entering or registering, you
            agree to these terms.
          </p>

          <p className="mb-4 rounded-lg border border-emerald-900/35 bg-emerald-950/25 px-3 py-2.5 text-zinc-200">
            {UK_AVAILABILITY_NOTICE}
          </p>

          <p className="mb-4 rounded-lg border border-teal-800/40 bg-teal-950/30 px-3 py-2.5 text-zinc-200">
            <strong>{NO_PURCHASE_ENTRY_NOTICE}</strong> Postal address for free entry:{' '}
            <span className="text-zinc-300">{POSTAL_ENTRY_ADDRESS}</span>.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">1. Eligibility and age</h3>
          <p className="mb-3">
            Promotions are open to residents of the United Kingdom aged <strong>18 or over</strong> at the date of entry.
            <strong> ShowSkills Rewards is currently available for UK residents only.</strong> We are expanding globally
            soon; until then, entries and payments from outside the UK are not accepted. Employees of the promoter,
            their immediate families, and anyone otherwise connected with administration may be excluded. We may require
            proof of age, identity, and residency before awarding any prize.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">2. Paid competition — skill-based (not a lottery)</h3>
          <p className="mb-3">
            The <strong>Signed Legacy Bundle</strong> draw is a <strong>skill-based competition</strong>, not a lottery.
            Each competition runs for a defined <strong>entry period</strong>; only qualifying entries received within that
            period are included in the draw for that period. When a period closes, the winner is drawn only from that
            period&apos;s pool — entries from earlier or later periods are not mixed in. After purchasing ticket(s), you must submit <strong>three free-text answers</strong> about
            Cristiano Ronaldo. <strong>All answers must be correct</strong> for your entry to qualify for the main draw. There are{' '}
            <strong>no multiple-choice options</strong>; answers are typed manually and judged against the correct
            solutions. <strong>You have one attempt at the three questions per entry</strong> — answers cannot be changed after submission.
            Multiple ticket purchases are allowed where shown on the entry page; each purchase starts a new entry (subject to the rules below).
          </p>

          <div className="mb-3 rounded-lg border border-stone-700/50 bg-stone-900/50 px-3 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              Signed Legacy Bundle — legal notice
            </p>
            <p className="mb-2 text-zinc-200">
              The <strong>Signed Legacy Bundle</strong> prizes (signed memorabilia, museum football, iPhone, and case)
              are <strong>genuine, legally purchased rare collectibles</strong> — not official licensed merchandise from
              Cristiano Ronaldo, CR7, Manchester United, or Apple.
            </p>
            <p className="mb-2 text-zinc-300">
              <strong>ShowSkills Rewards is not affiliated with, endorsed by, sponsored by, or officially connected to</strong>{' '}
              Cristiano Ronaldo, CR7, Manchester United Football Club, or Apple Inc. Bundle imagery may be{' '}
              <strong>AI-generated or edited for illustration</strong>; see section 13 and the Privacy Policy for the
              full intellectual property notice.
            </p>
            <p className="text-zinc-300">{WINNER_PHOTOGRAPHY_BUNDLE_TERMS_SUMMARY}</p>
          </div>

          <h3 id="ss-terms-consolation-prize" className="mb-2 mt-4 font-semibold text-stone-200">
            2a. Consolation prize (Free Ronaldo Shirt Giveaway)
          </h3>
          <p className="mb-3">
            The main Signed Legacy Bundle draw remains strictly skill-based: incorrect answers do <strong>not</strong> qualify for
            the bundle prize, and <strong>tickets are not refunded</strong> if your skill answers are wrong.
          </p>
          <p className="mb-3 rounded-lg border border-emerald-900/35 bg-emerald-950/25 px-3 py-2.5 text-zinc-200">
            <strong>Consolation prize:</strong> If you get the three skill questions wrong, you automatically receive{' '}
            <strong>2 entries</strong> into the separate <strong>Free Ronaldo Shirt Giveaway</strong> (consolation prize).
            This applies equally to <strong>free online Signed Legacy Bundle entrants</strong> and to{' '}
            <strong>paid ticket buyers who spend £10 or more on tickets in a single purchase</strong>. Consolation entries
            do <strong>not</strong> enter you into the main Signed Legacy Bundle draw and do <strong>not</strong> replace a
            qualifying entry. They are recorded automatically — you do not need to complete the separate shirt giveaway form
            again for these consolation entries.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">3. Winner selection (paid)</h3>
          <p className="mb-3">
            Among entries that have <strong>paid, submitted answers, and answered all three questions correctly</strong>
            within the active competition period, the winner is selected <strong>at random</strong> from that
            period&apos;s pool only. There is <strong>no prize</strong> for incorrect, incomplete, or unsuccessful entries.
            The winner is contacted by email and must respond within the timeframe stated in that notification. We may
            verify answers and eligibility before confirming a winner.
          </p>

          <WinnerPhotographyConsentTerms id="ss-terms-winner-photography-consent" headingLevel="h3" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">4. Free postal entry (Signed Legacy Bundle)</h3>
          <p className="mb-3">
            <strong>No purchase necessary.</strong> You may enter the same draw <strong>without payment</strong> by post.
            Send your <strong>full name</strong>, <strong>full postal address</strong>, <strong>email address</strong>, and
            the <strong>competition name</strong> (<span className="text-zinc-300">{COMPETITION_NAME_POSTAL}</span>) to:{' '}
            <span className="text-zinc-300">{POSTAL_ENTRY_ADDRESS}</span>. <strong>Limit: one free postal entry per person.</strong>{' '}
            Free postal
            entries are afforded the <strong>same opportunity to win</strong> as paid entries, subject to the same skill
            requirement (you must submit correct answers to the three questions by the method we specify for postal
            entrants — e.g. included in your postal entry or as directed on the site).
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">
            5. Free online entry — £0 card verification (Signed Legacy Bundle)
          </h3>
          <p className="mb-3">
            Where offered on the site, you may enter the Signed Legacy Bundle draw <strong>online without paying</strong>{' '}
            subject to entry limits shown at checkout. This is part of our <strong>no purchase necessary</strong> free entry
            route alongside postal entry. Before you submit your skill answers, we may require{' '}
            <strong>£0 debit card verification</strong> — a <strong>zero-pound authorisation only</strong> (you are{' '}
            <strong>not charged</strong> for the ticket). This helps reduce abuse and duplicate entries.{' '}
            <strong>ShowSkills Rewards does not collect or store your debit card details</strong> from this free verification
            step.
          </p>
          <p className="mb-3 rounded-lg border border-emerald-900/35 bg-emerald-950/25 px-3 py-2.5 text-zinc-200">
            <strong>Card details are not stored by ShowSkills Rewards.</strong> You enter card details only in{' '}
            <strong>Cashflows&apos; secure hosted fields</strong>. We do <strong>not</strong> receive, store, or keep
            your full card number, expiry, CVV, or other card credentials from the £0 authorisation on our systems.
            Cashflows processes the verification; we may receive only a confirmation, status, and a payment or job
            reference to link your entry — not your card data.
          </p>
          <p className="mb-3">
            After successful verification, you complete the same three skill questions as other entrants. The same
            qualification rules apply. Free online entry limits (e.g. per name and address) are shown on the entry form.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">6. Free Ronaldo shirt giveaway (separate)</h3>
          <p className="mb-3">
            The Ronaldo shirt giveaway is a <strong>separate, free engagement giveaway</strong> for promotion only. Entry
            is <strong>free</strong> (no payment). You answer one simple qualification question; subscribe to the
            ShowSkills newsletter; follow us on <strong>TikTok, Instagram, or Facebook</strong> (your choice — you only
            need one); and provide your social handle so we can verify engagement. The prize is a{' '}
            <strong>signed Cristiano Ronaldo Manchester United home shirt from the {SHIRT_GIVEAWAY_SEASON_LABEL}</strong>{' '}
            (not the full bundle). It does <strong>not</strong> form part of
            the paid Signed Legacy Bundle competition unless expressly stated. Signed Legacy Bundle entrants who get the three skill
            questions wrong may receive <strong>automatic consolation entries</strong> into this shirt draw — see section 2a above.
          </p>
          <p className="mb-3">
            The qualification question is: <strong>{SHIRT_GIVEAWAY_QUESTION}</strong>. Correct eligible entries qualify
            for the giveaway draw. We may disqualify entries that cannot be verified or breach these rules.
          </p>
          <p className="mb-3">
            <strong>One entry per device:</strong> only one shirt giveaway entry is allowed per connection/device (IP),
            including if you try again with a different email. <strong>VPNs and proxies are not allowed</strong> — turn
            off your VPN before entering.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">6a. {WORLD_CUP_BALL_GIVEAWAY_LABEL} (free skill challenge)</h3>
          {WORLD_CUP_BALL_TERMS_SECTIONS.map((section) => (
            <p key={section.title} className="mb-3 leading-relaxed text-zinc-300">
              <strong className="text-stone-200">{section.title}:</strong> {section.body}
            </p>
          ))}
          <p className="mb-3 leading-relaxed text-zinc-300">
            See also{' '}
            <a
              href="#ss-terms-winner-photography-consent"
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              Winner Photography &amp; Promotional Consent
            </a>{' '}
            above. Contact: <a href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`} className="text-amber-300 underline">{SHOWSKILLS_CONTACT_EMAIL}</a>.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">7. Promotional rights and publicity</h3>
          <p className="mb-3">
            By entering, you grant the promoter a <strong>non-exclusive, royalty-free, worldwide licence</strong> to use
            your entry (including name, voice, image, and likeness as in your submission) to run the promotions,
            announce results, and reasonable related marketing, unless you withdraw consent in writing where applicable.
            If you <strong>win</strong>, additional rules apply to photography and video with the prize — see{' '}
            <a
              href="#ss-terms-winner-photography-consent"
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              Winner Photography &amp; Promotional Consent
            </a>{' '}
            above.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">8. Winner verification</h3>
          <p className="mb-3">
            Winners must cooperate with <strong>reasonable verification</strong> (including ID / proof of eligibility).
            Refusal may result in forfeiture.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">9. Prizes</h3>
          <p className="mb-3">
            Prizes are as described on this site. The bundle includes (illustratively) iPhone Pro Max, Ronaldo signed
            shirt (Manchester United era), signed football with COA, and premium case. Prizes are non-transferable unless
            we agree otherwise; no cash alternative is guaranteed; we may substitute items of similar value if needed.
          </p>
          <p className="mb-3 rounded-lg border border-amber-900/35 bg-amber-950/25 px-3 py-2.5 text-zinc-200">
            <strong>Authenticity:</strong> Signed Legacy Bundle prizes are{' '}
            <strong>genuine, legally purchased rare collectibles</strong> acquired on the open market.{' '}
            <strong>Illustrative images</strong> on the site may be{' '}
            <strong>AI-generated or heavily edited</strong> — see section 13 for the full disclaimer. Actual physical
            items are as described when awarded to the winner. See also the{' '}
            <a
              href="#ss-prize-authenticity"
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              Prize authenticity
            </a>{' '}
            section below.
          </p>

          <PrizeAuthenticityNotice headingLevel="h4" id="ss-prize-authenticity" />

          <h3 className="mb-2 mt-6 scroll-mt-4 font-semibold text-stone-200" id="ss-terms-ticket-payments">
            10. Payments (paid tickets)
          </h3>
          <p className="mb-3">
            Payments for <strong>ticket bundles</strong> are processed by our payment providers (e.g. Cashflows, PayPal).
            This section applies to <strong>paid ticket purchases only</strong> (not free postal entries, £0 card
            verification, or free giveaways). For paid tickets, card details are entered into our providers&apos;
            secure fields — <strong>we do not store your full card details</strong> on our servers.
          </p>

          <h4 className="mb-2 mt-4 font-semibold text-stone-200" id="ss-terms-minimum-ticket-sales">
            Minimum ticket sales &amp; automatic refunds
          </h4>
          <p className="mb-3">{MINIMUM_SALES_TERMS_INTRO}</p>
          <p className="mb-3 rounded-lg border border-teal-800/40 bg-teal-950/30 px-3 py-2.5 text-zinc-200">
            <strong>Default rule (most paid prize draws):</strong> {MINIMUM_SALES_DEFAULT_RULE}
          </p>
          <p className="mb-3 rounded-lg border border-emerald-900/35 bg-emerald-950/25 px-3 py-2.5 text-zinc-200">
            <strong>Exception (typically smaller prizes):</strong> {MINIMUM_SALES_EXCEPTION_RULE}
          </p>

          <h4 className="mb-2 mt-4 font-semibold text-stone-200">Non-refundable purchases</h4>
          <PaidTicketNonRefundCallout />
          <p className="mb-3">
            Unjustified chargebacks may result in disqualification from the promotion. Nothing in these terms limits
            your <strong>mandatory statutory rights</strong> under UK law where they apply.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">11. Personal data</h3>
          <p className="mb-3">
            We process personal data to run these promotions. The rules above (eligibility, entries, payments, and
            winners) describe <strong>what</strong> we need from you to enter. <strong>How</strong> we collect, use,
            share, retain, and protect that data — and your privacy rights — are set out in the{' '}
            <a
              href="#privacy-policy-heading"
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              Privacy Policy below
            </a>
            .
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200" id="ss-terms-user-accounts">
            11a. Optional user account (My account)
          </h3>
          <p className="mb-3">
            You may create a <strong>free ShowSkills Rewards account</strong> to sign in, view linked competition
            entries, and update optional profile details. An account is <strong>not required</strong> to enter every
            promotion — guest checkout and free routes remain available where offered.
          </p>
          <p className="mb-3">
            By registering, you confirm that the email and details you provide are accurate, that you will keep your
            password confidential, and that you are at least <strong>18</strong>. Registration subscribes you to our
            newsletter by default (you can change email preferences in My account or via unsubscribe links).
          </p>
          <p className="mb-3">
            We store account data as described in the{' '}
            <a
              href="#ss-privacy-user-accounts"
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              Privacy Policy — user accounts
            </a>
            . You may <strong>delete your account at any time</strong> from <strong>My account → Delete account</strong>,
            entering your password to confirm. Deletion removes your login and profile information and anonymises your
            account email. Historical purchase or entry records needed for legal, tax, or dispute purposes may be
            retained in anonymised or minimal form, as explained in the Privacy Policy.
          </p>
          <p className="mb-3">
            We may suspend or refuse accounts that breach these terms, abuse entry limits, or attempt fraud. Contact us
            at{' '}
            <a
              href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              {SHOWSKILLS_CONTACT_EMAIL}
            </a>{' '}
            for account help.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">12. Limitation of liability</h3>
          <p className="mb-3">
            To the maximum extent permitted by law, we exclude liability except where caused by our negligence or fraud.
            Nothing limits statutory consumer rights in the UK.
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200" id="ss-terms-legal-disclaimer">
            13. Legal disclaimer &amp; intellectual property
          </h3>
          <LegalDisclaimerNotice headingLevel="h4" id="ss-legal-disclaimer-body" />

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">14. General</h3>
          <p className="mb-3">
            We may amend or cancel promotions if required. Our decisions on procedure are final where the law allows.
            Governing law: <strong>England and Wales</strong> (or mandatory UK consumer rules where applicable).
          </p>

          <h3 className="mb-2 mt-6 font-semibold text-stone-200">15. Contact</h3>
          <p className="mb-3">
            For general enquiries, complaints, cooperation requests, or feedback, use the{' '}
            <strong>contact form on this website</strong> or email{' '}
            <a
              href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
              className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
            >
              {SHOWSKILLS_CONTACT_EMAIL}
            </a>
            . We aim to respond within a reasonable time.
          </p>

          <PrivacyPolicySection />

          <p className="mt-6 text-xs text-zinc-500">
            Promoter: {POSTAL_ENTRY_ADDRESS}. Contact:{' '}
            <a href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`} className="text-zinc-400 underline hover:text-zinc-300">
              {SHOWSKILLS_CONTACT_EMAIL}
            </a>
            .
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
