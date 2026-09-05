import {
  RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL,
  RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS,
  RONALDO_SHIRT_QUIZ_QUESTION_COUNT,
  RONALDO_SHIRT_QUIZ_CHOICE_BONUS_NOTICE,
  RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE,
  RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES,
} from './ronaldoShirtQuiz.mjs'

export const RONALDO_SHIRT_QUIZ_MAX_PRACTICE_QUESTIONS = 3

/** Fixed practice questions — not sent to the server and do not count. */
export const RONALDO_SHIRT_QUIZ_PRACTICE_QUESTIONS = [
  {
    prompt: 'Which club did Cristiano Ronaldo join as a boy before moving to Sporting CP?',
    choices: ['Andorinha', 'Benfica', 'Porto', 'Boavista'],
    correctAnswer: 'Andorinha',
  },
  {
    prompt: 'Which country has Cristiano Ronaldo represented at international level?',
    choices: ['Portugal', 'Spain', 'Brazil', 'Argentina'],
    correctAnswer: 'Portugal',
  },
  {
    prompt: 'Which club signed Cristiano Ronaldo from Manchester United in 2009?',
    choices: ['Real Madrid', 'Barcelona', 'Juventus', 'Atletico Madrid'],
    correctAnswer: 'Real Madrid',
  },
]

/** Backward-compatible alias for code paths that expect a single item. */
export const RONALDO_SHIRT_QUIZ_PRACTICE_QUESTION = RONALDO_SHIRT_QUIZ_PRACTICE_QUESTIONS[0]

export const RONALDO_SHIRT_QUIZ_PRACTICE_INTRO =
  `Practice questions do not count. In the real test there is a ${RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL} — if the time-out expires, you get a ${RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS}-second extension on that question only. You can unlock up to ${RONALDO_SHIRT_QUIZ_MAX_PRACTICE_QUESTIONS - 1} more optional practice questions by watching another ad before your real attempt.`

export const RONALDO_SHIRT_QUIZ_PRACTICE_TIMER_TIP = `Each question has a ${RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL} (shown top right). Answer before the time-out expires.`

export const RONALDO_SHIRT_QUIZ_PRACTICE_BONUS_TIP = `If the time-out expires, you get a one-off ${RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS}-second extension on that question only — just like the real quiz. A second time-out on the same practice question ends that practice round.`

export const RONALDO_SHIRT_QUIZ_PRACTICE_CHOICE_TIP =
  'Some bonus questions in the real test use multiple-choice options — tap one to answer instantly, as you did here.'

export const RONALDO_SHIRT_QUIZ_PRACTICE_TYPING_TIP =
  'On typed questions in the real test, write your answer however you wish — lowercase, normal capitals, or ALL CAPS all count the same.'

export function ronaldoShirtQuizPracticeCompleteTips({ timedOutOnce = false, answered = false } = {}) {
  const tips = [RONALDO_SHIRT_QUIZ_PRACTICE_TIMER_TIP, RONALDO_SHIRT_QUIZ_PRACTICE_BONUS_TIP]
  if (timedOutOnce) {
    tips.push(`You saw the ${RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS}-second extension in action — that can happen up to twice per real attempt when a time-out expires.`)
  }
  if (answered) {
    tips.push(RONALDO_SHIRT_QUIZ_PRACTICE_CHOICE_TIP)
  }
  tips.push(
    `The real test has ${RONALDO_SHIRT_QUIZ_QUESTION_COUNT} questions and a ${RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES}-minute session limit.`,
    RONALDO_SHIRT_QUIZ_PRACTICE_TYPING_TIP,
    RONALDO_SHIRT_QUIZ_CHOICE_BONUS_NOTICE,
    RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE,
  )
  return tips
}
