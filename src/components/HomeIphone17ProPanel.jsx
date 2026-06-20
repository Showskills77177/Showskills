import { CompetitionCountdown } from './CompetitionCountdown'
import { Iphone17ProPrizeStudio } from './Iphone17ProPrizeStudio'
import { formatBundlePriceGBP } from '../competitionData'
import { publicCompetitionSummary } from '../lib/publicCompetitionCopy'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'
import {
  IPHONE_17_PRO_COMPETITION_LABEL,
  IPHONE_17_PRO_COMPETITION_SLUG,
  IPHONE_17_PRO_COMPETITION_SUMMARY,
} from '../../shared/iphone17ProCompetition.mjs'
import { resolveIphone17ProPublicCompetition } from '../../shared/iphone17ProPublic.mjs'

const DEFAULT_SUMMARY =
  'Tickets from 29p. Pay online, enter free by post, or verify your card online (£0) — then answer three skill questions.'

/**
 * Homepage panel for the iPhone 17 Pro or Cash draw — sits below the Signed Legacy Bundle hero.
 */
export function HomeIphone17ProPanel({ block = {}, onEnter, editorMode = false, preview = false }) {
  const { competition: apiCompetition, loading } = usePublicCompetition(IPHONE_17_PRO_COMPETITION_SLUG)
  const competition = resolveIphone17ProPublicCompetition({ detail: apiCompetition })
  const countdownPeriod = pickCountdownPeriod(apiCompetition ?? competition)

  if (block.visible === false && !editorMode) return null

  const badgeLabel = block.badgeLabel?.trim() || 'Also live now'
  const titleText = block.title?.trim() || competition?.title || IPHONE_17_PRO_COMPETITION_LABEL
  const summary =
    block.summary?.trim() ||
    publicCompetitionSummary(competition, IPHONE_17_PRO_COMPETITION_SUMMARY || DEFAULT_SUMMARY)
  const ctaLabel = block.ctaButtonLabel?.trim() || 'Enter iPhone draw'
  const minPence =
    competition?.minBundlePence ??
    competition?.bundles?.reduce(
      (min, b) => (b.totalPence != null && b.totalPence < min ? b.totalPence : min),
      Infinity,
    )
  const ticketFromPence = Number.isFinite(minPence) ? minPence : 29
  const priceLine =
    block.priceLine?.trim() ||
    `From ${formatBundlePriceGBP(ticketFromPence)} per ticket or enter for free`

  return (
    <section
      className={`ss-home-iphone-panel relative border-t border-emerald-900/25 bg-[#061410] ${
        preview ? 'rounded-xl border border-white/10' : ''
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <article className="ss-home-iphone-panel__card overflow-hidden rounded-2xl border border-teal-500/25 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
          <div className="grid md:grid-cols-2 md:items-stretch md:gap-0">
            <div className="ss-home-iphone-panel__copy order-2 flex flex-col gap-3 px-5 pb-5 pt-4 text-left sm:px-7 sm:pb-7 sm:pt-6 md:order-1">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-400/30 bg-teal-950/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-200">
                <span className="h-2 w-2 shrink-0 rounded-full bg-teal-400" aria-hidden />
                {badgeLabel}
              </p>
              {countdownPeriod || loading ? (
                <CompetitionCountdown
                  opensAt={countdownPeriod?.entryOpensAt}
                  closesAt={countdownPeriod?.entryClosesAt}
                  label="Draw ends"
                  showDot={false}
                  live={!editorMode && !preview}
                  pending={loading && !countdownPeriod}
                  className="max-w-[min(100%,20rem)]"
                />
              ) : (
                <p className="text-xs text-amber-200/80">Entry dates not set yet — configure them in admin.</p>
              )}
              <h2 className="font-display text-[clamp(1.5rem,5vw,2.25rem)] uppercase leading-[0.92] tracking-wide text-white">
                {titleText}
              </h2>
              <div className="ss-home-iphone-panel__entry-copy w-full max-w-xl">
                <p className="text-base leading-relaxed text-stone-400 md:text-sm lg:text-base">{summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                  {competition?.allowPaidEntry !== false ? (
                    <span className="rounded-full border border-teal-500/25 px-2 py-0.5">Paid from 29p</span>
                  ) : null}
                  {competition?.allowFreeOnline ? (
                    <span className="rounded-full border border-teal-500/25 px-2 py-0.5">Free online (£0)</span>
                  ) : null}
                  {competition?.allowPostalEntry ? (
                    <span className="rounded-full border border-stone-500/25 px-2 py-0.5">Free postal</span>
                  ) : null}
                </div>
                {!preview ? (
                  <div className="ss-home-iphone-panel__actions mt-7 sm:mt-8">
                    <p className="ss-home-iphone-panel__price">{priceLine}</p>
                    <button
                      type="button"
                      onClick={onEnter}
                      tabIndex={editorMode ? -1 : undefined}
                      className="ss-hero-bundle-draw-btn ss-home-iphone-panel__enter-btn"
                    >
                      {ctaLabel}
                    </button>
                  </div>
                ) : (
                  <p className="ss-home-iphone-panel__price mt-4">{priceLine}</p>
                )}
              </div>
            </div>

            <div className="ss-home-iphone-panel__visual order-1 flex items-center justify-center px-4 py-6 sm:px-6 md:order-2 md:py-8">
              <Iphone17ProPrizeStudio compact />
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
