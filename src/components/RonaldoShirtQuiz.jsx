import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS,
  RONALDO_SHIRT_QUIZ_QUESTION_COUNT,
  RONALDO_SHIRT_QUIZ_QUESTION_SECONDS,
  RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES,
  RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS,
  RONALDO_SHIRT_QUIZ_CASE_INSENSITIVE_NOTICE,
  RONALDO_SHIRT_QUIZ_DONT_KNOW_ANSWER,
  RONALDO_SHIRT_QUIZ_DONT_KNOW_LABEL,
  RONALDO_SHIRT_QUIZ_CHOICE_BONUS_NOTICE,
  RONALDO_SHIRT_QUIZ_QUESTION_TIMING_NOTICE,
  RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL,
  RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE,
  RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE,
} from '../../shared/ronaldoShirtQuiz.mjs'
import { worldCupBallChoiceOptionLabel } from '../../shared/worldCupBallHistoricalChoices.mjs'
import {
  RONALDO_SHIRT_QUIZ_MAX_PRACTICE_QUESTIONS,
  RONALDO_SHIRT_QUIZ_PRACTICE_QUESTION,
  RONALDO_SHIRT_QUIZ_PRACTICE_QUESTIONS,
  RONALDO_SHIRT_QUIZ_PRACTICE_INTRO,
  RONALDO_SHIRT_QUIZ_PRACTICE_BONUS_TIP,
  RONALDO_SHIRT_QUIZ_PRACTICE_TIMER_TIP,
  RONALDO_SHIRT_QUIZ_PRACTICE_TYPING_TIP,
  ronaldoShirtQuizPracticeCompleteTips,
} from '../../shared/ronaldoShirtQuizPractice.mjs'
import { apiUrl } from '../lib/api'
import { QuizQuestionTimer } from './QuizQuestionTimer'
import VastVideoAdGate from './VastVideoAdGate'
import { localizeQuizQuestion } from '../../shared/i18n/localizedQuiz.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { primeQuizTimerAudio, speakBonusUsed } from '../lib/quizTimerFeedback'

const HILLTOPADS_VAST_TAG_URL = 'https://surefootedpause.com/dvm/F.z_dkGVN-v/Z/GrUA/xeOmQ9xuCZrUalEkPPmTTc/z/OtDpEj5vM/jYEDtfN/z/MP4/MyT/kIydNCQc'

function QuizDontKnowButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ss-wc-ball-quiz__dont-know-btn w-full rounded-lg border border-stone-600/80 bg-stone-900/50 py-2.5 text-sm font-semibold text-stone-400 transition hover:border-stone-500 hover:bg-stone-800/60 hover:text-stone-200 disabled:opacity-50"
    >
      {RONALDO_SHIRT_QUIZ_DONT_KNOW_LABEL}
    </button>
  )
}

/**
 * Timed 25-question skill quiz gate for the free Ronaldo shirt giveaway.
 *
 * Same HilltopAds VAST video ad gate as the World Cup Ball quiz, plus up to
 * 3 practice questions (each behind an ad watch — the first is mandatory,
 * two more are optional) so users can see how the timer/bonus rules work
 * before their real, scored attempt starts.
 *
 * Simplification versus the World Cup Ball quiz this is adapted from (kept
 * intentionally out of scope for this giveaway): no captcha widget and no
 * resume-after-refresh persistence — a page refresh mid-quiz simply requires
 * starting a fresh attempt (practice included).
 *
 * @param {{ onResult: (result: object) => void, onError: (msg: string) => void, onPhaseChange?: (phase: string) => void, disabled?: boolean }} props
 */
