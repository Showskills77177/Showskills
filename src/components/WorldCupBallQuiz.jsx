import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WORLD_CUP_BALL_MAX_TIMEOUTS,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_SESSION_MAX_MINUTES,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE,
  WORLD_CUP_BALL_DONT_KNOW_ANSWER,
  WORLD_CUP_BALL_DONT_KNOW_LABEL,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_QUESTION_TIMING_NOTICE,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION,
  WORLD_CUP_BALL_SALVAGE_NOTICE,
} from '../../shared/worldCupBallGiveaway.mjs'
import { worldCupBallChoiceOptionLabel } from '../../shared/worldCupBallHistoricalChoices.mjs'
import {
  WORLD_CUP_BALL_PRACTICE_QUESTION,
  WORLD_CUP_BALL_PRACTICE_INTRO,
  WORLD_CUP_BALL_PRACTICE_BONUS_TIP,
  WORLD_CUP_BALL_PRACTICE_TIMER_TIP,
  WORLD_CUP_BALL_PRACTICE_TYPING_TIP,
  worldCupBallPracticeCompleteTips,
} from '../../shared/worldCupBallPractice.mjs'
import { apiFetch, apiUrl } from '../lib/api'
import { fetchCaptchaConfig } from '../lib/captchaConfig.js'
import { AltchaWidget } from './AltchaWidget'
import { QuizQuestionTimer } from './QuizQuestionTimer'
import { CAPTCHA_BODY_FIELD } from '../../shared/captcha.mjs'
import {
  clearWorldCupBallQuizProgress,
  loadWorldCupBallQuizProgress,
  saveWorldCupBallQuizProgress,
} from '../lib/worldCupBallQuizProgress.mjs'
import { primeQuizTimerAudio, speakBonusUsed } from '../lib/quizTimerFeedback'

function QuizDontKnowButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ss-wc-ball-quiz__dont-know-btn w-full rounded-lg border border-stone-600/80 bg-stone-900/50 py-2.5 text-sm font-semibold text-stone-400 transition hover:border-stone-500 hover:bg-stone-800/60 hover:text-stone-200 disabled:opacity-50"
    >
      {WORLD_CUP_BALL_DONT_KNOW_LABEL}
    </button>
  )
}

/**
 * Timed skill quiz for the World Cup Ball Giveaway.
 * @param {{ onResult: (result: object) => void, onError: (msg: string) => void, onPhaseChange?: (phase: string) => void, disabled?: boolean }} props
 */
