import {
  WORLD_CUP_BALL_QUESTION_TIMING_SHORT,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_SALVAGE_NOTICE,
  WORLD_CUP_BALL_SESSION_MAX_MINUTES,
} from './worldCupBallGiveaway.mjs'

export const WORLD_CUP_BALL_MAX_PRACTICE_QUESTIONS = 2

/** Fixed practice questions — not sent to the server and do not count. */
export const WORLD_CUP_BALL_PRACTICE_QUESTIONS = [
  {
    prompt: 'Which nation has won the most FIFA World Cups?',
    choices: ['Brazil', 'Germany', 'Italy', 'Argentina'],
    correctAnswer: 'Brazil',
  },
  {
    prompt: 'Which player won the Golden Ball at the 2022 FIFA World Cup?',
    choices: ['Lionel Messi', 'Kylian Mbappe', 'Luka Modric', 'Antoine Griezmann'],
    correctAnswer: 'Lionel Messi',
  },
]

/** Backward-compatible alias for code paths that still expect a single item. */
export const WORLD_CUP_BALL_PRACTICE_QUESTION = WORLD_CUP_BALL_PRACTICE_QUESTIONS[0]

export const WORLD_CUP_BALL_PRACTICE_INTRO =
  `Practice questions do not count. In the real test there is a ${WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION} — if the time-out expires once, you get a ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second extension on that question only. You can unlock one optional second practice question by watching another ad before your real attempt.`

export const WORLD_CUP_BALL_PRACTICE_TIMER_TIP = `Each question has a ${WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL} (shown top right). Answer before the time-out expires.`

export const WORLD_CUP_BALL_PRACTICE_BONUS_TIP = `If the time-out expires, you get a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second extension on that question only — just like the real quiz. A second time-out on any question ends your attempt.`

export const WORLD_CUP_BALL_PRACTICE_CHOICE_TIP =
  'Historical questions (1980 and earlier) use six multiple-choice options; some newer bonus questions use four — tap one to answer instantly, as you did here.'

export const WORLD_CUP_BALL_PRACTICE_TYPING_TIP =
  'On typed questions in the real test, write your answer however you wish — lowercase, normal capitals, or ALL CAPS all count the same.'

export function worldCupBallPracticeCompleteTips({ timedOutOnce = false, answered = false } = {}) {
  const tips = [WORLD_CUP_BALL_PRACTICE_TIMER_TIP, WORLD_CUP_BALL_PRACTICE_BONUS_TIP]
  if (timedOutOnce) {
    tips.push(`You saw the ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second extension in action — that happens once per real attempt when a time-out expires.`)
  }
  if (answered) {
    tips.push(WORLD_CUP_BALL_PRACTICE_CHOICE_TIP)
  }
  tips.push(
    `${WORLD_CUP_BALL_QUESTION_TIMING_SHORT} The real test has ${WORLD_CUP_BALL_QUESTION_COUNT} questions and a ${WORLD_CUP_BALL_SESSION_MAX_MINUTES}-minute session limit.`,
    WORLD_CUP_BALL_PRACTICE_TYPING_TIP,
    WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
    WORLD_CUP_BALL_SALVAGE_NOTICE,
  )
  return tips
}
