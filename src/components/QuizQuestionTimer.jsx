import { useEffect, useRef } from 'react'
import { playClockTick, speakFiveSecondsWarning } from '../lib/quizTimerFeedback'

/**
 * Centered per-question countdown with clock ticks and a spoken warning at 5 seconds.
 */
export function QuizQuestionTimer({
  secondsLeft,
  label,
  bonusActive = false,
  enabled = true,
}) {
  const prevSecondsRef = useRef(secondsLeft)
  const fiveSecondSpokenRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const prev = prevSecondsRef.current
    if (secondsLeft > prev) {
      fiveSecondSpokenRef.current = false
    }

    if (secondsLeft < prev && secondsLeft >= 0) {
      playClockTick({ accent: secondsLeft <= 3 })
      if (secondsLeft === 5 && !fiveSecondSpokenRef.current && !bonusActive) {
        fiveSecondSpokenRef.current = true
        speakFiveSecondsWarning()
      }
    }

    prevSecondsRef.current = secondsLeft
  }, [secondsLeft, enabled, bonusActive])

  const danger = secondsLeft <= 3
  const warning = secondsLeft <= 5 && secondsLeft > 3

  const valueClass = [
    'ss-wc-ball-quiz__timer-value',
    warning ? 'ss-wc-ball-quiz__timer-value--warning' : '',
    danger ? 'ss-wc-ball-quiz__timer-value--danger' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="ss-wc-ball-quiz__timer" aria-live="polite">
      {label ? <p className="ss-wc-ball-quiz__timer-label">{label}</p> : null}
      <div className="ss-wc-ball-quiz__timer-display">
        <span className={valueClass}>
          {bonusActive ? <span className="ss-wc-ball-quiz__timer-bonus-tag">Bonus</span> : null}
          {secondsLeft}
          <span className="ss-wc-ball-quiz__timer-unit">s</span>
        </span>
      </div>
    </div>
  )
}
