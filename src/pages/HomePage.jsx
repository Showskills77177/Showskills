import { Link } from 'react-router-dom'
import kickupsHeroBg from '../assets/kickups-hero-bg.png'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'
import iphone17ProMaxGoldCase from '../assets/iphone-17-pro-max-gold-case.png'
import { BUNDLE_OFFER_ITEMS } from '../competitionData'
import { useEntryFlow } from '../entry/entryContext'
import { GlowingFootballIcon, TicketBundlePrice } from '../components/siteChrome'

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
          <article className="ss-hero-merged-panel grid gap-5 px-0 py-4 sm:gap-6 sm:py-5 lg:grid-cols-2 lg:items-stretch lg:gap-x-7 lg:gap-y-3 lg:p-6">
            <div className="ss-hero-intro flex flex-col gap-4 text-left lg:col-start-1 lg:row-start-1">
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
              <div className="ss-hero-cta-row mt-1 flex max-w-xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-2.5 lg:mt-4 lg:border-t lg:border-white/10 lg:pt-4">
                <a
                  href="#prizes"
                  className="ss-btn-bundle-draw inline-flex min-h-[3.25rem] flex-1 items-center justify-center rounded-xl border border-teal-500/35 bg-gradient-to-r from-teal-800/90 to-emerald-900/90 px-8 py-3.5 text-center text-base font-bold uppercase tracking-[0.1em] text-teal-50 shadow-lg transition hover:border-teal-400/50 hover:brightness-110 sm:min-h-[3.5rem] sm:flex-[1.4] sm:py-4 sm:text-lg"
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
            </div>

            <div className="ss-hero-prize-stack flex flex-col gap-2 lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:gap-2">
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
                      <div className="ss-prize-studio-tile px-1 pb-0.5 sm:px-1.5">
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
                      </div>
                      <div className="ss-prize-studio-tile px-1 pb-0.5 sm:px-1.5">
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ss-hero-bundle-cta">
                <div className="ss-hero-bundle-cta-actions lg:border-t lg:border-white/10 lg:pt-4">
                  <button
                    type="button"
                    onClick={() => openEntry('paid')}
                    className="ss-btn-bundle-draw w-full rounded-xl border border-teal-500/35 bg-gradient-to-r from-teal-800/90 to-emerald-900/90 px-8 py-3.5 text-center text-base font-bold uppercase tracking-[0.1em] text-teal-50 shadow-lg transition hover:border-teal-400/50 hover:brightness-110 sm:py-4 sm:text-lg"
                  >
                    Enter Bundle Draw
                  </button>
                </div>
                <p className="ss-hero-bundle-cta-blurb mt-1.5 text-center text-[11px] leading-snug text-stone-500 sm:text-xs">
                  Buy tickets online or enter by post — same prize. Three Ronaldo questions. Full kit: phone, shirt, ball,
                  case.
                </p>
              </div>
            </div>

            <div className="ss-hero-copy-footer lg:col-start-1 lg:row-start-2">
              <div className="ss-legacy-details-card ss-hero-panel-card max-w-xl rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-stone-400 lg:max-w-none">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-100">
                  Ronaldo Legacy Bundle details
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">Prize stack</p>
                <ul className="mt-2 space-y-1.5 text-sm text-stone-200">
                  {BUNDLE_OFFER_ITEMS.map((line) => (
                    <li key={line} className="flex gap-2 leading-snug">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500/70" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">
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

            <div className="ss-hero-ticket-bundles lg:col-start-2 lg:row-start-2">
              <TicketBundlePrice className="ss-hero-panel-card h-full" />
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
