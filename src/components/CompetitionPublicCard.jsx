import { CompetitionCountdown } from './CompetitionCountdown'
import { LegacyBundlePhonePrizes } from './LegacyBundlePhonePrizes'
import { formatBundlePriceGBP } from '../competitionData'
import { POSTAL_ENTRY_ADDRESS } from '../competitionData'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import { publicCompetitionSummary } from '../lib/publicCompetitionCopy'
import { DRAW_COMPETITION_SLUG, formatPeriodMonthLabel, pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'

const DEFAULT_SUMMARY =
  'Pay for ticket bundles or use free entry routes, then answer three skill questions to qualify for the draw.'

function bundlePriceLine(competition) {
  if (!competition?.allowPaidEntry) return 'Free entry routes only'
  if (competition.minBundlePence != null) {
    const max = competition.bundles?.length
      ? Math.max(...competition.bundles.map((b) => b.totalPence))
      : competition.minBundlePence
    if (competition.minBundlePence === max) {
      return `From ${formatBundlePriceGBP(competition.minBundlePence)}`
    }
    return `From ${formatBundlePriceGBP(competition.minBundlePence)} · bundles to ${formatBundlePriceGBP(max)}`
  }
  return 'Paid ticket bundles available'
}

/**
 * @param {{
 *   competition: object,
 *   onEnter?: () => void,
 *   preview?: boolean,
 *   draft?: boolean,
 *   layout?: 'card' | 'page',
 * }} props
 */
export function CompetitionPublicCard({
  competition,
  onEnter,
  preview = false,
  draft = false,
  layout = 'card',
  className = '',
}) {
  if (!competition) return null

  const isPageLayout = layout === 'page'
  const isCardLayout = !isPageLayout
  const isLegacyBundle = competition.slug === DRAW_COMPETITION_SLUG
  const countdownPeriod = pickCountdownPeriod(competition)
  const periodMonth = formatPeriodMonthLabel(countdownPeriod?.entryClosesAt)
  const hero =
    competition.heroImageUrl ||
    (isLegacyBundle ? legacyBundlePoster : null)
  const gallery = (competition.galleryUrls || []).filter(Boolean)
  const subImages = isLegacyBundle ? [] : gallery.slice(0, 2)
  const summary = publicCompetitionSummary(competition, DEFAULT_SUMMARY)

  return (
    <article
      data-competition-card
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
        isPageLayout ? 'ss-competition-page-card' : ''
      } ${preview ? 'pointer-events-none select-none' : ''} ${className}`}
    >
      {draft ? (
        <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          Draft preview — publish to go live on site
        </div>
      ) : null}
      <div className="bg-gradient-to-b from-teal-950/50 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7 sm:px-6">
        <div
          className={`ss-prize-studio mx-auto p-2 sm:p-3 ${
            isPageLayout ? 'ss-prize-studio--hero max-w-2xl' : 'max-w-xl'
          }`}
        >
          <div className="relative z-[1] grid gap-2">
            <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
              <div className="ss-prize-studio-photo">
                {hero ? (
                  <img
                    src={hero}
                    alt=""
                    className={`h-auto w-full object-cover ${isPageLayout ? '' : 'max-h-72'}`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-stone-900/80 text-sm text-stone-500">
                    Upload a hero image in admin
                  </div>
                )}
              </div>
            </div>
            {isLegacyBundle ? <LegacyBundlePhonePrizes compact={!isPageLayout} /> : null}
            {subImages.length ? (
              <div
                className={`ss-prize-studio-subgrid mx-auto grid w-full gap-2 ${
                  isPageLayout ? 'max-w-[20rem] grid-cols-2 sm:gap-0' : 'gap-1.5 sm:max-w-[17rem] sm:grid-cols-2 sm:gap-2'
                }`}
              >
                {subImages.map((url) => (
                  <div key={url} className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                    <div
                      className={`ss-prize-studio-photo mx-auto overflow-hidden rounded-md ${
                        isPageLayout ? 'max-w-[7.5rem]' : 'max-w-[7rem]'
                      }`}
                    >
                      <img src={url} alt="" className="aspect-[3/4] h-auto w-full object-cover" loading="lazy" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={`flex flex-1 flex-col p-6 pt-5 sm:p-8 ${isCardLayout ? 'items-center text-center' : ''}`}
      >
        <div
          className={`flex w-full flex-col gap-1 ${
            isCardLayout ? 'items-center' : 'sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2.5'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400/90">
            {competition.featuredOnHomepage ? 'Featured · Main prize' : 'Main prize draw'}
          </p>
          {periodMonth ? (
            <>
              <span className={`text-teal-600/40 ${isCardLayout ? 'inline' : 'hidden sm:inline'}`} aria-hidden>
                ·
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400/90">{periodMonth} draw</p>
            </>
          ) : null}
        </div>
        {countdownPeriod ? (
          <div className={`mt-2.5 flex w-full ${isCardLayout ? 'justify-center' : ''}`}>
            <CompetitionCountdown
              opensAt={countdownPeriod.entryOpensAt}
              closesAt={countdownPeriod.entryClosesAt}
              showDot={false}
              className={isCardLayout ? 'mx-auto max-w-full text-center tabular-nums' : ''}
            />
          </div>
        ) : (
          <p className={`mt-2.5 text-xs text-amber-200/80 ${isCardLayout ? 'text-center' : ''}`}>
            No entry period dates yet — set them in admin.
          </p>
        )}
        <h2
          className={`mt-2 font-display text-2xl uppercase tracking-wide text-white sm:text-3xl ${
            isCardLayout ? 'w-full' : ''
          }`}
        >
          {competition.title}
        </h2>
        <p className={`mt-3 flex-1 text-sm leading-relaxed text-stone-500 sm:text-base ${isCardLayout ? 'max-w-md' : ''}`}>
          {summary}
        </p>
        <p
          className={`mt-4 inline-flex w-fit rounded-lg border border-emerald-400/30 bg-emerald-950/35 px-3 py-1.5 text-sm font-display text-emerald-50 sm:text-base ${
            isCardLayout ? 'mx-auto' : ''
          }`}
        >
          {bundlePriceLine(competition)}
        </p>
        {competition.allowPostalEntry ? (
          <p className={`mt-2 text-xs text-stone-600 sm:text-sm ${isCardLayout ? 'max-w-md' : ''}`}>
            Postal entries: write <span className="text-stone-400">{competition.postalCompetitionName}</span> on your
            envelope → {POSTAL_ENTRY_ADDRESS}
          </p>
        ) : null}
        {!preview && onEnter ? (
          <div className={`ss-competition-card-actions mt-auto w-full pt-6 ${isCardLayout ? 'max-w-none' : ''}`}>
            <button
              type="button"
              onClick={onEnter}
              className="ss-competition-enter-btn w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 sm:py-4 sm:text-base"
            >
              Enter this competition
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
