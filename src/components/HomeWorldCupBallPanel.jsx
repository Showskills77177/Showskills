import { Link } from 'react-router-dom'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_GIVEAWAY_PATH,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_COUNT,
} from '../../shared/worldCupBallGiveaway.mjs'
import { WORLD_CUP_BALL_SKILL_NOTICE } from '../../shared/worldCupBallGiveawayRules.mjs'
import { WorldCupBallPrizeFrame } from './WorldCupBallPrizeFrame'
import { WorldCupBallTimingCallout } from './WorldCupBallTimingCallout'

/**
 * Homepage panel promoting the World Cup Ball Giveaway.
 * @param {{ block?: object, onEnter?: () => void, editorMode?: boolean, preview?: boolean, embedded?: boolean }} props
 */
export function HomeWorldCupBallPanel({
  block = {},
  onEnter,
  editorMode = false,
  preview = false,
  embedded = false,
}) {
  if (block.visible === false && !editorMode && !preview) return null

  const badgeLabel = block.badgeLabel?.trim() || 'Free skill challenge'
  const titleText = block.title?.trim() || WORLD_CUP_BALL_GIVEAWAY_LABEL
  const summary =
    block.summary?.trim() ||
    `${WORLD_CUP_BALL_QUESTION_COUNT} brutal football questions. Answer every one correctly and the ball is yours — no draw, no payment.`
  const ctaLabel = block.ctaButtonLabel?.trim() || 'Start timed quiz'

  const card = (
    <article className="ss-home-wc-ball-panel__card overflow-hidden rounded-2xl border border-amber-400/35 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="grid md:grid-cols-2 md:items-stretch">
        <div className="ss-home-wc-ball-panel__copy order-2 flex flex-col gap-3 px-5 pb-6 pt-5 text-left sm:px-7 sm:pb-8 sm:pt-7 md:order-1">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/35 bg-amber-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
            <span className="ss-home-wc-ball-panel__pulse h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
            {badgeLabel}
          </p>

          <h2 className="font-display text-[clamp(1.65rem,5.5vw,2.5rem)] uppercase leading-[0.92] tracking-[0.03em] text-amber-50">
            {titleText}
          </h2>

          <WorldCupBallTimingCallout />

          <p className="max-w-xl text-base leading-relaxed text-stone-300 md:text-[0.9375rem] lg:text-base">
            {summary}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <span className="ss-home-wc-ball-panel__tag">Free entry</span>
            <span className="ss-home-wc-ball-panel__tag">{WORLD_CUP_BALL_QUESTION_COUNT} skill questions</span>
            <span className="ss-home-wc-ball-panel__tag ss-home-wc-ball-panel__tag--hot">Win the ball</span>
          </div>

          <p className="text-xs leading-relaxed text-amber-200/70">
            {WORLD_CUP_BALL_PRIZE_TITLE}. {WORLD_CUP_BALL_SKILL_NOTICE}
          </p>

          {!preview ? (
            <div className="ss-home-wc-ball-panel__actions mt-4 sm:mt-5">
              <button
                type="button"
                onClick={onEnter}
                tabIndex={editorMode ? -1 : undefined}
                className="ss-home-wc-ball-panel__cta"
              >
                {ctaLabel}
              </button>
              <Link to={WORLD_CUP_BALL_GIVEAWAY_PATH} className="ss-home-wc-ball-panel__rules-link">
                Full rules &amp; how to win
              </Link>
            </div>
          ) : null}
        </div>

        <div className="ss-home-wc-ball-panel__visual order-1 flex items-center justify-center px-4 py-6 sm:px-6 md:order-2 md:py-8">
          <WorldCupBallPrizeFrame variant="hero" className="w-full max-w-[min(100%,22rem)]" />
        </div>
      </div>
    </article>
  )

  if (embedded) {
    return (
      <div className="ss-home-wc-ball-panel ss-home-wc-ball-panel--embedded md:col-span-2">
        {card}
      </div>
    )
  }

  return (
    <section
      className={`ss-home-wc-ball-panel relative border-b border-amber-500/20 ${
        preview ? 'rounded-xl border border-white/10' : ''
      }`}
    >
      <div className="ss-home-wc-ball-panel__bg-glow" aria-hidden />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{card}</div>
    </section>
  )
}
