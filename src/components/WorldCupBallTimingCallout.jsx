import {
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION,
  WORLD_CUP_BALL_TIMEOUT_BONUS_PROMINENT,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
} from '../../shared/worldCupBallGiveaway.mjs'

function WorldCupBallTimingClockIcon() {
  return (
    <svg
      className="ss-wc-ball-timing-callout__clock-svg"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <path
        d="M12 12V6.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 12L16.1 14.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 3V1.5M12 22.5V21M3 12H1.5M22.5 12H21"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

/**
 * Prominent timing highlight for marketing surfaces — 15-second time-out per question + extension.
 * @param {{ className?: string }} props
 */
export function WorldCupBallTimingCallout({ className = '' }) {
  return (
    <div
      className={`ss-wc-ball-timing-callout ${className}`.trim()}
      role="note"
      aria-label={`${WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION}. ${WORLD_CUP_BALL_TIMEOUT_BONUS_PROMINENT}`}
    >
      <div className="ss-wc-ball-timing-callout__main">
        <span className="ss-wc-ball-timing-callout__clock" aria-hidden>
          <WorldCupBallTimingClockIcon />
        </span>
        <span className="ss-wc-ball-timing-callout__number">{WORLD_CUP_BALL_QUESTION_SECONDS}</span>
        <span className="ss-wc-ball-timing-callout__copy">
          <span className="ss-wc-ball-timing-callout__unit">second time-out</span>
          <span className="ss-wc-ball-timing-callout__per">per question</span>
        </span>
      </div>
      <p className="ss-wc-ball-timing-callout__bonus">
        <span className="ss-wc-ball-timing-callout__bonus-value">+{WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}s</span>
        <span className="ss-wc-ball-timing-callout__bonus-text">
          extension if the time-out expires — once per attempt, on that question only
        </span>
      </p>
    </div>
  )
}
