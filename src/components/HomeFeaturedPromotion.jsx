import { Link } from 'react-router-dom'
import { CompetitionCountdown } from './CompetitionCountdown'
import { LegacyBundlePhonePrizes } from './LegacyBundlePhonePrizes'
import { LegacyBundleImageryDisclaimer } from './LegacyBundleImageryDisclaimer'
import { LegacyBundleImageryCaption } from './LegacyBundleImageryCaption'
import { LegacyBundlePosterTitle } from './LegacyBundlePosterTitle'
import { GlowingFootballIcon } from './siteChrome'
import { formatBundlePriceGBP } from '../competitionData'
import { publicCompetitionSummary } from '../lib/publicCompetitionCopy'
import { DRAW_COMPETITION_SLUG, pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'

/**
 * Dynamic homepage live promotion panel for admin-created competitions (uploaded images).
 */
export function HomeFeaturedPromotion({ competition, onEnter, preview = false }) {
  if (!competition) return null

  const hero = competition.heroImageUrl
  const gallery = (competition.galleryUrls || []).filter(Boolean)
  const isLegacy = competition.slug === DRAW_COMPETITION_SLUG
  const countdownPeriod = pickCountdownPeriod(competition)

  return (
    <section className={`ss-hero-surface relative -mt-px overflow-x-clip border-b border-emerald-900/20 pb-6 sm:pb-10 ${preview ? 'rounded-xl border border-white/10' : ''}`}>
      {preview ? (
        <div className="border-b border-amber-500/30 bg-amber-950/50 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-200">
          Homepage live promotion preview
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[1] min-h-[22rem] bg-[#071512]" aria-hidden>
        {hero ? (
          <img src={hero} alt="" className="h-full w-full object-cover opacity-40" decoding="async" />
        ) : null}
        <div className="ss-hero-photo-scrim absolute inset-0" />
      </div>

      <div className="relative z-[2] mx-auto max-w-5xl px-4 pt-5 pb-10 sm:px-6 sm:pt-11">
        <article className="ss-hero-merged-panel grid gap-5 md:grid-cols-2 md:items-stretch md:gap-x-6">
          <div className="flex flex-col gap-4 text-left">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              Live promotion
            </p>
            <CompetitionCountdown
              opensAt={countdownPeriod?.entryOpensAt}
              closesAt={countdownPeriod?.entryClosesAt}
              label="Competition ends"
            />
            <div className="flex flex-wrap items-end gap-3">
              <h1 className="font-display text-[clamp(2rem,8vw,3.5rem)] leading-[0.95] tracking-tight text-white">
                {competition.title}
              </h1>
              {!isLegacy ? (
                <div className="flex items-end gap-1.5">
                  <GlowingFootballIcon stagger={0} className="mb-1 shrink-0" />
                  <GlowingFootballIcon stagger={1} className="mb-1 shrink-0" />
                </div>
              ) : null}
            </div>
            <p className="max-w-xl text-lg font-bold leading-snug text-white sm:text-xl">
              {publicCompetitionSummary(
                competition,
                'Enter online or by post, then answer three skill questions for the main draw.',
              )}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-stone-500">
              {competition.allowPaidEntry ? (
                <span className="rounded-full border border-teal-500/25 px-2 py-0.5">Paid bundles</span>
              ) : null}
              {competition.allowFreeOnline ? (
                <span className="rounded-full border border-teal-500/25 px-2 py-0.5">Free online (£0)</span>
              ) : null}
              {competition.allowPostalEntry ? (
                <span className="rounded-full border border-stone-500/25 px-2 py-0.5">Free postal</span>
              ) : null}
            </div>
            {!preview ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={onEnter} className="ss-hero-bundle-draw-btn">
                  Enter competition
                </button>
                <Link
                  to="/competitions"
                  className="inline-flex items-center rounded-xl border border-emerald-400/35 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/40"
                >
                  All competitions
                </Link>
              </div>
            ) : null}
          </div>

          <div className="ss-prize-studio p-2 sm:p-3">
            <div className="relative z-[1] grid gap-2">
              <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
                <div className="ss-prize-studio-photo">
                  {hero ? (
                    <>
                      <img src={hero} alt="" className="h-auto w-full object-cover" loading="lazy" />
                      {isLegacy ? (
                        <>
                          <LegacyBundlePosterTitle />
                          <LegacyBundleImageryCaption />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-stone-500">
                      Hero image
                    </div>
                  )}
                </div>
              </div>
              {isLegacy ? (
                <>
                  <LegacyBundlePhonePrizes />
                  <LegacyBundleImageryDisclaimer />
                </>
              ) : gallery.length ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {gallery.slice(0, 2).map((url) => (
                    <div key={url} className="ss-prize-studio-tile overflow-hidden rounded-md">
                      <img src={url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {competition.bundles?.length && competition.allowPaidEntry ? (
              <p className="mt-3 text-center text-xs text-stone-500">
                From {formatBundlePriceGBP(Math.min(...competition.bundles.map((b) => b.totalPence)))} per bundle
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  )
}
