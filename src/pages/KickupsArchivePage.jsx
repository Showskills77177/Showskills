import { Link } from 'react-router-dom'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { useEntryFlow } from '../entry/entryContext'
import { ShirtGiveawayCtaButton } from '../components/siteChrome'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'

/**
 * Archived free shirt giveaway — not promoted on the homepage.
 * Kept so the flow and copy can be restored without rebuilding pages.
 */
export default function KickupsArchivePage() {
  const { openEntry } = useEntryFlow()

  return (
    <main className="m-0 p-0">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-stone-500">
          <Link to="/" className="font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300">
            ← Home
          </Link>
          {' · '}
          <Link to="/competitions" className="font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300">
            Competitions
          </Link>
        </p>
        <p className="mt-4 max-w-2xl rounded-lg border border-amber-900/35 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90">
          This page is <strong className="text-amber-50">not linked from the homepage</strong>. The free Ronaldo shirt
          giveaway is preserved here so you can bring it back when needed.
        </p>
      </div>

      <section className="ss-rules-pitch-guide border-t border-lime-400/20">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <header className="max-w-3xl text-left">
            <p className="font-display text-sm font-bold uppercase tracking-[0.35em] text-lime-300/90 drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]">
              Free giveaway · Not the paid bundle
            </p>
            <h1 className="ss-rules-title font-display mt-2 text-[clamp(2.75rem,9vw,4.25rem)] uppercase leading-[0.95] tracking-[0.02em] text-lime-300">
              Ronaldo shirt giveaway
            </h1>
            <p className="mt-4 text-base font-medium leading-relaxed text-sky-100/85 sm:text-lg">
              Separate from the paid bundle: answer one simple Ronaldo qualification question for free. Winner gets the
              shirt in the panel below — not the phone, ball, or Legacy Bundle.
            </p>
          </header>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-start lg:gap-14">
            <div className="flex min-w-0 flex-col gap-8">
              <div className="flex flex-col gap-4 rounded-2xl border border-lime-400/30 bg-gradient-to-br from-emerald-950/40 to-black/30 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                <div className="ss-kickups-prize-thumb mx-auto shrink-0 sm:mx-0">
                  <img
                    src={KICKUPS_GIVEAWAY_IMAGE}
                    alt="Prize: signed Cristiano Ronaldo Manchester United number 7 shirt."
                    width={771}
                    height={1024}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full max-w-none"
                  />
                </div>
                <div className="min-w-0 text-center sm:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-lime-300/95">What you win</p>
                  <p className="mt-2 text-sm font-semibold leading-snug text-white sm:text-base">
                    Signed Ronaldo United shirt
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/75">
                    Shirt only — the full-kit bundle is a different competition on this site.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-lime-300/80">How to qualify</p>
                <ol className="mt-4 grid list-none gap-3">
                  {[
                    ['1', 'Answer the question', SHIRT_GIVEAWAY_QUESTION],
                    ['2', 'Correct answer qualifies', 'Ronaldo R9 or Cristiano Ronaldo qualifies you for the giveaway draw.'],
                    ['3', 'Free entry', 'No payment and no video upload required.'],
                    ['4', 'We review entries', 'Manual check before a winner is confirmed.'],
                  ].map(([num, title, desc]) => (
                    <li
                      key={title}
                      className="ss-rules-step flex gap-3 rounded-xl border-2 border-lime-400/30 bg-gradient-to-br from-emerald-950/80 via-[#052e24]/70 to-black/40 p-3.5 shadow-[0_3px_0_0_rgba(0,0,0,0.3)] transition hover:border-lime-300/45 sm:gap-4 sm:p-4"
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black bg-lime-400 text-base font-black leading-none text-black shadow-[2px_2px_0_0_rgba(0,0,0,0.85)] sm:h-10 sm:w-10 sm:text-lg"
                        aria-hidden
                      >
                        {num}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-base tracking-tight text-white sm:text-lg">{title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-emerald-100/70">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-4 flex w-full justify-center sm:mt-5">
                <ShirtGiveawayCtaButton onClick={() => openEntry('kickups')} />
              </div>
            </div>

            <aside className="mx-auto w-full max-w-[360px] rounded-2xl border border-lime-400/25 bg-black/25 p-5 lg:mx-0 lg:max-w-none lg:sticky lg:top-24 lg:self-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-lime-300/90">Question</p>
              <p className="mt-3 text-lg font-semibold leading-snug text-white">{SHIRT_GIVEAWAY_QUESTION}</p>
              <p className="mt-3 text-sm leading-relaxed text-lime-200/70">
                Type the answer in the giveaway form. Correct entries go into the free shirt draw.
              </p>
              <button
                type="button"
                className="mt-5 w-full rounded-xl border border-lime-400/35 px-4 py-3 text-sm font-bold text-lime-100 hover:bg-lime-950/30"
                onClick={() => openEntry('kickups')}
              >
                Open free giveaway form
              </button>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
