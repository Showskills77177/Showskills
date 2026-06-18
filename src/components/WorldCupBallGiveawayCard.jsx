import { Link } from 'react-router-dom'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_GIVEAWAY_PATH,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_SECONDS,
} from '../../shared/worldCupBallGiveaway.mjs'
import { WORLD_CUP_BALL_SKILL_NOTICE } from '../../shared/worldCupBallGiveawayRules.mjs'
import { WorldCupBallPrizeFrame } from './WorldCupBallPrizeFrame'

/**
 * Free giveaways column card — World Cup Ball skill challenge.
 */
export function WorldCupBallGiveawayCard({ onEnter, className = '' }) {
  return (
    <article
      data-competition-card
      data-giveaway-card="world-cup-ball"
      className={`ss-world-cup-ball-card flex h-full w-full max-w-none flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-stone-950/90 shadow-[0_18px_52px_rgba(0,0,0,0.42)] ${className}`}
    >
      <div className="ss-world-cup-ball-card__hero relative px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <p className="absolute left-5 top-5 z-[2] rounded-full border border-amber-300/40 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100 backdrop-blur-sm">
          Free · Skill
        </p>
        <WorldCupBallPrizeFrame
          variant="compact"
          showChips={false}
          className="ss-world-cup-ball-card__frame mx-auto w-full max-w-[17.5rem]"
        />
      </div>

      <div className="ss-world-cup-ball-card__body flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3 text-left sm:px-8">
        <h3 className="ss-world-cup-ball-card__title font-display text-xl uppercase tracking-wide text-amber-50 sm:text-2xl">
          {WORLD_CUP_BALL_GIVEAWAY_LABEL}
        </h3>
        <p className="ss-world-cup-ball-card__summary mt-2 text-sm leading-relaxed text-stone-400">
          {WORLD_CUP_BALL_PRIZE_TITLE} — beat the clock, nail all {WORLD_CUP_BALL_QUESTION_COUNT} answers, take the ball home.
        </p>
        <div className="ss-world-cup-ball-card__pills mt-3 flex flex-wrap gap-1.5">
          <span className="ss-world-cup-ball-card__pill">{WORLD_CUP_BALL_QUESTION_COUNT} questions</span>
          <span className="ss-world-cup-ball-card__pill">{WORLD_CUP_BALL_QUESTION_SECONDS}s per answer</span>
          <span className="ss-world-cup-ball-card__pill ss-world-cup-ball-card__pill--gold">Win outright</span>
        </div>
        <p className="ss-world-cup-ball-card__notice mt-3 text-xs leading-relaxed text-amber-200/65">{WORLD_CUP_BALL_SKILL_NOTICE}</p>
        <div className="ss-world-cup-ball-card__actions mt-auto flex flex-col gap-2 pt-5">
          <button type="button" onClick={onEnter} className="ss-world-cup-ball-card__cta">
            Start timed quiz
          </button>
          <Link
            to={WORLD_CUP_BALL_GIVEAWAY_PATH}
            className="ss-world-cup-ball-card__rules text-center text-xs font-semibold text-amber-400/90 underline underline-offset-2 hover:text-amber-300"
          >
            Full rules &amp; how to win
          </Link>
        </div>
      </div>
    </article>
  )
}
