import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import {
  SHIRT_GIVEAWAY_DETAILS_PATH,
  SHIRT_GIVEAWAY_HOW_TO_HASH,
  SHIRT_GIVEAWAY_SEASON_LABEL,
  SHIRT_GIVEAWAY_PRIZE_TITLE,
} from '../../shared/shirtGiveaway.mjs'

/**
 * Legacy Ronaldo shirt giveaway — kickups submission flow (not catalog main draw).
 */
export const LegacyShirtGiveawayCard = forwardRef(function LegacyShirtGiveawayCard(
  { onEnter, className = '', style, cardScale = 1.1 },
  ref,
) {
  const scale = cardScale ?? style?.['--ss-shirt-card-scale'] ?? 1.1

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
      <div className="ss-shirt-giveaway-card__body flex min-h-0 flex-1 flex-col items-center px-5 pb-5 pt-4 text-center sm:px-6 sm:pb-5 sm:pt-5">
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

        <div className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center py-2">
          <Link
            to={`${SHIRT_GIVEAWAY_DETAILS_PATH}${SHIRT_GIVEAWAY_HOW_TO_HASH}`}
            className="text-sm font-semibold text-lime-400/90 underline decoration-lime-700/50 underline-offset-2 hover:text-lime-300"
          >
            What you need to do
          </Link>
        </div>

        <div className="ss-competition-card-actions w-full max-w-[28rem] shrink-0">
          <button
            type="button"
            onClick={onEnter}
            className="ss-competition-enter-btn ss-shirt-giveaway-enter-btn w-full rounded-xl py-3.5 text-sm font-bold shadow-lg transition hover:brightness-110 sm:py-4 sm:text-base"
          >
            Enter free giveaway
          </button>
        </div>
      </div>
    </article>
  )
})
