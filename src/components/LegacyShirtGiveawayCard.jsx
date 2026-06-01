import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { SHIRT_GIVEAWAY_QUESTION } from '../../shared/shirtGiveaway.mjs'

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
      className={`ss-shirt-giveaway-card flex w-full max-w-none flex-col overflow-hidden rounded-2xl border border-lime-400/30 bg-stone-950/80 shadow-[0_16px_48px_rgba(0,0,0,0.4)] ${className}`}
      style={{
        ...style,
        '--ss-shirt-card-scale': scale,
      }}
    >
      <div className="ss-shirt-giveaway-card__body flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-6 pt-6 text-center sm:px-6 sm:pb-7 sm:pt-7">
        <div className="w-full max-w-[min(100%,19rem)] shrink-0 overflow-hidden rounded-lg border border-lime-400/35 bg-black shadow-inner sm:max-w-[min(100%,21rem)]">
          <img
            src={KICKUPS_GIVEAWAY_IMAGE}
            alt="Prize: signed Cristiano Ronaldo Manchester United number 7 shirt."
            width={771}
            height={1024}
            className="h-auto w-full object-cover object-top"
            loading="lazy"
            decoding="async"
          />
        </div>
        <p className="mt-3 shrink-0 text-[10px] font-bold uppercase tracking-[0.26em] text-lime-300/90">Free giveaway</p>
        <p className="mt-1 shrink-0 font-display text-xl font-bold leading-tight text-white sm:text-2xl">
          Ronaldo signed shirt
        </p>
        <p className="mt-0.5 shrink-0 text-xs font-medium text-stone-400">2021–22 season</p>

        <p className="mt-5 shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-lime-300/85 sm:mt-6">
          Free · Shirt prize
        </p>
        <h2 className="mt-1.5 shrink-0 font-display text-[clamp(1.35rem,4.5vw,2rem)] uppercase leading-tight tracking-[0.04em] text-white">
          Ronaldo Shirt Giveaway
        </h2>
        <p className="mt-3 max-w-[28rem] shrink-0 text-sm leading-relaxed text-stone-500 sm:mt-4">
          No payment. No video upload. Answer one qualification question and, if correct, you enter the random draw for
          the signed Ronaldo shirt only.
        </p>

        <div className="mt-4 w-full max-w-[28rem] shrink-0 rounded-xl border border-lime-400/25 bg-lime-950/20 px-4 py-3.5 text-left sm:mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300/80">Question</p>
          <p className="mt-2 text-sm font-bold leading-snug text-white">{SHIRT_GIVEAWAY_QUESTION}</p>
        </div>

        <div className="mt-auto w-full max-w-[28rem] shrink-0 pt-4 sm:pt-5">
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
