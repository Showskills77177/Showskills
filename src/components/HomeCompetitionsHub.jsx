import { Link } from 'react-router-dom'
import { Gift, Ticket } from 'lucide-react'
import { CompetitionPublicCard } from './CompetitionPublicCard'
import { LegacyShirtGiveawayCard } from './LegacyShirtGiveawayCard'
import { GiveawayPublicCard } from './GiveawayPublicCard'
import { usePublishedCompetitions } from '../hooks/usePublicCompetition'
import { usePublishedGiveaways } from '../hooks/usePublicGiveaway'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

function SectionLabel({ icon: Icon, tone, children }) {
  const tones = {
    paid: 'border-emerald-400/35 bg-emerald-950/45 text-emerald-200',
    free: 'border-lime-400/35 bg-lime-950/40 text-lime-200',
  }
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      {children}
    </p>
  )
}

function HubSeparator({ label }) {
  return (
    <div className="ss-home-competitions-divider relative my-12 sm:my-16" aria-hidden={!label}>
      <div className="absolute inset-0 flex items-center">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
      {label ? (
        <div className="relative flex justify-center">
          <span className="rounded-full border border-white/10 bg-[#071512] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Homepage competitions hub — paid main draws above free giveaways.
 * @param {{ block?: object, onEnterPaid: (slug: string) => void, onEnterGiveaway: () => void }} props
 */
export function HomeCompetitionsHub({ block = {}, onEnterPaid, onEnterGiveaway }) {
  const { competitions, loading: loadingPaid } = usePublishedCompetitions()
  const { giveaways, loading: loadingFree } = usePublishedGiveaways()
  const loading = loadingPaid || loadingFree

  const legacy =
    competitions.find((c) => c.slug === DRAW_COMPETITION_SLUG) ||
    competitions[0] ||
    null
  const otherPaid = competitions.filter((c) => c.slug !== legacy?.slug)

  const paidTitle = block.paidTitle || 'Main paid competitions'
  const paidSubtitle =
    block.paidSubtitle ||
    'Ticket bundles and skill questions — qualify for the full Legacy Bundle draw and other main prize competitions.'
  const freeTitle = block.freeTitle || 'Free giveaways'
  const freeSubtitle =
    block.freeSubtitle ||
    'No payment required — enter online for the shirt draw and other free promotions.'

  return (
    <section
      id="home-competitions"
      className="ss-home-competitions-hub relative scroll-mt-24 border-t border-emerald-900/25 bg-gradient-to-b from-[#061410] via-[#071512] to-[#050f0d]"
      aria-labelledby="home-competitions-heading"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
        <header className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400/90">Choose your route</p>
          <h2
            id="home-competitions-heading"
            className="mt-2 font-display text-[clamp(1.85rem,5vw,2.75rem)] uppercase leading-tight tracking-[0.04em] text-white"
          >
            {block.title || 'Competitions'}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-stone-400 sm:text-lg">
            {block.subtitle ||
              'Two ways to play on ShowSkills Rewards — paid prize draws with ticket bundles, and separate free giveaways.'}
          </p>
        </header>

        {/* —— Paid —— */}
        <div className="mt-10 sm:mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel icon={Ticket} tone="paid">
                Paid entry
              </SectionLabel>
              <h3 className="mt-3 font-display text-xl uppercase tracking-[0.06em] text-white sm:text-2xl">
                {paidTitle}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500 sm:text-base">{paidSubtitle}</p>
            </div>
            <Link
              to="/competitions#paid-competitions-heading"
              className="shrink-0 text-sm font-semibold text-teal-400/90 underline decoration-teal-700/50 underline-offset-4 hover:text-teal-300"
            >
              View all paid draws
            </Link>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-stone-600">Loading competitions…</p>
          ) : (
            <ul className="mt-8 grid list-none gap-8 lg:grid-cols-2 lg:items-stretch">
              {legacy ? (
                <li className={otherPaid.length ? '' : 'lg:col-span-2 lg:max-w-3xl lg:justify-self-center lg:w-full'}>
                  <CompetitionPublicCard
                    competition={legacy}
                    onEnter={() => onEnterPaid(legacy.slug)}
                    layout={otherPaid.length ? 'card' : 'page'}
                  />
                </li>
              ) : (
                <li className="rounded-2xl border border-dashed border-white/10 bg-stone-950/40 px-6 py-10 text-center text-sm text-stone-500 lg:col-span-2">
                  No paid competitions published yet.
                </li>
              )}
              {otherPaid.map((c) => (
                <li key={c.slug}>
                  <CompetitionPublicCard competition={c} onEnter={() => onEnterPaid(c.slug)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <HubSeparator label={block.separatorLabel || 'Then explore free'} />

        {/* —— Free —— */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel icon={Gift} tone="free">
                Free entry
              </SectionLabel>
              <h3 className="mt-3 font-display text-xl uppercase tracking-[0.06em] text-lime-100 sm:text-2xl">
                {freeTitle}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500 sm:text-base">{freeSubtitle}</p>
            </div>
            <Link
              to="/competitions#free-giveaways-heading"
              className="shrink-0 text-sm font-semibold text-lime-400/90 underline decoration-lime-700/50 underline-offset-4 hover:text-lime-300"
            >
              All free giveaways
            </Link>
          </div>

          {loading ? null : (
            <ul className="mt-8 grid list-none gap-8 lg:grid-cols-2 lg:items-stretch">
              <li className="lg:col-span-2">
                <LegacyShirtGiveawayCard onEnter={onEnterGiveaway} />
              </li>
              {giveaways.map((g) => (
                <li key={g.slug}>
                  <GiveawayPublicCard giveaway={g} onEnter={() => onEnterPaid(g.slug)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
