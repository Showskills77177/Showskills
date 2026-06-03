import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import {
  SHIRT_GIVEAWAY_DETAILS_PATH,
  SHIRT_GIVEAWAY_HOW_TO_HASH,
  SHIRT_GIVEAWAY_SEASON_LABEL,
  SHIRT_GIVEAWAY_PRIZE_TITLE,
} from '../../shared/shirtGiveaway.mjs'
import { SHIRT_GIVEAWAY_CARD_STEP_TITLES } from '../../shared/shirtGiveawayEntryRequirements.mjs'
import { CompetitionCountdown } from './CompetitionCountdown'
import { pickCountdownPeriod } from '../../shared/competitionPeriods.mjs'

/**
 * Legacy Ronaldo shirt giveaway — kickups submission flow (not catalog main draw).
 */
export const LegacyShirtGiveawayCard = forwardRef(function LegacyShirtGiveawayCard(
  { onEnter, className = '', style, cardScale = 1, countdownPeriod = null, countdownPending = false },
  ref,
) {
  const scale = cardScale ?? style?.['--ss-shirt-card-scale'] ?? 1
  const period = pickCountdownPeriod(
    countdownPeriod ? { countdownPeriod, openPeriod: countdownPeriod } : null,
  )

  return (
    <article
      ref={ref}
      data-competition-card
      data-shirt-giveaway-card
      className={`ss-shirt-giveaway-card flex h-full w-full max-w-none flex-col overflow-hidden rounded-2xl border border-lime-400/30 bg-stone-950/80 shadow-[0_16px_48px_rgba(0,0,0,0.4)] ${className}`}
      style={{
        ...style,
        '--ss-shirt-card-scale': scale,
      }}
    >
      <div className="ss-shirt-giveaway-card__body flex min-h-0 flex-1 flex-col px-6 pb-0 pt-4 text-left sm:px-8 sm:pt-5">
        <div className="w-full shrink-0">
          <div className="mx-auto w-full max-w-[min(100%,19rem)] overflow-hidden rounded-lg border border-lime-400/35 bg-black shadow-inner sm:max-w-[min(100%,21rem)]">
            <img
              src={KICKUPS_GIVEAWAY_IMAGE}
              alt={`Prize: signed Cristiano Ronaldo Manchester United number 7 shirt, ${SHIRT_GIVEAWAY_SEASON_LABEL}.`}
              width={771}
              height={1024}
              className="h-auto w-full object-cover object-top"
              loading="lazy"
              decoding="async"
            />
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.26em] text-lime-300/90">Free giveaway</p>
          <h2 className="mt-0.5 font-display text-xl font-bold leading-tight text-white sm:text-2xl">
            Ronaldo Shirt Giveaway
          </h2>
          <p className="mt-1 text-sm leading-snug text-stone-500">{SHIRT_GIVEAWAY_PRIZE_TITLE}</p>
          <p className="mt-1.5 text-sm text-stone-500">No payment or video upload.</p>
        </div>

        {period || countdownPending ? (
          <div className="mt-3 w-full shrink-0">
            <CompetitionCountdown
              opensAt={period?.entryOpensAt}
              closesAt={period?.entryClosesAt}
              label="Giveaway ends"
              showDot={false}
              pending={countdownPending}
              theme="lime"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-amber-200/80">Entry dates not set yet — configure them in admin.</p>
        )}

        <div className="mx-auto mt-3 w-full max-w-[28rem] shrink-0 rounded-xl border border-lime-400/25 bg-lime-950/20 px-3 py-2.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300/80">What you need to do</p>
          <ol className="mt-2 list-none space-y-1.5">
            {SHIRT_GIVEAWAY_CARD_STEP_TITLES.map((title, index) => (
              <li key={title} className="flex gap-2 text-sm leading-snug">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-[10px] font-bold text-lime-200"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="min-w-0 text-stone-300">{title}</span>
              </li>
            ))}
          </ol>
          <Link
            to={`${SHIRT_GIVEAWAY_DETAILS_PATH}${SHIRT_GIVEAWAY_HOW_TO_HASH}`}
            className="mt-2 inline-block text-xs font-medium text-lime-400/85 underline decoration-lime-700/50 underline-offset-2 hover:text-lime-300"
          >
            Full entry steps
          </Link>
        </div>
      </div>

      <div className="ss-competition-card-actions ss-competition-card-footer">
        <button
          type="button"
          onClick={onEnter}
          className="ss-competition-enter-btn ss-competition-enter-btn--free"
        >
          Enter free giveaway
        </button>
      </div>
    </article>
  )
})
