import { CompetitionCountdown } from './CompetitionCountdown'
import { formatBundlePriceGBP } from '../competitionData'
import { POSTAL_ENTRY_ADDRESS } from '../competitionData'
import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

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
 * }} props
 */
export function CompetitionPublicCard({ competition, onEnter, preview = false, draft = false }) {
  if (!competition) return null

  const hero =
    competition.heroImageUrl ||
    (competition.slug === DRAW_COMPETITION_SLUG ? legacyBundlePoster : null)
  const gallery = (competition.galleryUrls || []).filter(Boolean)
  const subImages = gallery.slice(0, 2)

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border border-teal-500/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
        preview ? 'pointer-events-none select-none' : ''
      }`}
    >
      {draft ? (
        <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          Draft preview — publish to go live on site
        </div>
      ) : null}
      <div className="bg-gradient-to-b from-teal-950/50 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7">
        <div className="ss-prize-studio mx-auto max-w-xl p-2 sm:p-3">
          <div className="relative z-[1] grid gap-2">
            <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
              <div className="ss-prize-studio-photo">
                {hero ? (
                  <img
                    src={hero}
                    alt=""
                    className="h-auto max-h-72 w-full object-cover"
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
            {subImages.length ? (
              <div className="ss-prize-studio-subgrid mx-auto grid w-full gap-1.5 sm:max-w-[17rem] sm:grid-cols-2 sm:gap-2">
                {subImages.map((url) => (
                  <div key={url} className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
                    <div className="ss-prize-studio-photo mx-auto max-w-[7rem] overflow-hidden rounded-md">
                      <img src={url} alt="" className="aspect-[3/4] h-auto w-full object-cover" loading="lazy" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/90">
          {competition.featuredOnHomepage ? 'Featured · Main prize' : 'Main prize draw'}
        </p>
        {competition.openPeriod ? (
          <div className="mt-2">
            <CompetitionCountdown
              opensAt={competition.openPeriod.entryOpensAt}
              closesAt={competition.openPeriod.entryClosesAt}
            />
          </div>
        ) : null}
        <h2 className="mt-2 font-display text-2xl text-white">{competition.title}</h2>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-500">
          {competition.summary ||
            'Pay for ticket bundles or use free entry routes, then answer three skill questions to qualify for the draw.'}
        </p>
        <p className="mt-4 inline-flex w-fit rounded-lg border border-emerald-400/30 bg-emerald-950/35 px-2.5 py-1.5 text-xs font-display text-emerald-50">
          {bundlePriceLine(competition)}
        </p>
        {competition.allowPostalEntry ? (
          <p className="mt-2 text-xs text-stone-600">
            Postal entries: write <span className="text-stone-400">{competition.postalCompetitionName}</span> on your
            envelope → {POSTAL_ENTRY_ADDRESS}
          </p>
        ) : null}
        {!preview && onEnter ? (
          <button
            type="button"
            onClick={onEnter}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
          >
            Enter this competition
          </button>
        ) : null}
      </div>
    </article>
  )
}
