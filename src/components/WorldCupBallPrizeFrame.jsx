import { WORLD_CUP_BALL_QUESTION_COUNT, WORLD_CUP_BALL_QUESTION_SECONDS } from '../../shared/worldCupBallGiveaway.mjs'
import { WorldCupBallPrizeImage } from './WorldCupBallPrizeImage'

const CHIPS = [
  { label: `${WORLD_CUP_BALL_QUESTION_COUNT} questions`, accent: 'gold' },
  { label: `${WORLD_CUP_BALL_QUESTION_SECONDS}s per answer`, accent: 'pitch' },
  { label: 'Win outright', accent: 'gold' },
]

/**
 * Framed prize photo — pitch backdrop, gold ring, optional stat chips.
 * @param {{ variant?: 'hero' | 'compact' | 'thumb', showChips?: boolean, className?: string }} props
 */
export function WorldCupBallPrizeFrame({
  variant = 'hero',
  showChips = variant !== 'thumb',
  className = '',
}) {
  const scale = variant === 'thumb' ? 'sm' : variant === 'compact' ? 'md' : 'lg'

  return (
    <div
      className={`ss-wc-ball-prize-frame ss-wc-ball-prize-frame--${variant} ${className}`.trim()}
    >
      <div className="ss-wc-ball-prize-frame__atmosphere" aria-hidden>
        <span className="ss-wc-ball-prize-frame__glow ss-wc-ball-prize-frame__glow--gold" />
        <span className="ss-wc-ball-prize-frame__glow ss-wc-ball-prize-frame__glow--pitch" />
        <span className="ss-wc-ball-prize-frame__pitch-lines" />
      </div>

      <div className="ss-wc-ball-prize-frame__ring">
        <div className="ss-wc-ball-prize-frame__inner">
          <WorldCupBallPrizeImage className="h-full w-full" scale={scale} />
        </div>
        <p className="ss-wc-ball-prize-frame__caption">Official-style World Cup ball</p>
      </div>

      {showChips ? (
        <ul className="ss-wc-ball-prize-frame__chips" aria-label="Challenge highlights">
          {CHIPS.map((chip) => (
            <li
              key={chip.label}
              className={`ss-wc-ball-prize-frame__chip ss-wc-ball-prize-frame__chip--${chip.accent}`}
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
