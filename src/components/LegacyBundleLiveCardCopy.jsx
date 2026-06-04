import { CompetitionCountdown } from './CompetitionCountdown'
import { POSTAL_ENTRY_ADDRESS } from '../competitionData'
import { formatBundlePriceGBP } from '../competitionData'

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

/** Fixed public layout for the Signed Legacy Bundle card — no saved editor offsets. */
export function LegacyBundleLiveCardCopy({
  metaFeaturedLabel,
  periodMonth,
  countdownPeriod,
  titleText,
  summary,
  competition,
  enterLabel,
  onEnter,
}) {
  return (
    <div className="ss-competition-card-legacy-stack">
      <div className="ss-competition-card-legacy-stack__meta flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400/90">{metaFeaturedLabel}</p>
        {periodMonth ? (
          <>
            <span className="hidden text-teal-600/40 sm:inline" aria-hidden>
              ·
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-400/90">{periodMonth} draw</p>
          </>
        ) : null}
      </div>
      {countdownPeriod ? (
        <CompetitionCountdown
          opensAt={countdownPeriod.entryOpensAt}
          closesAt={countdownPeriod.entryClosesAt}
          showDot={false}
          live
          className="!m-0 max-w-[min(100%,22rem)] text-center sm:max-w-xl"
        />
      ) : (
        <p className="text-xs text-amber-200/80">No entry period dates yet — set them in admin.</p>
      )}
      <h2 className="font-display text-2xl uppercase leading-[0.88] tracking-wide text-white sm:text-3xl">{titleText}</h2>
      <p className="text-sm leading-relaxed text-stone-400 sm:text-base">{summary}</p>
      <p className="ss-competition-card-legacy-stack__price inline-flex w-fit rounded-lg border border-emerald-400/30 bg-emerald-950/35 px-3 py-1.5 text-sm font-display text-emerald-50 sm:text-base">
        {bundlePriceLine(competition)}
      </p>
      {competition.allowPostalEntry ? (
        <p className="text-xs leading-relaxed text-stone-500 sm:text-sm">
          Postal entries: write <span className="text-stone-400">{competition.postalCompetitionName}</span> on your
          envelope → {POSTAL_ENTRY_ADDRESS}
        </p>
      ) : null}
      {onEnter ? (
        <button type="button" onClick={onEnter} className="ss-competition-enter-btn ss-competition-enter-btn--paid">
          {enterLabel}
        </button>
      ) : null}
    </div>
  )
}
