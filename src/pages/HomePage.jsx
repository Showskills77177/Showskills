import { useId } from 'react'
import { Link } from 'react-router-dom'
import prizeBundle from '../assets/prize-bundle-hero.png'
import kickupsHeroBg from '../assets/kickups-hero-bg.png'
import rulesKickupsGuide from '../assets/rules-kickups-guide.png'
import { GRAND_PRIZE_BUNDLE } from '../competitionData'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { useEntryFlow } from '../entry/entryContext'
import {
  BundleOfferCopy,
  GlowingFootballIcon,
  ShirtGiveawayCtaButton,
  TicketBundlePrice,
} from '../components/siteChrome'

export default function HomePage() {
  const { openEntry } = useEntryFlow()
  const legacyBundleCtaArrowUid = useId().replace(/:/g, '')
  const legacyCtaGradId = `ss-legacy-cta-grad-${legacyBundleCtaArrowUid}`

  return (
    <main className="m-0 p-0">
      <section className="ss-hero-surface relative -mt-px overflow-x-clip overflow-y-visible border-b border-emerald-900/20 pt-0 pb-6 sm:pb-10">
        <div className="pointer-events-none absolute inset-0 z-[1] min-h-[22rem] overflow-hidden bg-[#071512] sm:min-h-0" aria-hidden>
          <img
            src={kickupsHeroBg}
            alt=""
            width={800}
            height={1200}
            decoding="async"
            fetchPriority="high"
            className="ss-hero-photo-bg-img"
          />
          <div className="ss-hero-photo-pitch-tint absolute inset-0" />
          <div className="ss-hero-photo-scrim absolute inset-0" />
        </div>

        <div className="ss-hero-inner mx-auto grid max-w-5xl gap-10 px-4 pt-9 pb-14 sm:px-6 sm:pt-11 sm:pb-10 lg:grid-cols-2 lg:items-stretch lg:gap-10 lg:pt-12 lg:pb-20">
          <div className="relative flex w-full min-h-0 flex-col lg:h-full lg:min-h-0">
            <div className="ss-hero-copy-panel flex w-full min-h-0 flex-col p-5 text-left sm:p-6 lg:min-h-0 lg:flex-1">
              <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 sm:text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                Live promotions
              </p>
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                <h1 className="ss-hero-brand font-display text-[clamp(2.75rem,10vw,5.25rem)] leading-[0.92] tracking-tight sm:text-[clamp(3.25rem,11vw,5.75rem)]">
                  ShowSkills Rewards
                </h1>
                <div className="flex items-end gap-1.5 sm:gap-2">
                  <GlowingFootballIcon stagger={0} className="mb-1 shrink-0 sm:mb-1.5" />
                  <GlowingFootballIcon stagger={1} className="mb-1 shrink-0 sm:mb-1.5" />
                  <GlowingFootballIcon stagger={2} className="mb-1 shrink-0 sm:mb-1.5" />
                </div>
              </div>
              <p className="mt-5 max-w-xl text-[clamp(1.35rem,4vw,2.1rem)] font-bold leading-snug tracking-tight text-white">
                Two different prizes. Two ways to enter — Legacy Bundle (pay or post) vs 35 Kick-Ups shirt giveaway.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-xl border border-teal-500/30 bg-black/25 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-300/90">A · Legacy Bundle draw</p>
                  <p className="mt-2 text-sm font-semibold text-stone-100">Paid bundles or free post</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Buy tickets online <span className="text-stone-400">or</span> enter by post — same prize. Three Ronaldo
                    questions. Full kit: phone, shirt, ball, case.
                  </p>
                  <button
                    type="button"
                    onClick={() => openEntry('paid')}
                    className="mt-3 w-full rounded-lg bg-teal-600/90 py-2 text-xs font-bold text-white hover:bg-teal-500"
                  >
                    Open entry
                  </button>
                </div>
                <div className="rounded-xl border border-teal-500/30 bg-black/25 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-300/90">B · Free video</p>
                  <p className="mt-2 text-sm font-semibold text-stone-100">35 Kick-Ups</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Upload one clip. <span className="text-stone-400">Shirt only</span> — not the bundle.
                  </p>
                  <button
                    type="button"
                    onClick={() => openEntry('kickups')}
                    className="mt-3 w-full rounded-lg bg-teal-600/90 py-2 text-xs font-bold text-white hover:bg-teal-500"
                  >
                    Open entry
                  </button>
                </div>
              </div>

              <TicketBundlePrice compact className="mt-6" />
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-400 sm:text-base">
                Use <strong className="text-stone-300">Competitions</strong> in the menu for a side-by-side view, or jump in
                from the cards. Legacy Bundle entry covers paid bundles and postal in one panel; kick-ups stays separate.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:mt-auto lg:border-t lg:border-white/10 lg:pt-6">
                <Link
                  to="/competitions"
                  className="ss-btn-enter inline-flex min-h-[3.25rem] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-10 py-3.5 text-center text-base font-bold uppercase tracking-[0.12em] text-emerald-950 sm:min-h-[3.5rem] sm:px-12 sm:text-lg"
                >
                  Enter now
                </Link>
                <a
                  href="#prizes"
                  className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-400/40 bg-emerald-950/20 px-6 py-3 text-sm font-bold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-950/40"
                >
                  Prize lineup
                </a>
                <a
                  href="#rules"
                  className="inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-teal-200/80 underline decoration-teal-500/50 underline-offset-4 hover:text-teal-100"
                >
                  Kick-ups rules
                </a>
              </div>
            </div>

            <div
              className="pointer-events-none absolute bottom-1 right-0 sm:bottom-auto sm:top-[32%] sm:translate-y-[-50%] lg:top-[34%]"
              aria-hidden
            >
              <div className="ss-bundle-arrow ss-bundle-arrow--down h-11 w-11 sm:h-12 sm:w-12 lg:hidden">
                <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" aria-hidden>
                  <defs>
                    <linearGradient id="ss-bundle-cue-grad-d" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#99f6e4" />
                      <stop offset="0.55" stopColor="#2dd4bf" />
                      <stop offset="1" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <circle
                    className="ss-bundle-arrow__halo"
                    cx="12"
                    cy="12"
                    r="10.5"
                    fill="none"
                    stroke="url(#ss-bundle-cue-grad-d)"
                    strokeWidth="1.15"
                    opacity="0.5"
                  />
                  <path
                    stroke="url(#ss-bundle-cue-grad-d)"
                    strokeWidth="2.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15M5.5 12 12 18.5 18.5 12"
                  />
                </svg>
              </div>
              <div className="ss-bundle-arrow ss-bundle-arrow--right hidden h-11 w-11 sm:h-12 sm:w-12 lg:flex">
                <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" aria-hidden>
                  <defs>
                    <linearGradient id="ss-bundle-cue-grad-r" x1="4" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#99f6e4" />
                      <stop offset="0.5" stopColor="#2dd4bf" />
                      <stop offset="1" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <circle
                    className="ss-bundle-arrow__halo"
                    cx="12"
                    cy="12"
                    r="10.5"
                    fill="none"
                    stroke="url(#ss-bundle-cue-grad-r)"
                    strokeWidth="1.15"
                    opacity="0.5"
                  />
                  <path
                    stroke="url(#ss-bundle-cue-grad-r)"
                    strokeWidth="2.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12H19M13 5.5l6.5 6.5-6.5 6.5"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div id="prizes" className="scroll-mt-24 flex min-h-0 w-full flex-col">
            <article className="ss-prize-panel flex h-full min-h-0 flex-col p-5 sm:p-6">
              <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-teal-500/30 bg-teal-950/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-200/90 sm:text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" aria-hidden />
                Headline prize (paid / postal draw)
              </p>
              <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">{GRAND_PRIZE_BUNDLE.title}</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-400">
                This stack is only for the <strong className="text-stone-300">Ronaldo Legacy Bundle</strong> competition
                (paid tickets or free postal entry with correct skill answers). It is{' '}
                <strong className="text-stone-300">not</strong> the prize for the 35 Kick-Ups video giveaway.
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-500">
                iPhone Pro Max, signed shirt (United era), signed ball with COA, premium gold case — illustrative; we may
                substitute similar items.
              </p>

              <div className="mt-6 flex flex-1 flex-col gap-0">
                <div className="mx-auto w-full max-w-[16.5rem] pb-5 sm:max-w-[18.5rem] sm:pb-6">
                  <div className="ss-bundle-frame">
                    <img
                      src={prizeBundle}
                      alt="Ronaldo Legacy Bundle: signed shirt, signed ball in display case, iPhone and 24K gold case on a dark studio set (illustrative)."
                      width={682}
                      height={1024}
                    />
                  </div>
                </div>
                <div className="mt-6 border-t border-white/10 pt-5">
                  <BundleOfferCopy />
                </div>
                <div className="relative mt-6">
                  <div
                    className="pointer-events-none mb-0.5 flex justify-center sm:mb-1"
                    aria-hidden
                  >
                    <div className="ss-bundle-arrow ss-bundle-arrow--down h-8 w-8 sm:h-9 sm:w-9">
                      <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" aria-hidden>
                        <defs>
                          <linearGradient
                            id={legacyCtaGradId}
                            x1="4"
                            y1="4"
                            x2="20"
                            y2="20"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop stopColor="#99f6e4" />
                            <stop offset="0.55" stopColor="#2dd4bf" />
                            <stop offset="1" stopColor="#34d399" />
                          </linearGradient>
                        </defs>
                        <circle
                          className="ss-bundle-arrow__halo"
                          cx="12"
                          cy="12"
                          r="10.5"
                          fill="none"
                          stroke={`url(#${legacyCtaGradId})`}
                          strokeWidth="1.15"
                          opacity="0.5"
                        />
                        <path
                          stroke={`url(#${legacyCtaGradId})`}
                          strokeWidth="2.35"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15M5.5 12 12 18.5 18.5 12"
                        />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEntry('paid')}
                    className="relative z-[1] w-full rounded-xl border border-teal-500/35 bg-teal-950/30 py-3 text-sm font-bold text-teal-100 transition hover:border-teal-400/50 hover:bg-teal-950/50"
                  >
                    Enter bundle draw
                  </button>
                </div>
                <TicketBundlePrice className="mt-4" />
                <p className="mt-4 text-center text-xs text-zinc-500">
                  Free postal entry for the same draw is available inside{' '}
                  <button
                    type="button"
                    className="font-medium text-zinc-400 underline underline-offset-2 hover:text-zinc-300"
                    onClick={() => openEntry('paid')}
                  >
                    Enter bundle draw
                  </button>
                  .
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="rules" className="ss-rules-pitch-guide border-t border-lime-400/20">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <header className="max-w-3xl text-left">
            <p className="font-display text-sm font-bold uppercase tracking-[0.35em] text-lime-300/90 drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]">
              Free giveaway · Not the paid bundle
            </p>
            <h2 className="ss-rules-title font-display mt-2 text-[clamp(2.75rem,9vw,4.25rem)] uppercase leading-[0.95] tracking-[0.02em] text-lime-300">
              35 Kick-Ups challenge
            </h2>
            <p className="mt-4 text-base font-medium leading-relaxed text-sky-100/85 sm:text-lg">
              Separate from the paid bundle: film your run for free. Winner gets the shirt in the panel below — not the
              phone, ball, or Legacy Bundle.
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
                    ['1', '35 kick-ups', 'One continuous take — count every touch.'],
                    ['2', 'Face visible', 'We need to see it’s you the whole time.'],
                    ['3', 'No edits or cuts', 'Single unbroken recording.'],
                    ['4', 'We review clips', 'Manual check before a winner is confirmed.'],
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

            <figure className="mx-auto w-full max-w-[360px] lg:mx-0 lg:max-w-none lg:sticky lg:top-24 lg:self-start">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-lime-300/90 lg:text-left">
                Film it like this
              </p>
              <div className="ss-rules-guide-frame">
                <img
                  src={rulesKickupsGuide}
                  alt="Reference: count-off style clip — recording frame and 35 kick-ups on screen."
                  width={682}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full max-w-none"
                />
              </div>
              <figcaption className="mt-3 text-pretty text-center text-xs leading-relaxed text-lime-200/65 lg:text-left">
                Match this vibe in your video, then{' '}
                <button
                  type="button"
                  className="font-medium text-lime-300/90 underline underline-offset-2 hover:text-lime-200"
                  onClick={() => openEntry('kickups')}
                >
                  submit your entry
                </button>{' '}
                or open{' '}
                <Link to="/competitions" className="font-medium text-lime-300/90 underline underline-offset-2">
                  Competitions
                </Link>
                .
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
    </main>
  )
}
