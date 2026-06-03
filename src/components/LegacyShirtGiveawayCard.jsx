import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { SHIRT_GIVEAWAY_SEASON_LABEL, SHIRT_GIVEAWAY_PRIZE_TITLE } from '../../shared/shirtGiveaway.mjs'
import { SHIRT_GIVEAWAY_PUBLIC_STEPS } from '../../shared/shirtGiveawayEntryRequirements.mjs'

/**
 * Legacy Ronaldo shirt giveaway — kickups submission flow (not catalog main draw).
 */
export const LegacyShirtGiveawayCard = forwardRef(function LegacyShirtGiveawayCard(
  { onEnter, className = '', style, cardScale = 1.1 },
  ref,
) {
  const scale = cardScale ?? style?.['--ss-shirt-card-scale'] ?? 1

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
      <div className="ss-shirt-giveaway-card__body flex min-h-0 flex-1 flex-col items-center overflow-visible px-5 pb-6 pt-6 text-center sm:px-6 sm:pb-7 sm:pt-7">
        <div className="w-full max-w-[min(100%,19rem)] shrink-0 overflow-hidden rounded-lg border border-lime-400/35 bg-black shadow-inner sm:max-w-[min(100%,21rem)]">
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
        <p className="mt-3 shrink-0 text-[10px] font-bold uppercase tracking-[0.26em] text-lime-300/90">Free giveaway</p>
        <p className="mt-1 shrink-0 font-display text-xl font-bold leading-tight text-white sm:text-2xl">
          {SHIRT_GIVEAWAY_PRIZE_TITLE}
        </p>

        <p className="mt-5 shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-lime-300/85 sm:mt-6">
          Free · Shirt prize
        </p>
        <h2 className="mt-1.5 shrink-0 font-display text-[clamp(1.35rem,4.5vw,2rem)] uppercase leading-tight tracking-[0.04em] text-white">
          Ronaldo Shirt Giveaway
        </h2>
        <p className="mt-3 max-w-[28rem] shrink-0 text-sm leading-relaxed text-stone-500 sm:mt-4">
          No payment or video upload. Complete every step below in the entry form to qualify for the random draw.
        </p>

        <div className="mt-4 w-full max-w-[28rem] shrink-0 rounded-xl border border-lime-400/25 bg-lime-950/20 px-4 py-3.5 text-left sm:mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300/80">What you need to do</p>
          <ol className="mt-3 list-none space-y-2.5">
            {SHIRT_GIVEAWAY_PUBLIC_STEPS.slice(0, 5).map((step) => (
              <li key={step.num} className="flex gap-2.5 text-sm">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-[10px] font-bold text-lime-200"
                  aria-hidden
                >
                  {step.num}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold text-stone-200">{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="ss-competition-card-actions mt-auto w-full max-w-[28rem] shrink-0 pt-4 sm:pt-5">
          <button
            type="button"
            onClick={onEnter}
            className="ss-shirt-giveaway-enter-btn w-full rounded-xl py-3.5 text-sm font-bold shadow-lg transition hover:brightness-110 sm:py-4 sm:text-base"
          >
            Enter free giveaway
          </button>
          <Link
            to="/archive/ronaldo-shirt-giveaway"
            className="mt-4 block text-center text-sm font-medium text-stone-500 underline decoration-stone-600 underline-offset-4 hover:text-stone-300"
          >
            View giveaway details
          </Link>
        </div>
      </div>
    </article>
  )
})
