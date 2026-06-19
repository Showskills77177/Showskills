import {
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_SALVAGE_NOTICE,
  WORLD_CUP_BALL_SESSION_MAX_MINUTES,
} from './worldCupBallGiveaway.mjs'

/** Fixed practice question — not sent to the server and does not count. */
export const WORLD_CUP_BALL_PRACTICE_QUESTION = {
  prompt: 'Which nation has won the most FIFA World Cups?',
  choices: ['Brazil', 'Germany', 'Italy', 'Argentina'],
  correctAnswer: 'Brazil',
}

export const WORLD_CUP_BALL_PRACTICE_INTRO =
  'This practice question does not count. Use it to get used to the timer and how answers work before your real attempt.'

export const WORLD_CUP_BALL_PRACTICE_TIMER_TIP = `Each question has a ${WORLD_CUP_BALL_QUESTION_SECONDS}-second timer (top right). Answer before it hits zero.`

export const WORLD_CUP_BALL_PRACTICE_BONUS_TIP = `Run out of time once and you get a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second bonus on that question only — just like the real quiz.`

export const WORLD_CUP_BALL_PRACTICE_CHOICE_TIP =
  'Some real questions are multiple-choice with four options — tap one to answer instantly, as you did here.'

export const WORLD_CUP_BALL_PRACTICE_TYPING_TIP =
  'On typed questions in the real test, write your answer however you wish — lowercase, normal capitals, or ALL CAPS all count the same.'

export function worldCupBallPracticeCompleteTips({ timedOutOnce = false, answered = false } = {}) {
  const tips = [WORLD_CUP_BALL_PRACTICE_TIMER_TIP]
  if (timedOutOnce) {
    tips.push(WORLD_CUP_BALL_PRACTICE_BONUS_TIP)
  }
  if (answered) {
    tips.push(WORLD_CUP_BALL_PRACTICE_CHOICE_TIP)
  }
  tips.push(
    `The real test has ${WORLD_CUP_BALL_QUESTION_COUNT} questions and a ${WORLD_CUP_BALL_SESSION_MAX_MINUTES}-minute session limit.`,
    WORLD_CUP_BALL_PRACTICE_TYPING_TIP,
    WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
    WORLD_CUP_BALL_SALVAGE_NOTICE,
  )
  return tips
}
