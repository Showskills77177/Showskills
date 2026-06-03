import { CompetitionCountdown } from './CompetitionCountdown'
import { POSTAL_ENTRY_ADDRESS } from '../competitionData'
import { formatPeriodMonthLabel } from '../../shared/competitionPeriods.mjs'

function entryRouteLabel(competition) {
  const parts = []
  if (competition.allowFreeOnline) parts.push('Free online (£0 verify)')
  if (competition.allowPostalEntry) parts.push('Free postal')
  if (!parts.length) return 'Free entry — see terms'
  return parts.join(' · ')
}

/**
 * Public giveaway card — same layout as competitions, lime theme, no paid bundles.
 * @param {{
 *   giveaway: object,
 *   onEnter?: () => void,
 *   preview?: boolean,
 *   draft?: boolean,
 *   layout?: 'card' | 'page',
 * }} props
 */
export function GiveawayPublicCard({
  giveaway,
  onEnter,
  preview = false,
  draft = false,
  layout = 'card',
}) {
  if (!giveaway) return null

  const isPageLayout = layout === 'page'
  const hero = giveaway.heroImageUrl
  const gallery = (giveaway.galleryUrls || []).filter(Boolean)
  const subImages = gallery.slice(0, 2)

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-lime-400/25 bg-stone-950/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
        isPageLayout ? 'ss-competition-page-card' : ''
      } ${preview ? 'pointer-events-none select-none' : ''}`}
    >
      {draft ? (
        <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          Draft preview — publish to go live on site
        </div>
      ) : null}
      <div className="bg-gradient-to-b from-lime-950/35 via-stone-950/80 to-stone-950 px-4 pb-4 pt-7 sm:px-6">
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
      <div className="flex flex-1 flex-col p-6 pt-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-lime-300/90">Free giveaway</p>
        {giveaway.openPeriod ? (
          <div className="ss-competition-countdown-slot mt-2 space-y-1">
            {formatPeriodMonthLabel(giveaway.openPeriod.entryClosesAt) ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400/80">
                {formatPeriodMonthLabel(giveaway.openPeriod.entryClosesAt)} draw
              </p>
            ) : null}
            <CompetitionCountdown
              opensAt={giveaway.openPeriod.entryOpensAt}
              closesAt={giveaway.openPeriod.entryClosesAt}
              showDot={false}
            />
          </div>
        ) : (
          <div className="ss-competition-countdown-slot mt-2" aria-hidden>
            <CompetitionCountdown pending showDot={false} live={false} />
          </div>
        )}
        <h2 className="mt-2 font-display text-2xl text-white sm:text-3xl">{giveaway.title}</h2>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-500 sm:text-base">
          {giveaway.summary ||
            'Enter free online or by post, answer the skill questions, and qualify for the random draw. No payment required.'}
        </p>
        <p className="mt-4 inline-flex w-fit rounded-lg border border-lime-400/30 bg-lime-950/35 px-2.5 py-1.5 text-xs font-display text-lime-50">
          {entryRouteLabel(giveaway)}
        </p>
        {giveaway.allowPostalEntry ? (
          <p className="mt-2 text-xs text-stone-600">
            Postal entries: write <span className="text-stone-400">{giveaway.postalCompetitionName}</span> on your
            envelope → {POSTAL_ENTRY_ADDRESS}
          </p>
        ) : null}
        {!preview && onEnter ? (
          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={onEnter}
              className="w-full rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 py-3.5 text-sm font-bold text-emerald-950 shadow-lg transition hover:brightness-110 sm:py-4 sm:text-base"
            >
              Enter this giveaway
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
