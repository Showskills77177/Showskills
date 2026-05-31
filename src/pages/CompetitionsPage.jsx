import { Link } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { useEntryFlow } from '../entry/entryContext'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'
import { usePublishedCompetitions } from '../hooks/usePublicCompetition'
import { CompetitionPublicCard } from '../components/CompetitionPublicCard'

export default function CompetitionsPage() {
  const { openEntry } = useEntryFlow()
  const { competitions, loading } = usePublishedCompetitions()

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">Competitions</h1>
        <p className="mt-4 max-w-2xl text-base text-stone-400 sm:text-lg">
          Live prize draws and giveaways on ShowSkills Rewards. Published competitions from admin appear here
          automatically.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-stone-500">
          <Link to="/faq" className="text-teal-400/90 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-300">
            Common questions (FAQ)
          </Link>
        </p>

        {loading ? <p className="mt-10 text-sm text-stone-500">Loading competitions…</p> : null}

        <ul className="mt-12 grid list-none gap-8 lg:grid-cols-2 lg:items-stretch">
          {competitions.map((c) => (
            <li key={c.slug}>
              <CompetitionPublicCard
                competition={c}
                onEnter={() => openEntry('paid', { competitionSlug: c.slug })}
              />
            </li>
          ))}

          <li className="flex flex-col overflow-hidden rounded-2xl border border-lime-400/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="bg-gradient-to-b from-lime-950/35 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7">
              <div className="mx-auto flex max-w-sm flex-col items-center rounded-xl border border-lime-400/20 bg-black/25 p-4 text-center">
                <div className="w-full max-w-[14rem] overflow-hidden rounded-lg border border-lime-400/20 bg-black">
                  <img
                    src={KICKUPS_GIVEAWAY_IMAGE}
                    alt="Prize: signed Cristiano Ronaldo Manchester United number 7 shirt."
                    width={771}
                    height={1024}
                    className="h-auto w-full"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.26em] text-lime-300/90">Free giveaway</p>
                <p className="mt-1 text-base font-semibold text-white">Ronaldo signed shirt</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/90">Free · Shirt prize</p>
              <h2 className="mt-2 font-display text-2xl text-white">Ronaldo Shirt Giveaway</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">
                No payment. No video upload. Answer one qualification question and, if correct, you enter the random draw
                for the signed Ronaldo shirt only.
              </p>
              <div className="mt-4 rounded-xl border border-lime-400/20 bg-lime-950/15 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-lime-300/80">Question</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-stone-100">{SHIRT_GIVEAWAY_QUESTION}</p>
              </div>
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => openEntry('kickups')}
                  className="w-full rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 py-3.5 text-sm font-bold text-emerald-950 shadow-lg transition hover:brightness-110"
                >
                  Enter free giveaway
                </button>
                <Link
                  to="/archive/ronaldo-shirt-giveaway"
                  className="text-center text-xs font-medium text-stone-500 underline decoration-stone-600 underline-offset-4 hover:text-stone-300"
                >
                  View giveaway details
                </Link>
              </div>
            </div>
          </li>
        </ul>

        {!loading && competitions.length === 0 ? (
          <p className="mt-8 text-sm text-stone-500">No published prize draws yet — check back soon.</p>
        ) : null}
      </div>
    </main>
  )
}
