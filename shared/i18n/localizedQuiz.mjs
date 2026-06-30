import { t as translate } from './translate.mjs'

/**
 * @param {string | null | undefined} locale
 * @param {{ questionKey: string, prompt: string, choices?: string[] }} question
 * @param {(key: string) => string} [tFn]
 */
export function localizeQuizQuestion(locale, question, tFn) {
  const t = tFn || ((key) => translate(locale, key))
  const key = question.questionKey
  const prompt = t(`wcBall.quiz.${key}.prompt`) || question.prompt
  const choices = Array.isArray(question.choices)
    ? question.choices.map((choice, i) => t(`wcBall.quiz.${key}.choice.${i}`) || choice)
    : undefined
  return { ...question, prompt, choices }
}