export function RonaldoShirtQuiz({ onResult, onError, onPhaseChange, disabled = false }) {
  const { locale, t } = useSiteLocale()
  const [phase, setPhase] = useState('idle')
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [timeoutsUsed, setTimeoutsUsed] = useState(0)
  const [bonusActive, setBonusActive] = useState(false)
  const [questionSeconds, setQuestionSeconds] = useState(RONALDO_SHIRT_QUIZ_QUESTION_SECONDS)
  const [timeoutBonusSeconds, setTimeoutBonusSeconds] = useState(RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS)
  const [maxTimeouts, setMaxTimeouts] = useState(RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS)
  const [sessionDeadlineMs, setSessionDeadlineMs] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(RONALDO_SHIRT_QUIZ_QUESTION_SECONDS)
  const [submitting, setSubmitting] = useState(false)
  const [salvageQuestion, setSalvageQuestion] = useState(null)
  const [salvageRound, setSalvageRound] = useState(0)
  const [practiceSecondsLeft, setPracticeSecondsLeft] = useState(RONALDO_SHIRT_QUIZ_QUESTION_SECONDS)
  const [practiceBonusActive, setPracticeBonusActive] = useState(false)
  const [practiceTimeouts, setPracticeTimeouts] = useState(0)
  const [practiceSummary, setPracticeSummary] = useState({ timedOutOnce: false, answered: false })
  const [practiceAttemptsUsed, setPracticeAttemptsUsed] = useState(0)
  const [activePracticeIndex, setActivePracticeIndex] = useState(0)
  const disqualifiedRef = useRef(false)
  const answersRef = useRef({})
  const practiceCompletedRef = useRef(false)

  const activePracticeQuestion =
    RONALDO_SHIRT_QUIZ_PRACTICE_QUESTIONS[
      Math.min(activePracticeIndex, RONALDO_SHIRT_QUIZ_PRACTICE_QUESTIONS.length - 1)
    ] || RONALDO_SHIRT_QUIZ_PRACTICE_QUESTION

  const practiceChoices = useMemo(() => {
    const list = [...activePracticeQuestion.choices]
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [activePracticeQuestion])

  const q = questions[index]
  const localizedQ = useMemo(() => (q ? localizeQuizQuestion(locale, q, t) : null), [locale, q, t])
  const localizedSalvage = useMemo(
    () => (salvageQuestion ? localizeQuizQuestion(locale, salvageQuestion, t) : null),
    [locale, salvageQuestion, t],
  )
  const shuffledChoices = useMemo(() => {
    if (!localizedQ?.choices?.length) return []
    const list = [...localizedQ.choices]
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [localizedQ?.questionKey, localizedQ?.choices])

  const resetTimer = useCallback(
    (bonus, perQuestionSeconds = questionSeconds) => {
      setSecondsLeft(bonus ? timeoutBonusSeconds : perQuestionSeconds)
      setBonusActive(Boolean(bonus))
    },
    [questionSeconds, timeoutBonusSeconds],
  )

  const deliverQuizResult = useCallback(
    (data) => {
      onResult({
        result: data.result,
        allCorrect: data.allCorrect,
        disqualified: data.disqualified,
        passToken: data.passToken || null,
        passTokenGraceMinutes: data.passTokenGraceMinutes || null,
        wrongReview: Array.isArray(data.wrongReview) ? data.wrongReview : [],
        salvageCorrect: data.salvageCorrect,
        earlyExit: Boolean(data.earlyExit),
        sessionId,
      })
    },
    [onResult, sessionId],
  )

  const finishQuiz = useCallback(
    async (finalAnswers, finalTimeouts, isDisqualified) => {
      if (!sessionId || submitting) return
      setSubmitting(true)
      setPhase('submitting')
      try {
        const res = await fetch(apiUrl('/api/submissions/ronaldo-shirt-quiz/submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            answers: finalAnswers,
            timeoutsUsed: finalTimeouts,
            disqualified: isDisqualified,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          onError(typeof data.error === 'string' ? data.error : 'Could not submit your answers.')
          setPhase('active')
          setSubmitting(false)
          return
        }
        if (data.result === 'salvage_bonus' && data.salvageQuestion) {
          setSalvageQuestion(data.salvageQuestion)
          setSalvageRound((n) => n + 1)
          setCurrentAnswer('')
          setPhase('salvage')
          resetTimer(false)
          setSubmitting(false)
          return
        }
        deliverQuizResult(data)
      } catch {
        onError('Could not submit your answers. Check your connection and try again.')
        setPhase('active')
      } finally {
        setSubmitting(false)
      }
    },
    [sessionId, submitting, onError, resetTimer, deliverQuizResult],
  )

  const submitSalvageAnswer = useCallback(
    async (answerText) => {
      if (!sessionId || submitting || !salvageQuestion) return
      setSubmitting(true)
      setPhase('submitting')
      try {
        const res = await fetch(apiUrl('/api/submissions/ronaldo-shirt-quiz/submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            salvageAnswer: answerText.trim(),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          onError(typeof data.error === 'string' ? data.error : 'Could not submit your bonus answer.')
          setPhase('salvage')
          setSubmitting(false)
          return
        }
        if (data.result === 'salvage_bonus' && data.salvageQuestion) {
          setSalvageQuestion(data.salvageQuestion)
          setSalvageRound((n) => n + 1)
          setCurrentAnswer('')
          setPhase('salvage')
          resetTimer(false)
          setSubmitting(false)
          return
        }
        deliverQuizResult(data)
      } catch {
        onError('Could not submit your bonus answer. Check your connection and try again.')
        setPhase('salvage')
      } finally {
        setSubmitting(false)
      }
    },
    [sessionId, submitting, salvageQuestion, onError, deliverQuizResult, resetTimer],
  )

  const advanceQuestion = useCallback(
    async (answerText) => {
      if (disqualifiedRef.current || phase !== 'active' || submitting) return
      const current = questions[index]
      if (!current) return
      const nextAnswers = { ...answersRef.current, [current.questionKey]: answerText.trim() }
      answersRef.current = nextAnswers

      if (index >= questions.length - 1) {
        void finishQuiz(nextAnswers, timeoutsUsed, false)
        return
      }

      const nextIndex = index + 1
      setCurrentAnswer('')
      setIndex(nextIndex)
      resetTimer(false)
    },
    [index, questions, phase, submitting, timeoutsUsed, finishQuiz, resetTimer],
  )

  const handleTimeout = useCallback(() => {
    if (disqualifiedRef.current || phase !== 'active') return
    if (timeoutsUsed >= maxTimeouts) {
      disqualifiedRef.current = true
      void finishQuiz(answersRef.current, timeoutsUsed + 1, true)
      return
    }
    const nextTimeouts = timeoutsUsed + 1
    setTimeoutsUsed(nextTimeouts)
    resetTimer(true)
    speakBonusUsed()
  }, [phase, timeoutsUsed, maxTimeouts, finishQuiz, resetTimer])

  const startQuiz = async () => {
    if (disabled || submitting) return
    primeQuizTimerAudio()
    setPhase('loading')
    onError('')
    try {
      const res = await fetch(apiUrl('/api/submissions/ronaldo-shirt-quiz/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const apiOffline =
          res.status >= 500 && !data.error
            ? ' Could not reach the API — if you are developing locally, run npm run dev:all (or npm run dev:api in a second terminal).'
            : ''
        onError(typeof data.error === 'string' ? data.error : `Could not start the quiz.${apiOffline}`)
        setPhase(practiceCompletedRef.current ? 'practice_complete' : 'idle')
        return
      }
      const questionList = Array.isArray(data.questions) ? data.questions : []
      const perQ = data.questionSeconds || RONALDO_SHIRT_QUIZ_QUESTION_SECONDS
      const bonus = data.timeoutBonusSeconds || RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS
      const allowed = Number.isFinite(data.maxTimeouts) ? data.maxTimeouts : RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS
      const maxMinutes = data.sessionMaxMinutes || RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES
      const startedAt = data.startedAt || new Date().toISOString()

      setSessionId(data.sessionId)
      setQuestions(questionList)
      setQuestionSeconds(perQ)
      setTimeoutBonusSeconds(bonus)
      setMaxTimeouts(allowed)
      setSessionDeadlineMs(new Date(startedAt).getTime() + maxMinutes * 60 * 1000)
      disqualifiedRef.current = false
      answersRef.current = {}
      setIndex(0)
      setTimeoutsUsed(0)
      setCurrentAnswer('')
      setSalvageQuestion(null)
      setSalvageRound(0)
      resetTimer(false, perQ)
      setPhase('active')
    } catch {
      onError(
        'Could not reach the server. If you are developing locally, run npm run dev:all (or npm run dev:api in a second terminal).',
      )
      setPhase(practiceCompletedRef.current ? 'practice_complete' : 'idle')
    }
  }

  const startPractice = () => {
    if (disabled) return
    if (practiceAttemptsUsed >= RONALDO_SHIRT_QUIZ_MAX_PRACTICE_QUESTIONS) return
    primeQuizTimerAudio()
    onError('')
    const nextPracticeIndex = Math.min(
      practiceAttemptsUsed,
      RONALDO_SHIRT_QUIZ_PRACTICE_QUESTIONS.length - 1,
    )
    setActivePracticeIndex(nextPracticeIndex)
    setPracticeAttemptsUsed((count) =>
      Math.min(count + 1, RONALDO_SHIRT_QUIZ_MAX_PRACTICE_QUESTIONS),
    )
    setPracticeSecondsLeft(RONALDO_SHIRT_QUIZ_QUESTION_SECONDS)
    setPracticeBonusActive(false)
    setPracticeTimeouts(0)
    setPracticeSummary({ timedOutOnce: false, answered: false })
    setPhase('practice')
  }

  const finishPractice = (answered) => {
    practiceCompletedRef.current = true
    setPracticeSummary({
      timedOutOnce: practiceTimeouts > 0,
      answered: Boolean(answered),
    })
    setPhase('practice_complete')
  }

  const handleSubmitAnswer = (e) => {
    e.preventDefault()
    if (!currentAnswer.trim()) return
    void advanceQuestion(currentAnswer)
  }

  useEffect(() => {
    if (phase !== 'active' || disabled || !sessionDeadlineMs) return undefined
    const tick = () => {
      const left = Math.max(0, Math.ceil((sessionDeadlineMs - Date.now()) / 1000))
      if (left <= 0 && !disqualifiedRef.current && !submitting) {
        disqualifiedRef.current = true
        void finishQuiz(answersRef.current, timeoutsUsed, true)
      }
    }
    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [phase, disabled, sessionDeadlineMs, finishQuiz, timeoutsUsed, submitting])

  useEffect(() => {
    if (phase !== 'practice' || disabled) return undefined
    if (practiceSecondsLeft <= 0) {
      if (practiceTimeouts >= RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS) {
        practiceCompletedRef.current = true
        setPracticeSummary({ timedOutOnce: true, answered: false })
        setPhase('practice_complete')
        return undefined
      }
      setPracticeTimeouts((count) => count + 1)
      setPracticeBonusActive(true)
      setPracticeSecondsLeft(RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS)
      speakBonusUsed()
      return undefined
    }
    const t = window.setTimeout(() => setPracticeSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [phase, practiceSecondsLeft, practiceTimeouts, disabled])

  useEffect(() => {
    if ((phase !== 'active' && phase !== 'salvage') || disabled) return undefined
    if (secondsLeft <= 0) {
      if (phase === 'salvage') {
        void submitSalvageAnswer('')
        return undefined
      }
      handleTimeout()
      return undefined
    }
    const t = window.setTimeout(() => {
      setSecondsLeft((s) => s - 1)
    }, 1000)
    return () => window.clearTimeout(t)
  }, [phase, secondsLeft, handleTimeout, disabled, submitSalvageAnswer])

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  const quizShellClass = `ss-wc-ball-quiz ss-wc-ball-quiz--${phase}`

  if (phase === 'idle') {
    return (
      <div className={quizShellClass}>
        <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-stone-300">
            Pass this free {RONALDO_SHIRT_QUIZ_QUESTION_COUNT}-question football skill quiz to unlock the shirt
            giveaway entry form. {RONALDO_SHIRT_QUIZ_QUESTION_TIMING_NOTICE} {RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE}
          </p>
          <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2.5 text-xs leading-relaxed text-amber-100/85">
            {RONALDO_SHIRT_QUIZ_PRACTICE_INTRO}
          </p>
          <p className="rounded-lg border border-red-500/40 bg-red-950/25 px-3 py-2.5 text-xs font-semibold leading-relaxed text-red-100">
            You must watch the ad video in full to unlock the practice question — there is no skip, close, or bypass
            option.
          </p>
          <p className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-3 py-2.5 text-xs leading-relaxed text-sky-100/90">
            Please be patient while the ad loads and plays — some ads run for over a minute. We show these ads to
            help fund the rewards, so thank you for bearing with us.
          </p>
          <VastVideoAdGate
            vastTagUrl={HILLTOPADS_VAST_TAG_URL}
            onUnlocked={() => startPractice()}
            disabled={disabled}
          />
        </div>
      </div>
    )
  }

  if (phase === 'practice') {
    return (
      <div className={quizShellClass}>
        <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
          <div className="ss-wc-ball-quiz__intro rounded-xl border border-teal-500/30 bg-teal-950/25 px-4 py-3 text-sm text-teal-50/95">
            <p className="font-semibold text-teal-100">Practice — not counted</p>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-300">{RONALDO_SHIRT_QUIZ_PRACTICE_INTRO}</p>
            <p className="mt-2 text-xs leading-relaxed text-teal-100/85">{RONALDO_SHIRT_QUIZ_PRACTICE_TIMER_TIP}</p>
            <p className="mt-2 rounded-md border border-amber-400/35 bg-amber-950/30 px-2.5 py-2 text-xs font-semibold leading-relaxed text-amber-100/95">
              {RONALDO_SHIRT_QUIZ_PRACTICE_BONUS_TIP}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-teal-100/85">{RONALDO_SHIRT_QUIZ_PRACTICE_TYPING_TIP}</p>
          </div>
          <QuizQuestionTimer
            secondsLeft={practiceSecondsLeft}
            label={`Practice · ${RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL}`}
            bonusActive={practiceBonusActive}
            enabled={!disabled}
          />
          {practiceBonusActive ? (
            <p className="ss-wc-ball-quiz__bonus-note rounded-lg border border-amber-400/40 bg-amber-950/35 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-50">
              <strong className="text-amber-200">+{RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS} second extension active.</strong> Answer
              now — in the real quiz you only get this twice per attempt.
            </p>
          ) : null}
          <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Multiple choice</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
              Tap one option below before the time-out expires.
            </p>
          </div>
          <p className="ss-wc-ball-quiz__prompt text-stone-100">{activePracticeQuestion.prompt}</p>
          <div className="ss-wc-ball-quiz__choices grid grid-cols-2 gap-2 lg:grid-cols-3">
            {practiceChoices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => finishPractice(true)}
                className="ss-wc-ball-quiz__choice-btn rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-left text-sm font-semibold text-amber-50 transition hover:border-amber-400/55 hover:bg-amber-900/40"
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'practice_complete') {
    const tips = ronaldoShirtQuizPracticeCompleteTips(practiceSummary)
    const canUnlockNextPractice = practiceAttemptsUsed < RONALDO_SHIRT_QUIZ_MAX_PRACTICE_QUESTIONS
    return (
      <div className={quizShellClass}>
        <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-4 text-sm text-emerald-50/95">
            <p className="font-semibold text-emerald-100">Practice complete</p>
            <p className="mt-2 text-xs leading-relaxed text-stone-300">
              Good — you have seen how the time-out works. Your real attempt starts when you press the button below.
            </p>
            <ul className="ss-wc-ball-quiz__practice-tips mt-3 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-stone-300">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
          {canUnlockNextPractice ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-50/95">
              <p className="text-xs leading-relaxed text-amber-100/90">
                Want another practice question before the real test? Watch another short ad to unlock it.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/70">
                Some ads run over a minute — thanks for your patience, this helps fund the rewards.
              </p>
              <div className="mt-3">
                <VastVideoAdGate
                  vastTagUrl={HILLTOPADS_VAST_TAG_URL}
                  onUnlocked={() => startPractice()}
                  disabled={disabled || submitting}
                />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void startQuiz()}
            disabled={disabled || submitting}
            className="ss-wc-ball-quiz__primary-btn w-full rounded-xl bg-gradient-to-r from-lime-600 to-emerald-600 py-3 text-sm font-bold text-stone-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start test ({RONALDO_SHIRT_QUIZ_QUESTION_COUNT} questions · {RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL} each)
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <div className={quizShellClass}>
        <p className="text-sm text-stone-400">
          {phase === 'loading' ? 'Preparing your quiz…' : 'Checking your answers…'}
        </p>
      </div>
    )
  }

  if (phase === 'salvage' && salvageQuestion && localizedSalvage) {
    const salvageChoices = Array.isArray(localizedSalvage.choices) ? [...localizedSalvage.choices] : []
    for (let i = salvageChoices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[salvageChoices[i], salvageChoices[j]] = [salvageChoices[j], salvageChoices[i]]
    }
    const hasSalvageChoices = salvageChoices.length > 0

    return (
      <div className={quizShellClass}>
        <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
          <div className="ss-wc-ball-quiz__salvage-banner rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-50/95">
            <p className="font-semibold text-amber-100">
              Bonus salvage question {salvageRound} of {RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE}
            </p>
            <p className="mt-2 text-stone-300">{RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE}</p>
          </div>
          <QuizQuestionTimer
            secondsLeft={secondsLeft}
            label={`Salvage · ${RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL}`}
            enabled={!disabled && !submitting}
          />
          {hasSalvageChoices ? (
            <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Bonus question</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/85">Pick the correct option below.</p>
            </div>
          ) : null}
          <p className="ss-wc-ball-quiz__prompt text-stone-100">{localizedSalvage.prompt}</p>
          {hasSalvageChoices ? (
            <div className="ss-wc-ball-quiz__choices grid grid-cols-2 gap-2 lg:grid-cols-3">
              {salvageChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitSalvageAnswer(choice)}
                  className="ss-wc-ball-quiz__choice-btn rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-left text-sm font-semibold text-amber-50 transition hover:border-amber-400/55 hover:bg-amber-900/40 disabled:opacity-50"
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (!currentAnswer.trim()) return
                void submitSalvageAnswer(currentAnswer)
              }}
            >
              <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Type your answer</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{RONALDO_SHIRT_QUIZ_CASE_INSENSITIVE_NOTICE}</p>
              </div>
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                className="ss-entry-field ss-quiz-answer-field w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
                placeholder="Type your answer (any capitals OK)"
                disabled={submitting}
              />
              <QuizDontKnowButton
                disabled={submitting}
                onClick={() => void submitSalvageAnswer(RONALDO_SHIRT_QUIZ_DONT_KNOW_ANSWER)}
              />
              <button
                type="submit"
                disabled={!currentAnswer.trim() || submitting}
                className="w-full rounded-xl border border-amber-500/40 bg-amber-950/40 py-3 text-sm font-bold text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
              >
                Submit salvage answer
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  const total = questions.length || RONALDO_SHIRT_QUIZ_QUESTION_COUNT
  const hasChoices = shuffledChoices.length > 0

  return (
    <div className={quizShellClass}>
      <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
        <QuizQuestionTimer
          secondsLeft={secondsLeft}
          label={`Question ${index + 1} of ${total} · ${RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL}`}
          bonusActive={bonusActive}
          enabled={!disabled && !submitting}
        />
        {bonusActive ? (
          <p className="ss-wc-ball-quiz__bonus-note rounded-lg border border-amber-400/40 bg-amber-950/35 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-50">
            <strong className="text-amber-200">+{RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS} second extension active.</strong>{' '}
            The time-out expired on this question — answer now. You have {maxTimeouts} extensions per attempt; one
            more time-out after they run out disqualifies you.
          </p>
        ) : null}
        {hasChoices ? (
          <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Multiple choice</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
              Pick one of the {worldCupBallChoiceOptionLabel(shuffledChoices.length)} below — you do not need to type
              an answer on this question.
            </p>
          </div>
        ) : (
          <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Type your answer</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{RONALDO_SHIRT_QUIZ_CASE_INSENSITIVE_NOTICE}</p>
          </div>
        )}
        <p className="ss-wc-ball-quiz__prompt text-stone-100">{localizedQ?.prompt}</p>
        {hasChoices ? (
          <div className="ss-wc-ball-quiz__choices grid grid-cols-2 gap-2 lg:grid-cols-3">
            {shuffledChoices.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={submitting}
                onClick={() => void advanceQuestion(choice)}
                className="ss-wc-ball-quiz__choice-btn rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-left text-sm font-semibold text-amber-50 transition hover:border-amber-400/55 hover:bg-amber-900/40 disabled:opacity-50"
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmitAnswer}>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="ss-entry-field ss-quiz-answer-field w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
              placeholder="Type your answer (any capitals OK)"
              disabled={submitting}
            />
            <QuizDontKnowButton
              disabled={submitting}
              onClick={() => void advanceQuestion(RONALDO_SHIRT_QUIZ_DONT_KNOW_ANSWER)}
            />
            <button
              type="submit"
              disabled={!currentAnswer.trim() || submitting}
              className="w-full rounded-xl border border-amber-500/40 bg-amber-950/40 py-3 text-sm font-bold text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
            >
              {index >= total - 1 ? 'Submit final answer' : 'Next question'}
            </button>
          </form>
        )}
        <p className="ss-wc-ball-quiz__footer-note text-xs leading-relaxed text-stone-500">
          {RONALDO_SHIRT_QUIZ_CHOICE_BONUS_NOTICE} {RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE} You have{' '}
          {RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES} minutes to finish the full quiz.
        </p>
      </div>
    </div>
  )
}
