import { useId } from 'react'
import { Link } from 'react-router-dom'
import kickupsHeroBg from '../assets/kickups-hero-bg.png'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'
import iphone17ProMaxGoldCase from '../assets/iphone-17-pro-max-gold-case.png'
import { GRAND_PRIZE_BUNDLE } from '../competitionData'
import { useEntryFlow } from '../entry/entryContext'
import { BundleOfferCopy, GlowingFootballIcon, TicketBundlePrice } from '../components/siteChrome'

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

        <div className="ss-hero-inner mx-auto max-w-5xl px-4 pt-5 pb-14 sm:px-6 sm:pt-11 sm:pb-10 lg:pt-12 lg:pb-20">
          <article className="ss-hero-merged-panel grid gap-6 px-0 py-4 sm:py-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-7 lg:p-6">
            <div className="ss-hero-copy-column relative order-2 flex w-full min-h-0 flex-col text-left lg:order-1 lg:h-full lg:min-h-0">
              <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 sm:text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                Live promotion
              </p>
              <div className="hidden flex-wrap items-end gap-3 sm:flex sm:gap-4">
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
                Ronaldo Legacy Bundle — pay online or enter by post, then answer{' '}
                <span className="ss-pen-highlight whitespace-nowrap text-emerald-100">3 hard skill questions</span> for the
                full kit draw.
              </p>

              <TicketBundlePrice compact className="mt-6" />
              <p className="ss-hero-helper-copy mt-4 max-w-xl text-sm leading-relaxed text-stone-400 sm:text-base">
                Use <strong className="text-stone-300">Competitions</strong> in the menu for details, or open entry here.
                Paid bundles and free postal entry are in the same panel.
              </p>
              <div className="ss-hero-cta-row mt-5 flex max-w-xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 lg:mt-5 lg:border-t lg:border-white/10 lg:pt-4">
                <Link
                  to="/competitions"
                  className="ss-btn-enter inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-10 py-3 text-center text-base font-bold uppercase tracking-[0.12em] text-emerald-950 sm:min-h-[3.25rem] sm:px-12 sm:text-lg"
                >
                  Enter now
                </Link>
                <a
                  href="#prizes"
                  className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border-2 border-emerald-400/40 bg-emerald-950/20 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-950/40 sm:min-h-[3.25rem]"
                >
                  Prize lineup
                </a>
                <Link
                  to="/archive/ronaldo-shirt-giveaway"
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 underline decoration-stone-600 underline-offset-4 hover:text-stone-300 sm:py-2.5"
                >
                  Free shirt giveaway
                </Link>
              </div>
              <div className="ss-legacy-details-card mt-3 max-w-xl rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-stone-400 sm:mt-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-100">
                  Ronaldo Legacy Bundle details
                </p>
                <p className="mt-2">
                  Estimated total stack value is <strong className="text-stone-200">over £3,000</strong>, with collector
                  legacy value from the signed Ronaldo shirt and museum signed football.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs leading-snug text-stone-500 sm:text-sm">
                  <li>
                    <strong className="text-stone-300">iPhone 17 Pro Max:</strong> unlocked, 6.9-inch display, 512GB model,
                    estimated retail value <strong className="text-stone-300">£1,399</strong>.
                  </li>
                  <li>
                    <strong className="text-stone-300">Colour substitution:</strong> if the shown colour is unavailable, an
                    equivalent colour such as black or another available finish may be supplied.
                  </li>
                  <li>
                    <strong className="text-stone-300">24K gold case:</strong> premium gold-style case for the iPhone 17 Pro
                    Max, included as part of the prize stack.
                  </li>
                  <li>
                    <strong className="text-stone-300">Museum signed football:</strong> Cristiano Ronaldo museum-style signed
                    football, presented as a collector item with the bundle.
                  </li>
                </ul>
                <p className="mt-3 text-[11px] leading-snug text-stone-500">
                  * Images are illustrative. Prize details are subject to the competition terms and availability.
                </p>
              </div>
            </div>


            <div id="prizes" className="ss-hero-prize-column scroll-mt-24 order-1 flex min-h-0 w-full flex-col lg:order-2">
              <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-1 flex-col gap-0">
                <div className="ss-prize-studio p-2 sm:p-3">
                  <div className="relative z-[1] grid gap-2">
                    <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
                      <div className="ss-prize-studio-photo">
                        <img
                          src={legacyBundlePoster}
                          alt="Ronaldo Legacy Bundle: signed shirt, signed ball and gold phone case in a luxury poster layout."
                          width={1024}
                          height={576}
                          loading="eager"
                          decoding="async"
                          className="h-auto w-full"
                        />
                      </div>
                    </div>
                    <div className="ss-prize-studio-subgrid mx-auto grid w-full max-w-[20rem] grid-cols-2 gap-2 sm:gap-0">
                      <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                        <div className="ss-prize-studio-photo mx-auto max-w-[7.5rem] rounded-md">
                          <img
                            src={iphone17ProMax}
                            alt="iPhone 17 Pro Max prize photo."
                            width={768}
                            height={1024}
                            loading="lazy"
                            decoding="async"
                            className="aspect-[3/4] h-auto w-full scale-125 object-cover object-center"
                          />
                        </div>
                        <p className="ss-phone-prize-glow mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em]">
                          Phone prize
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-stone-100">iPhone 17 Pro Max</p>
                      </div>
                      <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                        <div className="ss-prize-studio-photo mx-auto max-w-[7.5rem] rounded-md">
                          <img
                            src={iphone17ProMaxGoldCase}
                            alt="24K gold case for iPhone 17 Pro Max prize photo."
                            width={960}
                            height={1024}
                            loading="lazy"
                            decoding="async"
                            className="aspect-[3/4] h-auto w-full object-cover object-center"
                          />
                        </div>
                        <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em] text-amber-300/90">
                          Case prize
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-stone-100">24K gold case</p>
                      </div>
                    </div>
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
                    Enter Bundle Draw
                  </button>
                  <p className="mt-2.5 text-center text-[11px] leading-snug text-stone-500 sm:text-xs">
                    Buy tickets online or enter by post — same prize. Three Ronaldo questions. Full kit: phone, shirt,
                    ball, case.
                  </p>
                </div>
                <TicketBundlePrice className="mt-4" />
              </div>
            </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
