import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { NewsletterSignupForm } from '../components/NewsletterSignupForm'
import { NEWSLETTER_SOURCES } from '../../shared/newsletter.mjs'

export default function NewsletterPage() {
  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] text-white sm:text-4xl">
          ShowSkills Rewards
        </h1>
        <p className="mt-3 text-base text-stone-400">
          Free email updates about giveaways, competitions, and prize draws. You do not need a ShowSkills account — just
          your email.
        </p>
        <div className="mt-8 rounded-2xl border border-lime-500/25 bg-lime-950/20 p-5 sm:p-6">
          <NewsletterSignupForm source={NEWSLETTER_SOURCES.page} />
        </div>
        <p className="mt-6 text-sm text-stone-500">
          Already subscribed? Use the preferences or unsubscribe link in any email we send, or{' '}
          <Link to="/contact" className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300">
            contact us
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
