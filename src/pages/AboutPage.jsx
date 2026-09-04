import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { JsonLd } from '../components/JsonLd'
import { buildOrganizationJsonLd } from '../../shared/seoSchema.mjs'
import { SHOWSKILLS_POSITIONING_STATEMENT } from '../../shared/sitePositioning.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'

export default function AboutPage() {
  useSeoMeta({
    title: 'About ShowSkills — Free Football Skill Quizzes',
    description:
      'ShowSkills runs free UK football skill quizzes. No tickets, no lottery. Learn who we are and how our free giveaways work.',
    path: '/about',
  })

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <JsonLd data={buildOrganizationJsonLd()} />
      <div className="relative z-[1] mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">About ShowSkills</h1>
        <p className="mt-4 text-base leading-relaxed text-stone-400 sm:text-lg">{SHOWSKILLS_POSITIONING_STATEMENT}</p>

        <div className="mt-8 space-y-5 text-sm leading-relaxed text-stone-400 sm:text-[15px]">
          <p>
            ShowSkills is run from the United Kingdom. Our free skill quizzes ask genuine, difficult football
            questions — there is no ticket price, no paid entry, and no random lottery draw involved in playing a
            quiz. Answer correctly and you can qualify for a free giveaway.
          </p>
          <p>
            We also run a separate, clearly-labelled paid prize competition (the Signed Legacy Bundle) with its own
            terms, ticket bundles, and a legally-required free postal entry route. That paid competition is a
            different product from our free skill quizzes — see our{' '}
            <Link to="/terms" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
              Terms &amp; Privacy
            </Link>{' '}
            for full details on both.
          </p>
          <p>
            <strong>Not affiliated with FIFA, any football club, or any player.</strong> Any imagery used for
            illustration is not official licensed merchandise unless stated otherwise.
          </p>
          <p>
            Questions? Contact us at{' '}
            <a
              href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
              className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300"
            >
              {SHOWSKILLS_CONTACT_EMAIL}
            </a>
            , or visit our{' '}
            <Link to="/faq" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
              FAQ
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
