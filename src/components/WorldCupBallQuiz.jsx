import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WORLD_CUP_BALL_MAX_TIMEOUTS,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_SESSION_MAX_MINUTES,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
} from '../../shared/worldCupBallGiveaway.mjs'
import { apiUrl } from '../lib/api'
import {
  clearWorldCupBallQuizProgress,
  loadWorldCupBallQuizProgress,
  saveWorldCupBallQuizProgress,
} from '../lib/worldCupBallQuizProgress.mjs'

/**
 * Timed skill quiz for the World Cup Ball Giveaway.
 * @param {{ onResult: (result: object) => void, onError: (msg: string) => void, disabled?: boolean }} props
 */
export function WorldCupBallQuiz({ onResult, onError, disabled = false }) {
  const [phase, setPhase] = useState('idle')
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [timeoutsUsed, setTimeoutsUsed] = useState(0)
  const [bonusActive, setBonusActive] = useState(false)
  const [questionSeconds, setQuestionSeconds] = useState(WORLD_CUP_BALL_QUESTION_SECONDS)
  const [timeoutBonusSeconds, setTimeoutBonusSeconds] = useState(WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS)
  const [maxTimeouts, setMaxTimeouts] = useState(WORLD_CUP_BALL_MAX_TIMEOUTS)
  const [sessionDeadlineMs, setSessionDeadlineMs] = useState(null)
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(WORLD_CUP_BALL_QUESTION_SECONDS)
  const [submitting, setSubmitting] = useState(false)
  const disqualifiedRef = useRef(false)
  const answersRef = useRef({})

  const q = questions[index]
  const shuffledChoices = useMemo(() => {
    if (!q?.choices?.length) return []
    const list = [...q.choices]
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [q?.questionKey, q?.choices])

  const persistProgress = useCallback(
    (next) => {
      if (!sessionId) return
      saveWorldCupBallQuizProgress({
        sessionId,
        questions,
        index: next.index ?? index,
        answers: next.answers ?? answersRef.current,
        timeoutsUsed: next.timeoutsUsed ?? timeoutsUsed,
        bonusActive: next.bonusActive ?? bonusActive,
        secondsLeft: next.secondsLeft ?? secondsLeft,
        questionSeconds,
        timeoutBonusSeconds,
        maxTimeouts,
        sessionDeadlineMs,
        startedAt: next.startedAt,
      })
    },
    [
      sessionId,
      questions,
      index,
      timeoutsUsed,
      bonusActive,
      secondsLeft,
      questionSeconds,
      timeoutBonusSeconds,
      maxTimeouts,
      sessionDeadlineMs,
    ],
  )

  const resetTimer = useCallback(
    (bonus, perQuestionSeconds = questionSeconds) => {
      setSecondsLeft(bonus ? timeoutBonusSeconds : perQuestionSeconds)
      setBonusActive(Boolean(bonus))
    },
    [questionSeconds, timeoutBonusSeconds],
  )

  const finishQuiz = useCallback(
    async (finalAnswers, finalTimeouts, disqualified) => {
      if (!sessionId || submitting) return
      setSubmitting(true)
      setPhase('submitting')
      clearWorldCupBallQuizProgress()
      try {
        const res = await fetch(apiUrl('/api/submissions/world-cup-ball/submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            answers: finalAnswers,
            timeoutsUsed: finalTimeouts,
            disqualified,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          onError(typeof data.error === 'string' ? data.error : 'Could not submit your answers.')
          setPhase('idle')
          setSubmitting(false)
          return
        }
        onResult({
          result: data.result,
          allCorrect: data.allCorrect,
          disqualified: data.disqualified,
          claimToken: data.claimToken || null,
        })
      } catch {
        onError('Could not submit your answers. Check your connection and try again.')
        setPhase('idle')
      } finally {
        setSubmitting(false)
      }
    },
    [sessionId, submitting, onResult, onError],
  )

  const advanceQuestion = useCallback(
    (answerText) => {
      if (disqualifiedRef.current || phase !== 'active') return
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
      persistProgress({ index: nextIndex, answers: nextAnswers, bonusActive: false, secondsLeft: questionSeconds })
    },
    [index, questions, phase, timeoutsUsed, finishQuiz, resetTimer, persistProgress, questionSeconds],
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
    persistProgress({ timeoutsUsed: nextTimeouts, bonusActive: true, secondsLeft: timeoutBonusSeconds })
  }, [phase, timeoutsUsed, maxTimeouts, finishQuiz, resetTimer, persistProgress, timeoutBonusSeconds])

  const activateSession = useCallback(
    ({
      id,
      questionList,
      startedAt,
      perQuestionSeconds,
      bonusSeconds,
      allowedTimeouts,
      sessionMaxMinutes,
      resumeProgress,
    }) => {
      const maxMinutes = sessionMaxMinutes || WORLD_CUP_BALL_SESSION_MAX_MINUTES
      const deadlineMs = new Date(startedAt).getTime() + maxMinutes * 60 * 1000
      const perQ = perQuestionSeconds || WORLD_CUP_BALL_QUESTION_SECONDS
      const bonus = bonusSeconds || WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS
      const allowed = Number.isFinite(allowedTimeouts) ? allowedTimeouts : WORLD_CUP_BALL_MAX_TIMEOUTS

      setSessionId(id)
      setQuestions(questionList)
      setQuestionSeconds(perQ)
      setTimeoutBonusSeconds(bonus)
      setMaxTimeouts(allowed)
      setSessionDeadlineMs(deadlineMs)
      disqualifiedRef.current = false

      if (resumeProgress && resumeProgress.sessionId === id) {
        answersRef.current = resumeProgress.answers || {}
        setIndex(resumeProgress.index || 0)
        setTimeoutsUsed(resumeProgress.timeoutsUsed || 0)
        setBonusActive(Boolean(resumeProgress.bonusActive))
        setSecondsLeft(
          Number.isFinite(resumeProgress.secondsLeft)
            ? resumeProgress.secondsLeft
            : resumeProgress.bonusActive
              ? bonus
              : perQ,
        )
      } else {
        answersRef.current = {}
        setIndex(0)
        setTimeoutsUsed(0)
        setCurrentAnswer('')
        resetTimer(false, perQ)
      }

      setPhase('active')

      saveWorldCupBallQuizProgress({
        sessionId: id,
        questions: questionList,
        index: resumeProgress?.index || 0,
        answers: resumeProgress?.answers || {},
        timeoutsUsed: resumeProgress?.timeoutsUsed || 0,
        bonusActive: resumeProgress?.bonusActive || false,
        secondsLeft: resumeProgress?.secondsLeft || perQ,
        questionSeconds: perQ,
        timeoutBonusSeconds: bonus,
        maxTimeouts: allowed,
        sessionDeadlineMs: deadlineMs,
        startedAt,
      })
    },
    [resetTimer],
  )

  useEffect(() => {
    if (phase !== 'active' || disabled || !sessionDeadlineMs) return undefined
    const tick = () => {
      const left = Math.max(0, Math.ceil((sessionDeadlineMs - Date.now()) / 1000))
      setSessionSecondsLeft(left)
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
    if (phase !== 'active' || disabled) return undefined
    if (secondsLeft <= 0) {
      handleTimeout()
      return undefined
    }
    const t = window.setTimeout(() => {
      setSecondsLeft((s) => {
        const next = s - 1
        persistProgress({ secondsLeft: next })
        return next
      })
    }, 1000)
    return () => window.clearTimeout(t)
  }, [phase, secondsLeft, handleTimeout, disabled, persistProgress])

  const startQuiz = async () => {
    if (disabled || submitting) return
    setPhase('loading')
    onError('')
    try {
      const res = await fetch(apiUrl('/api/submissions/world-cup-ball/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const apiOffline =
          res.status >= 500 && !data.error
            ? ' Could not reach the API — if you are developing locally, run npm run dev:all (or npm run dev:api in a second terminal).'
            : ''
        onError(
          typeof data.error === 'string' ? data.error : `Could not start the quiz.${apiOffline}`,
        )
        setPhase('idle')
        return
      }
      const questionList = Array.isArray(data.questions) ? data.questions : []
      if (!data.resumed) clearWorldCupBallQuizProgress()
      const saved = loadWorldCupBallQuizProgress()
      const resumeProgress = data.resumed && saved?.sessionId === data.sessionId ? saved : null

      activateSession({
        id: data.sessionId,
        questionList,
        startedAt: data.startedAt || new Date().toISOString(),
        perQuestionSeconds: data.questionSeconds,
        bonusSeconds: data.timeoutBonusSeconds,
        allowedTimeouts: data.maxTimeouts,
        sessionMaxMinutes: data.sessionMaxMinutes,
        resumeProgress,
      })
    } catch {
      onError(
        'Could not reach the server. If you are developing locally, run npm run dev:all (or npm run dev:api in a second terminal).',
      )
      setPhase('idle')
    }
  }

  const handleSubmitAnswer = (e) => {
    e.preventDefault()
    if (!currentAnswer.trim()) return
    advanceQuestion(currentAnswer)
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-stone-400">{WORLD_CUP_BALL_CHOICE_BONUS_NOTICE}</p>
        <button
          type="button"
          onClick={() => void startQuiz()}
          disabled={disabled}
          className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-stone-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start timed quiz ({WORLD_CUP_BALL_QUESTION_COUNT} questions)
        </button>
      </div>
    )
  }

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <p className="text-sm text-stone-400">
        {phase === 'loading' ? 'Preparing your quiz…' : 'Checking your answers…'}
      </p>
    )
  }

  const total = questions.length || WORLD_CUP_BALL_QUESTION_COUNT
  const hasChoices = shuffledChoices.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-sm">
        <span className="font-semibold text-amber-100">
          Question {index + 1} of {total}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {sessionSecondsLeft != null ? (
            <span
              className={`font-mono text-xs tabular-nums ${sessionSecondsLeft <= 60 ? 'text-red-400' : 'text-stone-400'}`}
              aria-live="polite"
            >
              Session {Math.floor(sessionSecondsLeft / 60)}:
              {String(sessionSecondsLeft % 60).padStart(2, '0')}
            </span>
          ) : null}
          <span
            className={`font-mono tabular-nums ${secondsLeft <= 5 ? 'text-red-400' : 'text-amber-200'}`}
            aria-live="polite"
          >
            {bonusActive ? 'Bonus: ' : ''}
            {secondsLeft}s
          </span>
        </div>
      </div>
      {hasChoices ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Bonus question</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
            Pick one of the four options below — you do not need to type an answer on this question.
          </p>
        </div>
      ) : null}
      <p className="text-base font-medium leading-snug text-stone-100">{q?.prompt}</p>
      {hasChoices ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {shuffledChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={submitting}
              onClick={() => advanceQuestion(choice)}
              className="rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-left text-sm font-semibold text-amber-50 transition hover:border-amber-400/55 hover:bg-amber-900/40 disabled:opacity-50"
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
            autoFocus
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            className="ss-entry-field w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-900/40"
            placeholder="Type your answer"
            disabled={submitting}
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
      <p className="text-xs leading-relaxed text-stone-500">
        {questionSeconds} seconds per question. One {timeoutBonusSeconds}-second bonus if you run out of time once; a
        second timeout disqualifies your attempt. You have {WORLD_CUP_BALL_SESSION_MAX_MINUTES} minutes to finish the
        full quiz.
      </p>
    </div>
  )
}
