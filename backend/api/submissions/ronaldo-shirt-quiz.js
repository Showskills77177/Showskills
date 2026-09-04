import { parseJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { checkVpnForRequest } from '../lib/vpnDetection.mjs'
import { logEntryAttempt, clientIp } from '../lib/freeEntryAbuse.mjs'
import { COMPETITION_SHIRT_GIVEAWAY, FREE_ENTRY_ERRORS } from '../../../shared/freeEntryLimits.mjs'
import {
  publicRonaldoShirtQuizQuestions,
  publicRonaldoShirtQuizQuestion,
  validateRonaldoShirtQuizAnswers,
  countRonaldoShirtQuizWrongAnswers,
  isRonaldoShirtQuizDisqualifiedByTimeouts,
  parseRonaldoShirtQuizSessionQuestionKeys,
  parseRonaldoShirtQuizSalvageKeys,
  pickRandomRonaldoShirtQuizCombination,
  pickRonaldoShirtQuizSalvageQuestion,
  buildRonaldoShirtQuizWrongReview,
  ronaldoShirtQuizAnsweredKeys,
  shouldEndRonaldoShirtQuizEarly,
  decideRonaldoShirtQuizNextStep,
  getRonaldoShirtQuizQuestionsByKeys,
  RONALDO_SHIRT_QUIZ_QUESTION_COUNT,
  RONALDO_SHIRT_QUIZ_QUESTION_SECONDS,
  RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS,
  RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS,
  RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES,
  RONALDO_SHIRT_QUIZ_PASS_TOKEN_GRACE_MINUTES,
} from '../../../shared/ronaldoShirtQuiz.mjs'
import { answerMatchesWorldCupBallAnswer } from '../../../shared/worldCupBallAnswerMatching.mjs'
import {
  createRonaldoShirtQuizSession,
  getRonaldoShirtQuizSession,
  getInProgressRonaldoShirtQuizSessionByIp,
  finalizeRonaldoShirtQuizSession,
  saveRonaldoShirtQuizSalvageOffer,
  saveRonaldoShirtQuizPartialProgress,
} from '../lib/ronaldoShirtQuizSchema.mjs'
import { getCountryFromRequest } from '../lib/visitorGeo.mjs'

/** @param {import('http').IncomingMessage} req */
function visitorCountryCode(req) {
  return getCountryFromRequest(req).countryCode || null
}

function sessionExpired(startedAt) {
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return true
  const maxMs = RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES * 60 * 1000
  return Date.now() - start > maxMs
}

function parseSessionAnswers(session) {
  const raw = session?.answers_json
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function parseSalvageAnswers(session) {
  const raw = session?.salvage_answers_json
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/** POST /api/submissions/ronaldo-shirt-quiz/start */
export async function startRonaldoShirtQuizSession(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const limited = applyRateLimit(req, res, { pathKey: 'ronaldo-quiz-start', max: 8, windowMs: 60_000 })
  if (limited.blocked) return json(res, 429, { error: 'Too many requests. Please wait and try again.' })

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  try {
    const vpn = await checkVpnForRequest(req)
    if (!vpn.ok) {
      await logEntryAttempt(req, {
        competition: COMPETITION_SHIRT_GIVEAWAY,
        flow: 'ronaldo_shirt_quiz_start',
        outcome: 'blocked',
        blockReason: 'vpn_not_allowed',
      }).catch(() => {})
      return json(res, 403, { error: vpn.error, code: vpn.code })
    }

    const ip = clientIp(req)
    const countryCode = visitorCountryCode(req)

    const existing = await getInProgressRonaldoShirtQuizSessionByIp(ip)
    if (existing) {
      if (sessionExpired(existing.started_at)) {
        await finalizeRonaldoShirtQuizSession({
          sessionId: existing.id,
          status: 'expired',
          timeoutsUsed: existing.timeouts_used ?? 0,
          answers: parseSessionAnswers(existing),
          countryCode,
        })
      } else {
        const questionKeys = parseRonaldoShirtQuizSessionQuestionKeys(existing)
        if (questionKeys?.length === RONALDO_SHIRT_QUIZ_QUESTION_COUNT) {
          return json(res, 200, {
            ok: true,
            resumed: true,
            sessionId: existing.id,
            startedAt: existing.started_at,
            questions: publicRonaldoShirtQuizQuestions(questionKeys),
            questionCount: questionKeys.length,
            questionSeconds: RONALDO_SHIRT_QUIZ_QUESTION_SECONDS,
            timeoutBonusSeconds: RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS,
            maxTimeouts: RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS,
            sessionMaxMinutes: RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES,
          })
        }
        await finalizeRonaldoShirtQuizSession({
          sessionId: existing.id,
          status: 'abandoned',
          timeoutsUsed: existing.timeouts_used ?? 0,
          answers: parseSessionAnswers(existing),
          countryCode,
        })
      }
    }

    const { combinationIndex, questionKeys } = pickRandomRonaldoShirtQuizCombination()
    const session = await createRonaldoShirtQuizSession(ip, { questionKeys, combinationIndex, countryCode })

    try {
      await logEntryAttempt(req, {
        competition: COMPETITION_SHIRT_GIVEAWAY,
        flow: 'ronaldo_shirt_quiz_start',
        ip,
        outcome: 'success',
        metadata: { session_id: session.id, combination_index: combinationIndex },
      })
    } catch (logErr) {
      console.error('[ronaldo-shirt-quiz] entry attempt log failed:', logErr)
    }

    return json(res, 201, {
      ok: true,
      sessionId: session.id,
      startedAt: session.startedAt,
      questions: publicRonaldoShirtQuizQuestions(questionKeys),
      questionCount: questionKeys.length,
      questionSeconds: RONALDO_SHIRT_QUIZ_QUESTION_SECONDS,
      timeoutBonusSeconds: RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS,
      maxTimeouts: RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS,
      sessionMaxMinutes: RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not start quiz session' })
  }
}

/** POST /api/submissions/ronaldo-shirt-quiz/submit */
export async function submitRonaldoShirtQuiz(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  let body
  try {
    body = parseJsonBody(req)
  } catch {
    return json(res, 400, { error: 'Invalid request body' })
  }

  const partialCheck = body.partialCheck === true
  const limited = applyRateLimit(req, res, {
    pathKey: partialCheck ? 'ronaldo-quiz-submit-partial' : 'ronaldo-quiz-submit',
    max: partialCheck ? 16 : 8,
    windowMs: 60_000,
  })
  if (limited.blocked) return json(res, 429, { error: 'Too many requests. Please wait and try again.' })

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  const vpn = await checkVpnForRequest(req)
  if (!vpn.ok) {
    return json(res, 403, { error: vpn.error, code: vpn.code })
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const timeoutsUsed = Number(body.timeoutsUsed)
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  const salvageAnswer = typeof body.salvageAnswer === 'string' ? body.salvageAnswer.trim() : ''

  if (!sessionId) return json(res, 400, { error: 'sessionId required' })

  const session = await getRonaldoShirtQuizSession(sessionId)
  if (!session || session.status !== 'in_progress') {
    return json(res, 400, {
      error: FREE_ENTRY_ERRORS.ronaldoShirtQuizInvalidSession,
      code: 'invalid_session',
    })
  }

  const ip = clientIp(req)
  const countryCode = visitorCountryCode(req)
  if (session.ip_address && ip && session.ip_address !== ip) {
    return json(res, 403, {
      error: FREE_ENTRY_ERRORS.ronaldoShirtQuizInvalidSession,
      code: 'ip_mismatch',
    })
  }

  if (sessionExpired(session.started_at)) {
    await finalizeRonaldoShirtQuizSession({
      sessionId,
      status: 'expired',
      timeoutsUsed: Number.isFinite(timeoutsUsed) ? timeoutsUsed : session.timeouts_used ?? 0,
      answers: parseSessionAnswers(session),
      countryCode,
    })
    return json(res, 400, {
      error: FREE_ENTRY_ERRORS.ronaldoShirtQuizInvalidSession,
      code: 'session_expired',
    })
  }

  const questionKeys = parseRonaldoShirtQuizSessionQuestionKeys(session)
  if (!questionKeys || questionKeys.length !== RONALDO_SHIRT_QUIZ_QUESTION_COUNT) {
    return json(res, 400, {
      error: FREE_ENTRY_ERRORS.ronaldoShirtQuizInvalidSession,
      code: 'invalid_session',
    })
  }

  const effectiveTimeouts = Number.isFinite(timeoutsUsed) ? timeoutsUsed : Number(session.timeouts_used) || 0
  const disqualified = isRonaldoShirtQuizDisqualifiedByTimeouts(effectiveTimeouts)

  // Progress ping while the player is still working through the base 25 questions.
  if (partialCheck) {
    const answeredKeys = ronaldoShirtQuizAnsweredKeys(answers, questionKeys)
    if (!answeredKeys.length || answeredKeys.length >= questionKeys.length) {
      return json(res, 400, { error: 'Invalid partial quiz check.', code: 'invalid_partial_check' })
    }

    if (shouldEndRonaldoShirtQuizEarly(answers, questionKeys)) {
      const wrongReview = buildRonaldoShirtQuizWrongReview(answers, answeredKeys)
      try {
        await finalizeRonaldoShirtQuizSession({
          sessionId,
          status: 'lost',
          timeoutsUsed: effectiveTimeouts,
          answers,
          countryCode,
        })
        await logEntryAttempt(req, {
          competition: COMPETITION_SHIRT_GIVEAWAY,
          flow: 'ronaldo_shirt_quiz_submit',
          ip,
          outcome: 'lost',
          metadata: { session_id: sessionId, early_exit: true, wrong_count: wrongReview.length },
        })
        return json(res, 200, {
          ok: true,
          result: 'lost',
          allCorrect: false,
          disqualified: false,
          passToken: null,
          wrongReview,
          wrongCount: wrongReview.length,
          earlyExit: true,
        })
      } catch (e) {
        console.error(e)
        return json(res, 500, { error: 'Could not save quiz result' })
      }
    }

    try {
      await saveRonaldoShirtQuizPartialProgress({ sessionId, answers, timeoutsUsed: effectiveTimeouts })
    } catch (e) {
      console.error('[ronaldo-shirt-quiz] partial progress save failed:', e)
    }

    const validation = validateRonaldoShirtQuizAnswers(answers, answeredKeys)
    const wrongCount = countRonaldoShirtQuizWrongAnswers(validation, answeredKeys)
    return json(res, 200, { ok: true, continue: true, wrongCount })
  }

  const salvageKeys = parseRonaldoShirtQuizSalvageKeys(session)

  // Answering a previously-issued salvage (bonus) question.
  if (salvageAnswer && salvageKeys.length > 0) {
    const currentSalvageKey = salvageKeys[salvageKeys.length - 1]
    const mainAnswers = parseSessionAnswers(session)
    const priorSalvageAnswers = parseSalvageAnswers(session)
    const salvageQ = getRonaldoShirtQuizQuestionsByKeys([currentSalvageKey])[0]
    const salvageCorrect = Boolean(
      salvageQ && answerMatchesWorldCupBallAnswer(salvageAnswer, salvageQ.acceptedAnswers),
    )
    const updatedSalvageAnswers = { ...priorSalvageAnswers, [currentSalvageKey]: salvageAnswer }

    const baseValidation = validateRonaldoShirtQuizAnswers(mainAnswers, questionKeys)
    const baseWrong = countRonaldoShirtQuizWrongAnswers(baseValidation, questionKeys)
    const salvageWrongSoFar = salvageKeys.filter((key) => {
      if (key === currentSalvageKey) return !salvageCorrect
      const q = getRonaldoShirtQuizQuestionsByKeys([key])[0]
      return q ? !answerMatchesWorldCupBallAnswer(updatedSalvageAnswers[key], q.acceptedAnswers) : true
    }).length
    const totalWrongSoFar = baseWrong + salvageWrongSoFar

    const wrongReview = buildRonaldoShirtQuizWrongReview(mainAnswers, questionKeys)
    const decision = disqualified
      ? 'lost'
      : decideRonaldoShirtQuizNextStep({ totalWrongSoFar, salvageQuestionsIssued: salvageKeys.length })

    if (!disqualified && decision === 'issue_salvage') {
      const nextSalvage = pickRonaldoShirtQuizSalvageQuestion([...questionKeys, ...salvageKeys])
      if (nextSalvage) {
        try {
          await saveRonaldoShirtQuizSalvageOffer({
            sessionId,
            answers: mainAnswers,
            timeoutsUsed: effectiveTimeouts,
            salvageQuestionKeys: [...salvageKeys, nextSalvage.questionKey],
            salvageAnswers: updatedSalvageAnswers,
          })
          return json(res, 200, {
            ok: true,
            result: 'salvage_bonus',
            allCorrect: false,
            disqualified: false,
            wrongCount: totalWrongSoFar,
            salvageQuestion: publicRonaldoShirtQuizQuestion(nextSalvage.questionKey),
            passToken: null,
          })
        } catch (e) {
          console.error(e)
          return json(res, 500, { error: 'Could not save quiz result' })
        }
      }
    }

    const status = disqualified ? 'disqualified' : decision === 'won' ? 'won' : 'lost'

    try {
      const { passToken } = await finalizeRonaldoShirtQuizSession({
        sessionId,
        status,
        timeoutsUsed: effectiveTimeouts,
        answers: mainAnswers,
        countryCode,
      })

      await logEntryAttempt(req, {
        competition: COMPETITION_SHIRT_GIVEAWAY,
        flow: 'ronaldo_shirt_quiz_submit',
        ip,
        outcome: status,
        metadata: { session_id: sessionId, salvage: true, salvage_correct: salvageCorrect, wrong_count: totalWrongSoFar },
      })

      return json(res, 200, {
        ok: true,
        result: status,
        allCorrect: status === 'won',
        disqualified,
        passToken: status === 'won' ? passToken : null,
        passTokenGraceMinutes: status === 'won' ? RONALDO_SHIRT_QUIZ_PASS_TOKEN_GRACE_MINUTES : null,
        wrongReview: status === 'won' ? [] : wrongReview,
        salvageCorrect,
      })
    } catch (e) {
      console.error(e)
      return json(res, 500, { error: 'Could not save quiz result' })
    }
  }

  // Final submit of all 25 base answers.
  const validation = validateRonaldoShirtQuizAnswers(answers, questionKeys)
  const wrongCount = countRonaldoShirtQuizWrongAnswers(validation, questionKeys)
  const decision = disqualified
    ? 'lost'
    : decideRonaldoShirtQuizNextStep({ totalWrongSoFar: wrongCount, salvageQuestionsIssued: 0 })

  if (!disqualified && decision === 'issue_salvage') {
    const salvage = pickRonaldoShirtQuizSalvageQuestion(questionKeys)
    if (salvage) {
      try {
        await saveRonaldoShirtQuizSalvageOffer({
          sessionId,
          answers,
          timeoutsUsed: effectiveTimeouts,
          salvageQuestionKeys: [salvage.questionKey],
          salvageAnswers: {},
        })
        return json(res, 200, {
          ok: true,
          result: 'salvage_bonus',
          allCorrect: false,
          disqualified: false,
          wrongCount,
          salvageQuestion: publicRonaldoShirtQuizQuestion(salvage.questionKey),
          passToken: null,
        })
      } catch (e) {
        console.error(e)
        return json(res, 500, { error: 'Could not save quiz result' })
      }
    }
  }

  const status = disqualified ? 'disqualified' : decision === 'won' ? 'won' : 'lost'
  const wrongReview = status === 'won' ? [] : buildRonaldoShirtQuizWrongReview(answers, questionKeys)

  try {
    const { passToken } = await finalizeRonaldoShirtQuizSession({
      sessionId,
      status,
      timeoutsUsed: effectiveTimeouts,
      answers,
      countryCode,
    })

    await logEntryAttempt(req, {
      competition: COMPETITION_SHIRT_GIVEAWAY,
      flow: 'ronaldo_shirt_quiz_submit',
      ip,
      outcome: status,
      metadata: { session_id: sessionId, all_correct: validation.allCorrect, disqualified, wrong_count: wrongCount },
    })

    return json(res, 200, {
      ok: true,
      result: status,
      allCorrect: validation.allCorrect,
      disqualified,
      passToken: status === 'won' ? passToken : null,
      passTokenGraceMinutes: status === 'won' ? RONALDO_SHIRT_QUIZ_PASS_TOKEN_GRACE_MINUTES : null,
      wrongReview,
      wrongCount,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not save quiz result' })
  }
}
