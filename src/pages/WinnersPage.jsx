import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { HomeWinnersPanel } from '../components/HomeWinnersPanel'
import { usePublicWinners } from '../hooks/usePublicWinners'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { JsonLd } from '../components/JsonLd'
import { buildFaqPageJsonLd } from '../../shared/seoSchema.mjs'
import {
  SHOWSKILLS_POSITIONING_STATEMENT,
  SHOWSKILLS_LOTTERY_FAQ_QUESTION,
  SHOWSKILLS_LOTTERY_FAQ_ANSWER,
} from '../../shared/sitePositioning.mjs'

const WINNERS_FAQ = [
  {
    question: SHOWSKILLS_LOTTERY_FAQ_QUESTION,
    answer: SHOWSKILLS_LOTTERY_FAQ_ANSWER,
  },
  {
    question: 'How do you prove these winners are real?',
    answer:
      'We publish winner names, prizes, and dates as they are confirmed. Some winners choose to share a photo with their prize. We never publish private contact details.',
  },
]

export default function WinnersPage() {
  const { title, subtitle, winners, loading } = usePublicWinners()

  useSeoMeta({
    title: 'ShowSkills Winners — Real Free Quiz & Giveaway Winners',
    description:
      'See real winners from ShowSkills free football skill quizzes and giveaways. No tickets, no lottery — just correct answers.',
    path: '/winners',
  })

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <JsonLd data={buildFaqPageJsonLd(WINNERS_FAQ)} />
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Winners</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">{SHOWSKILLS_POSITIONING_STATEMENT}</p>
        <p className="mt-3 max-w-2xl text-sm text-stone-500">
          Proof that real people win. Browse our{' '}
          <Link to="/quizzes" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            free skill quizzes
          </Link>{' '}
          and see who has already won below.
        </p>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#071512]/70 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/80">
            {SHOWSKILLS_LOTTERY_FAQ_QUESTION}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">{SHOWSKILLS_LOTTERY_FAQ_ANSWER}</p>
        </div>

        {loading ? <p className="mt-10 text-sm text-stone-500">Loading winners…</p> : null}
        {!loading ? (
          <div className="mt-10">
            <HomeWinnersPanel title={title || 'Recent winners'} subtitle={subtitle} winners={winners} />
          </div>
        ) : null}
        {!loading && winners.length === 0 ? (
          <p className="mt-6 text-sm text-stone-500">
            No winners have been published yet — check back soon, or{' '}
            <Link to="/quizzes" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
              play a free quiz
            </Link>{' '}
            to be the next one.
          </p>
        ) : null}
      </div>
    </main>
  )
}
