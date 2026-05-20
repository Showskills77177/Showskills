import { Link } from 'react-router-dom'
import kickupsHeroBg from '../assets/kickups-hero-bg.png'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'
import iphone17ProMaxGoldCase from '../assets/iphone-17-pro-max-gold-case.png'
import { BUNDLE_OFFER_ITEMS } from '../competitionData'
import { useEntryFlow } from '../entry/entryContext'
import { GlowingFootballIcon, TicketBundlePrice } from '../components/siteChrome'

const LEGACY_BUNDLE_SPECS = [
  {
    label: 'iPhone 17 Pro Max',
    body: 'Unlocked, 6.9-inch display, 512GB model. Estimated retail value £1,399.',
  },
  {
    label: 'Colour substitution',
    body: 'If the shown colour is unavailable, an equivalent colour such as black or another available finish may be supplied.',
  },
  {
    label: '24K gold case',
    body: 'Premium gold-style case for the iPhone 17 Pro Max, included as part of the prize stack.',
  },
  {
    label: 'Museum signed football',
    body: 'Cristiano Ronaldo museum-style signed football, presented as a collector item with the bundle.',
  },
]

export default function HomePage() {
  const { openEntry } = useEntryFlow()

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
          <article className="ss-hero-merged-panel grid gap-5 px-0 py-4 sm:gap-6 sm:py-5 md:grid-cols-2 md:items-stretch md:gap-x-5 md:gap-y-4 md:px-4 md:py-5 lg:gap-x-7 lg:gap-y-3 lg:p-6">
            <div className="ss-hero-intro flex flex-col gap-4 text-left md:col-start-1 md:row-start-1">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 sm:text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                Live promotion
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
              <p className="max-w-xl text-[clamp(1.35rem,4vw,2.1rem)] font-bold leading-snug tracking-tight text-white">
                Ronaldo Legacy Bundle — pay online or enter by post, then answer{' '}
                <span className="ss-pen-highlight whitespace-nowrap text-emerald-100">3 hard skill questions</span> for the
                full kit draw.
              </p>
              <p className="ss-hero-helper-copy max-w-xl text-sm leading-relaxed text-stone-400 sm:text-base">
                Use <strong className="text-stone-300">Competitions</strong> in the menu for the shirt giveaway and a
                side-by-side view of both promotions.
              </p>
              <div className="ss-hero-cta-row mt-1 flex max-w-xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 md:mt-auto md:border-t md:border-white/10 md:pt-4">
                <a
                  href="#prizes"
                  className="ss-hero-cta-prize-lineup inline-flex min-h-[3rem] w-full shrink-0 items-center justify-center rounded-xl border-2 border-emerald-400/40 bg-emerald-950/20 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-950/40 sm:w-auto sm:min-h-[3.25rem]"
                >
                  Prize lineup
                </a>
                <Link
                  to="/archive/ronaldo-shirt-giveaway"
                  className="ss-hero-cta-shirt-link inline-flex w-full items-center justify-center self-center rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 underline decoration-stone-600 underline-offset-4 hover:text-stone-300 sm:w-auto sm:py-2.5"
                >
                  Free shirt giveaway
                </Link>
              </div>
            </div>

            <div className="ss-hero-prize-stack flex flex-col gap-2 md:col-start-2 md:row-start-1 md:min-h-0 md:gap-2.5">
              <div id="prizes" className="ss-hero-prize-column scroll-mt-24">
                <div className="ss-prize-studio ss-prize-studio--hero p-2 sm:p-3">
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
              </div>

              <div className="ss-hero-bundle-cta mt-1 flex w-full flex-col items-center gap-2.5 md:mt-auto md:gap-3">
                <p className="ss-hero-bundle-cta-blurb text-center text-stone-500">
                  Buy tickets online or enter by post — same prize. Three Ronaldo questions. Full kit: phone, shirt, ball,
                  case.
                </p>
                <div className="ss-hero-bundle-cta-actions flex w-full justify-center md:border-t md:border-white/10 md:pt-3 lg:pt-4">
                  <button
                    type="button"
                    onClick={() => openEntry('paid')}
                    className="ss-hero-bundle-draw-btn"
                  >
                    Enter Bundle Draw
                  </button>
                </div>
              </div>
            </div>

            <div className="ss-hero-copy-footer w-full md:col-start-1 md:row-start-2">
              <div className="ss-legacy-details-card ss-hero-panel-card w-full max-w-none rounded-lg">
                <h2 className="ss-legacy-details-title">Ronaldo Legacy Bundle details</h2>

                <section className="ss-legacy-details-block" aria-labelledby="ss-legacy-prize-stack-heading">
                  <h3 id="ss-legacy-prize-stack-heading" className="ss-legacy-details-kicker">
                    Prize stack
                  </h3>
                  <ul className="ss-legacy-prize-stack">
                    {BUNDLE_OFFER_ITEMS.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="ss-legacy-value-blurb">
                    Estimated total stack value is <strong>over £3,000</strong>, with collector legacy value from the
                    signed Ronaldo shirt and museum signed football.
                  </p>
                </section>

                <section
                  className="ss-legacy-details-block ss-legacy-details-block--notes"
                  aria-labelledby="ss-legacy-prize-notes-heading"
                >
                  <h3 id="ss-legacy-prize-notes-heading" className="ss-legacy-details-kicker">
                    Prize notes
                  </h3>
                  <dl className="ss-legacy-spec-list">
                    {LEGACY_BUNDLE_SPECS.map(({ label, body }) => (
                      <div key={label} className="ss-legacy-spec-row">
                        <dt>{label}</dt>
                        <dd>{body}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <p className="ss-legacy-details-footnote">
                  <span className="text-amber-300/85" aria-hidden>
                    *
                  </span>{' '}
                  Images are illustrative. Prize details are subject to the competition terms and availability.
                </p>
              </div>
            </div>

            <div className="ss-hero-ticket-bundles w-full md:col-start-2 md:row-start-2">
              <TicketBundlePrice className="ss-hero-panel-card h-full" />
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