export function WorldCupBallQuiz({ onResult, onError, onPhaseChange, disabled = false }) {
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
  const [secondsLeft, setSecondsLeft] = useState(WORLD_CUP_BALL_QUESTION_SECONDS)
  const [submitting, setSubmitting] = useState(false)
  const [salvageQuestion, setSalvageQuestion] = useState(null)
  const [practiceSecondsLeft, setPracticeSecondsLeft] = useState(WORLD_CUP_BALL_QUESTION_SECONDS)
  const [practiceBonusActive, setPracticeBonusActive] = useState(false)
  const [practiceTimeouts, setPracticeTimeouts] = useState(0)
  const [practiceSummary, setPracticeSummary] = useState({ timedOutOnce: false, answered: false })
  const disqualifiedRef = useRef(false)
  const answersRef = useRef({})
  const practiceCompletedRef = useRef(false)
  const [hasSavedProgress, setHasSavedProgress] = useState(false)
  const [captchaConfig, setCaptchaConfig] = useState({ enabled: false, challengeUrl: '/api/captcha-challenge', loading: true })
  const [captchaPayload, setCaptchaPayload] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const [editorTestBypass, setEditorTestBypass] = useState(false)

  const practiceChoices = useMemo(() => {
    const list = [...WORLD_CUP_BALL_PRACTICE_QUESTION.choices]
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [])

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

  const deliverQuizResult = useCallback(
    (data) => {
      clearWorldCupBallQuizProgress()
      onResult({
        result: data.result,
        allCorrect: data.allCorrect,
        disqualified: data.disqualified,
        claimToken: data.claimToken || null,
        wrongReview: Array.isArray(data.wrongReview) ? data.wrongReview : [],
        salvageCorrect: data.salvageCorrect,
        monthlyDraw: data.monthlyDraw || null,
        earlyExit: Boolean(data.earlyExit),
      })
    },
    [onResult],
  )

  const finishQuiz = useCallback(
    async (finalAnswers, finalTimeouts, disqualified) => {
      if (!sessionId || submitting) return
      setSubmitting(true)
      setPhase('submitting')
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
          setPhase('active')
          setSubmitting(false)
          return
        }
        if (data.result === 'salvage_bonus' && data.salvageQuestion) {
          setSalvageQuestion(data.salvageQuestion)
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

  const checkQuizProgress = useCallback(
    async (currentAnswers, currentTimeouts) => {
      if (!sessionId || submitting) return false
      setSubmitting(true)
      try {
        const res = await fetch(apiUrl('/api/submissions/world-cup-ball/submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            answers: currentAnswers,
            timeoutsUsed: currentTimeouts,
            partialCheck: true,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          onError(typeof data.error === 'string' ? data.error : 'Could not check your answer.')
          return false
        }
        if (data.continue) return true
        setPhase('submitting')
        deliverQuizResult(data)
        return false
      } catch {
        onError('Could not check your answer. Check your connection and try again.')
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [sessionId, submitting, onError, deliverQuizResult],
  )

  const submitSalvageAnswer = useCallback(
    async (answerText) => {
      if (!sessionId || submitting || !salvageQuestion) return
      setSubmitting(true)
      setPhase('submitting')
      try {
        const res = await fetch(apiUrl('/api/submissions/world-cup-ball/submit'), {
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
        clearWorldCupBallQuizProgress()
        deliverQuizResult(data)
      } catch {
        onError('Could not submit your bonus answer. Check your connection and try again.')
        setPhase('salvage')
      } finally {
        setSubmitting(false)
      }
    },
    [sessionId, submitting, salvageQuestion, onError, deliverQuizResult],
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

      const canContinue = await checkQuizProgress(nextAnswers, timeoutsUsed)
      if (!canContinue) return

      const nextIndex = index + 1
      setCurrentAnswer('')
      setIndex(nextIndex)
      resetTimer(false)
      persistProgress({ index: nextIndex, answers: nextAnswers, bonusActive: false, secondsLeft: questionSeconds })
    },
    [
      index,
      questions,
      phase,
      submitting,
      timeoutsUsed,
      finishQuiz,
      checkQuizProgress,
      resetTimer,
      persistProgress,
      questionSeconds,
    ],
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
      setSecondsLeft((s) => {
        const next = s - 1
        if (phase === 'active') persistProgress({ secondsLeft: next })
        return next
      })
    }, 1000)
    return () => window.clearTimeout(t)
  }, [phase, secondsLeft, handleTimeout, disabled, persistProgress, submitSalvageAnswer])

  useEffect(() => {
    if (phase !== 'practice' || disabled) return undefined
    if (practiceSecondsLeft <= 0) {
      if (practiceTimeouts >= WORLD_CUP_BALL_MAX_TIMEOUTS) {
        practiceCompletedRef.current = true
        setPracticeSummary({ timedOutOnce: true, answered: false })
        setPhase('practice_complete')
        return undefined
      }
      setPracticeTimeouts((count) => count + 1)
      setPracticeBonusActive(true)
      setPracticeSecondsLeft(WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS)
      speakBonusUsed()
      return undefined
    }
    const t = window.setTimeout(() => setPracticeSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [phase, practiceSecondsLeft, practiceTimeouts, disabled])

  useEffect(() => {
    const saved = loadWorldCupBallQuizProgress()
    setHasSavedProgress(Boolean(saved?.sessionId))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCaptchaConfig().then((cfg) => {
      if (cancelled) return
      setCaptchaConfig({ enabled: cfg.enabled, challengeUrl: cfg.challengeUrl, loading: false })
    })
    apiFetch('/api/editor-test-me')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEditorTestBypass(Boolean(data.quizBypass))
      })
      .catch(() => {
        if (!cancelled) setEditorTestBypass(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  const quizShellClass = `ss-wc-ball-quiz ss-wc-ball-quiz--${phase}`

  const startPractice = () => {
    if (disabled) return
    primeQuizTimerAudio()
    onError('')
    setPracticeSecondsLeft(WORLD_CUP_BALL_QUESTION_SECONDS)
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

  const startQuiz = async () => {
    if (disabled || submitting) return
    primeQuizTimerAudio()
    const resumingInProgress = hasSavedProgress && phase === 'idle'
    const captchaNeeded = captchaConfig.enabled && !editorTestBypass && !resumingInProgress
    if (captchaNeeded && !captchaPayload) {
      setCaptchaError('Please wait for the security check to finish.')
      return
    }
    setPhase('loading')
    onError('')
    setCaptchaError('')
    try {
      const payload = {}
      if (captchaConfig.enabled && captchaPayload) {
        payload[CAPTCHA_BODY_FIELD] = captchaPayload
      }
      const res = await fetch(apiUrl('/api/submissions/world-cup-ball/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
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
        setPhase(practiceCompletedRef.current ? 'practice_complete' : 'idle')
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
      setPhase(practiceCompletedRef.current ? 'practice_complete' : 'idle')
    }
  }

  const handleSubmitAnswer = (e) => {
    e.preventDefault()
    if (!currentAnswer.trim()) return
    advanceQuestion(currentAnswer)
  }

  const resumingInProgress = hasSavedProgress && phase === 'idle'
  const captchaRequired = captchaConfig.enabled && !resumingInProgress && !editorTestBypass
  const startBlocked = disabled || submitting || (captchaRequired && !captchaPayload)

  const renderStartSecurityCheck = () => {
    if (captchaConfig.loading || !captchaRequired) return null
    return (
      <div className="ss-altcha-widget-wrap flex flex-col gap-2">
        <AltchaWidget
          challengePath={captchaConfig.challengeUrl}
          onPayload={(payload) => {
            setCaptchaPayload(payload)
            setCaptchaError('')
          }}
          onExpire={() => setCaptchaPayload('')}
          onError={(msg) => {
            setCaptchaPayload('')
            setCaptchaError(msg)
          }}
        />
        {captchaError ? (
          <p className="text-xs text-red-300" role="alert">
            {captchaError}
          </p>
        ) : captchaPayload ? (
          <p className="text-xs text-emerald-300/90">Security check complete — you can start the test.</p>
        ) : (
          <p className="text-xs text-stone-500">Running a quick security check in your browser…</p>
        )}
      </div>
    )
  }

  if (phase === 'idle') {
    if (hasSavedProgress) {
      return (
        <div className={quizShellClass}>
          <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-stone-400">
            You have an in-progress quiz in this browser. Resume where you left off — practice is skipped.
          </p>
          <button
            type="button"
            onClick={() => void startQuiz()}
            disabled={disabled || submitting}
            className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-stone-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Resume test
          </button>
          {editorTestBypass ? (
            <button
              type="button"
              data-editor-ui
              onClick={() => {
                clearWorldCupBallQuizProgress()
                setHasSavedProgress(false)
              }}
              className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/30 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/35"
            >
              Start fresh (editor)
            </button>
          ) : null}
          </div>
        </div>
      )
    }

    return (
      <div className={quizShellClass}>
        <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2.5 text-xs leading-relaxed text-amber-50/95">
          <strong className="text-amber-100">Timing:</strong> {WORLD_CUP_BALL_QUESTION_TIMING_NOTICE}
        </p>
        <p className="text-xs leading-relaxed text-stone-400">{WORLD_CUP_BALL_CHOICE_BONUS_NOTICE}</p>
        <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2.5 text-xs leading-relaxed text-amber-100/85">
          {WORLD_CUP_BALL_PRACTICE_INTRO}
        </p>
        <button
          type="button"
          onClick={startPractice}
          disabled={disabled}
          className="w-full rounded-xl border border-amber-500/40 bg-amber-950/35 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Try practice question
        </button>
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
          <p className="mt-1.5 text-xs leading-relaxed text-stone-300">{WORLD_CUP_BALL_PRACTICE_INTRO}</p>
          <p className="mt-2 text-xs leading-relaxed text-teal-100/85">{WORLD_CUP_BALL_PRACTICE_TIMER_TIP}</p>
          <p className="mt-2 rounded-md border border-amber-400/35 bg-amber-950/30 px-2.5 py-2 text-xs font-semibold leading-relaxed text-amber-100/95">
            {WORLD_CUP_BALL_PRACTICE_BONUS_TIP}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-teal-100/85">{WORLD_CUP_BALL_PRACTICE_TYPING_TIP}</p>
        </div>
        <QuizQuestionTimer
          secondsLeft={practiceSecondsLeft}
          label={`Practice · ${WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL}`}
          bonusActive={practiceBonusActive}
          enabled={!disabled}
        />
        {practiceBonusActive ? (
          <p className="ss-wc-ball-quiz__bonus-note rounded-lg border border-amber-400/40 bg-amber-950/35 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-50">
            <strong className="text-amber-200">+{WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS} second extension active.</strong> Answer now
            — in the real quiz you only get this once per attempt.
          </p>
        ) : null}
        <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Multiple choice</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
            Tap one option below before the time-out expires.
          </p>
        </div>
        <p className="ss-wc-ball-quiz__prompt text-stone-100">
          {WORLD_CUP_BALL_PRACTICE_QUESTION.prompt}
        </p>
        <div className="ss-wc-ball-quiz__choices grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
    const tips = worldCupBallPracticeCompleteTips(practiceSummary)
    return (
      <div className={quizShellClass}>
        <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-4 text-sm text-emerald-50/95">
          <p className="font-semibold text-emerald-100">Practice complete</p>
          <p className="mt-2 text-xs leading-relaxed text-stone-300">
            Good — you have seen how the time-out works. Your real attempt starts when you press the button below.
          </p>
          <p className="ss-wc-ball-quiz__practice-ready mt-2 text-xs leading-relaxed text-stone-300 sm:hidden">
            Ready for the real {WORLD_CUP_BALL_QUESTION_COUNT}-question test — {WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION}, with a {WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second extension if a time-out expires once.
          </p>
          <ul className="ss-wc-ball-quiz__practice-tips mt-3 hidden list-inside list-disc space-y-1.5 text-xs leading-relaxed text-stone-300 sm:block">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => void startQuiz()}
          disabled={startBlocked}
          className="ss-wc-ball-quiz__primary-btn w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-stone-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start test ({WORLD_CUP_BALL_QUESTION_COUNT} questions · {WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL} each)
        </button>
        {renderStartSecurityCheck()}
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

  if (phase === 'salvage' && salvageQuestion) {
    const salvageChoices = Array.isArray(salvageQuestion.choices) ? [...salvageQuestion.choices] : []
    for (let i = salvageChoices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[salvageChoices[i], salvageChoices[j]] = [salvageChoices[j], salvageChoices[i]]
    }
    const hasSalvageChoices = salvageChoices.length > 0

    return (
      <div className={quizShellClass}>
        <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
        <div className="ss-wc-ball-quiz__salvage-banner rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 text-sm text-amber-50/95">
          <p className="font-semibold text-amber-100">Bonus salvage question</p>
          <p className="mt-2 text-stone-300">{WORLD_CUP_BALL_SALVAGE_NOTICE}</p>
        </div>
        <QuizQuestionTimer
          secondsLeft={secondsLeft}
          label={`Salvage · ${WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL}`}
          enabled={!disabled && !submitting}
        />
        {hasSalvageChoices ? (
          <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Bonus question</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/85">Pick the correct option below.</p>
          </div>
        ) : null}
        <p className="ss-wc-ball-quiz__prompt text-stone-100">{salvageQuestion.prompt}</p>
        {hasSalvageChoices ? (
          <div className="ss-wc-ball-quiz__choices grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE}</p>
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
              onClick={() => void submitSalvageAnswer(WORLD_CUP_BALL_DONT_KNOW_ANSWER)}
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

  const total = questions.length || WORLD_CUP_BALL_QUESTION_COUNT
  const hasChoices = shuffledChoices.length > 0

  return (
    <div className={quizShellClass}>
      <div className="ss-wc-ball-quiz__stack flex flex-col gap-4">
      <QuizQuestionTimer
        secondsLeft={secondsLeft}
        label={`Question ${index + 1} of ${total} · ${WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL}`}
        bonusActive={bonusActive}
        enabled={!disabled && !submitting}
      />
      {bonusActive ? (
        <p className="ss-wc-ball-quiz__bonus-note rounded-lg border border-amber-400/40 bg-amber-950/35 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-50">
            <strong className="text-amber-200">+{WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS} second extension active.</strong> The time-out expired on this
            question — answer now. You only get one extension per attempt; a second time-out disqualifies you.
        </p>
      ) : null}
      {hasChoices ? (
        <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Multiple choice</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
            Pick one of the {worldCupBallChoiceOptionLabel(shuffledChoices.length)} below — you do not need to type an
            answer on this question.
          </p>
        </div>
      ) : (
        <div className="ss-wc-ball-quiz__callout rounded-lg border border-amber-400/30 bg-amber-950/25 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Type your answer</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/85">{WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE}</p>
        </div>
      )}
      <p className="ss-wc-ball-quiz__prompt text-stone-100">{q?.prompt}</p>
      {hasChoices ? (
        <div className="ss-wc-ball-quiz__choices grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shuffledChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={submitting}
              onClick={() => advanceQuestion(choice)}
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
            onClick={() => advanceQuestion(WORLD_CUP_BALL_DONT_KNOW_ANSWER)}
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
        {WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION}. {WORLD_CUP_BALL_SALVAGE_NOTICE}{' '}
        You have {WORLD_CUP_BALL_SESSION_MAX_MINUTES} minutes to finish the full quiz.
      </p>
      </div>
    </div>
  )
}
