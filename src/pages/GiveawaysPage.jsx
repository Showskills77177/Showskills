import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { useEntryFlow } from '../entry/entryContext'
import { usePublishedGiveaways } from '../hooks/usePublicGiveaway'
import { GiveawayPublicCard } from '../components/GiveawayPublicCard'
import { LegacyShirtGiveawayCard } from '../components/LegacyShirtGiveawayCard'
import { useSeoMeta } from '../hooks/useSeoMeta'
import { JsonLd } from '../components/JsonLd'
import { buildFaqPageJsonLd } from '../../shared/seoSchema.mjs'
import { SHOWSKILLS_LOTTERY_FAQ_QUESTION, SHOWSKILLS_LOTTERY_FAQ_ANSWER } from '../../shared/sitePositioning.mjs'

const GIVEAWAYS_FAQ = [
  {
    question: SHOWSKILLS_LOTTERY_FAQ_QUESTION,
    answer: SHOWSKILLS_LOTTERY_FAQ_ANSWER,
  },
]

export default function GiveawaysPage() {
  const { openEntry } = useEntryFlow()
  const { giveaways, loading } = usePublishedGiveaways()

  useSeoMeta({
    title: 'Free Giveaways | ShowSkills',
    description: 'Free giveaways on ShowSkills — no ticket purchase. Answer skill questions to qualify. No lottery.',
    path: '/giveaways',
  })

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <JsonLd data={buildFaqPageJsonLd(GIVEAWAYS_FAQ)} />
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Giveaways</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">
          Free giveaways on ShowSkills — no ticket purchase. Enter online or by post, answer the skill
          questions, and qualify for a free giveaway.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-stone-500">
          Paid main prize draws are on{' '}
          <Link to="/competitions" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            Competitions
          </Link>
          .{' '}
          <Link to="/faq" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            FAQ
          </Link>
        </p>

        {loading ? <p className="mt-10 text-sm text-stone-500">Loading giveaways…</p> : null}

        <ul className="mt-12 grid list-none gap-8 lg:grid-cols-2 lg:items-stretch">
          <li>
            <LegacyShirtGiveawayCard onEnter={() => openEntry('kickups')} />
          </li>

          {giveaways.map((g) => (
            <li key={g.slug}>
              <GiveawayPublicCard
                giveaway={g}
                onEnter={() => openEntry('paid', { competitionSlug: g.slug })}
              />
            </li>
          ))}
        </ul>

        {!loading && giveaways.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            More admin giveaways will appear here when published — the Ronaldo shirt giveaway above is always live.
          </p>
        ) : null}

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#071512]/70 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300/80">
            {SHOWSKILLS_LOTTERY_FAQ_QUESTION}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">{SHOWSKILLS_LOTTERY_FAQ_ANSWER}</p>
        </div>
      </div>
    </main>
  )
}
