import { Link } from 'react-router-dom'
import { PrivacyPolicySection } from '../components/TermsModal'
import { SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-500/90">ShowSkills Rewards</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-stone-100 sm:text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-zinc-400">
        This page is the public privacy policy for ShowSkills Rewards. It covers competitions on{' '}
        <strong className="text-zinc-300">showskills.co.uk</strong> and related services, including third-party APIs
        used in our internal content tools.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Questions:{' '}
        <a
          href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
          className="text-teal-400 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-300"
        >
          {SHOWSKILLS_CONTACT_EMAIL}
        </a>
        {' · '}
        <Link to="/contact" className="text-teal-400 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-300">
          Contact form
        </Link>
      </p>

      <div className="prose-invert mt-8 rounded-2xl border border-emerald-900/35 bg-stone-950/80 px-5 py-6 text-left text-base leading-relaxed text-zinc-400 sm:px-8">
        <PrivacyPolicySection />
      </div>
    </div>
  )
}
