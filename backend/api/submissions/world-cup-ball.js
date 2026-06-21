import { randomUUID, randomBytes } from 'node:crypto'
import { parseJsonBody, json } from '../lib/http.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'
import { checkVpnForRequest } from '../lib/vpnDetection.mjs'
import { logEntryAttempt, parsePostalAddress, clientIp } from '../lib/freeEntryAbuse.mjs'
import { validateContactPhone } from '../../../shared/contactPhone.mjs'
import {
  buildNameAddressKey,
  normalizePersonName,
  COMPETITION_WORLD_CUP_BALL,
  FREE_ENTRY_ERRORS,
  MAX_WORLD_CUP_BALL_PER_DEVICE,
} from '../../../shared/freeEntryLimits.mjs'
import {
  publicWorldCupBallQuestions,
  validateWorldCupBallAnswers,
  isWorldCupBallDisqualifiedByTimeouts,
  parseWorldCupBallSessionQuestionKeys,
  pickRandomWorldCupBallCombination,
  WORLD_CUP_BALL_SESSION_MAX_MINUTES,
  WORLD_CUP_BALL_GIVEAWAY_SLUG,
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_MAX_TIMEOUTS,
  WORLD_CUP_BALL_MAX_WRONG_FOR_SALVAGE,
  countWorldCupBallWrongAnswers,
  buildWorldCupBallWrongReview,
  pickWorldCupBallSalvageQuestion,
  publicWorldCupBallQuestion,
  getWorldCupBallQuestionsByKeys,
} from '../../../shared/worldCupBallGiveaway.mjs'
import { answerMatchesWorldCupBallAnswer } from '../../../shared/worldCupBallAnswerMatching.mjs'
import {
  createWorldCupBallSession,
  getWorldCupBallSession,
  countWorldCupBallFinalizedAttemptsByIp,
  getInProgressWorldCupBallSessionByIp,
  countWorldCupBallWinners,
  finalizeWorldCupBallSession,
  getWorldCupBallSessionByClaimToken,
  hasWorldCupBallWinnerClaim,
  recordWorldCupBallWinner,
  markWorldCupBallWinnerEmailSent,
  saveWorldCupBallSalvageOffer,
} from '../lib/worldCupBallSchema.mjs'
import { sendWorldCupBallWinnerEmail } from '../lib/sendWorldCupBallWinnerEmail.mjs'
import { buildWorldCupBallClaimUrl } from '../../../shared/worldCupBallClaim.mjs'
import { resolveSiteUrl } from '../lib/resendConfig.mjs'
import { WORLD_CUP_BALL_MIN_AGE } from '../../../shared/worldCupBallGiveawayRules.mjs'
import { isWorldCupBallQuizBypass } from '../lib/worldCupBallDev.mjs'
import { verifyCaptchaPayload } from '../lib/captcha.mjs'
import { CAPTCHA_BODY_FIELD } from '../../../shared/captcha.mjs'

function sessionExpired(startedAt) {
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return true
  const maxMs = WORLD_CUP_BALL_SESSION_MAX_MINUTES * 60 * 1000
  return Date.now() - start > maxMs
}

function newClaimToken() {
  return randomBytes(24).toString('hex')
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

async function resolveWorldCupBallWinStatus(req) {
  const winners = await countWorldCupBallWinners()
  const bypass = await isWorldCupBallQuizBypass(req)
  if (!bypass && winners >= 1) {
    return { status: 'lost', claimToken: null }
  }
  return { status: 'won', claimToken: newClaimToken() }
}

async function enforceVpnAndDevice(req, res, flow) {
  try {
    const quizBypass = await isWorldCupBallQuizBypass(req)
    if (!quizBypass) {
      const vpn = await checkVpnForRequest(req)
      if (!vpn.ok) {
        await logEntryAttempt(req, {
          competition: COMPETITION_WORLD_CUP_BALL,
          flow,
          outcome: 'blocked',
          blockReason: 'vpn_not_allowed',
        }).catch(() => {})
        json(res, 403, { error: vpn.error, code: vpn.code })
        return false
      }
    }

    const ip = clientIp(req)
    if (!quizBypass) {
      const attempts = await countWorldCupBallFinalizedAttemptsByIp(ip)
      if (attempts >= MAX_WORLD_CUP_BALL_PER_DEVICE) {
        await logEntryAttempt(req, {
          competition: COMPETITION_WORLD_CUP_BALL,
          flow,
          ip,
          outcome: 'blocked',
          blockReason: 'device_used',
        }).catch(() => {})
        json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallDeviceUsed, code: 'device_used' })
        return false
      }

      const winners = await countWorldCupBallWinners()
      if (winners >= 1) {
        json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallAlreadyWon, code: 'prize_claimed' })
        return false
      }
    }

    return true
  } catch (e) {
    console.error('[world-cup-ball] pre-start checks failed:', e)
    json(res, 503, { error: 'Could not start quiz session. Please try again.' })
    return false
  }
}

/** POST /api/submissions/world-cup-ball/start */
export async function startWorldCupBallSession(req, res) {
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

  const limited = applyRateLimit(req, res, { pathKey: 'wc-ball-start', max: 8, windowMs: 60_000 })
  if (limited.blocked) return json(res, 429, { error: 'Too many requests. Please wait and try again.' })

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  let body
  let ip
  try {
    const ok = await enforceVpnAndDevice(req, res, 'world_cup_ball_start')
    if (!ok) return

    body = parseJsonBody(req)
    ip = clientIp(req)
    const quizBypass = await isWorldCupBallQuizBypass(req)
    const existing = await getInProgressWorldCupBallSessionByIp(ip)
    if (existing) {
      if (quizBypass) {
        await finalizeWorldCupBallSession({
          sessionId: existing.id,
          status: 'abandoned',
          timeoutsUsed: existing.timeouts_used ?? 0,
          answers: parseSessionAnswers(existing),
        })
      } else if (sessionExpired(existing.started_at)) {
        await finalizeWorldCupBallSession({
          sessionId: existing.id,
          status: 'expired',
          timeoutsUsed: existing.timeouts_used ?? 0,
          answers: existing.answers_json || {},
        })
      } else {
        const questionKeys = parseWorldCupBallSessionQuestionKeys(existing)
        if (questionKeys?.length === WORLD_CUP_BALL_QUESTION_COUNT) {
          return json(res, 200, {
            ok: true,
            resumed: true,
            sessionId: existing.id,
            startedAt: existing.started_at,
            questions: publicWorldCupBallQuestions(questionKeys),
            questionCount: questionKeys.length,
            combinationIndex: existing.combination_index ?? null,
            questionSeconds: WORLD_CUP_BALL_QUESTION_SECONDS,
            timeoutBonusSeconds: WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
            maxTimeouts: WORLD_CUP_BALL_MAX_TIMEOUTS,
            sessionMaxMinutes: WORLD_CUP_BALL_SESSION_MAX_MINUTES,
          })
        }
        await finalizeWorldCupBallSession({
          sessionId: existing.id,
          status: 'abandoned',
          timeoutsUsed: existing.timeouts_used ?? 0,
          answers: existing.answers_json || {},
        })
      }
    }

    const captchaPayload =
      typeof body[CAPTCHA_BODY_FIELD] === 'string' ? body[CAPTCHA_BODY_FIELD].trim() : ''
    if (!quizBypass) {
      const captcha = await verifyCaptchaPayload(captchaPayload)
      if (!captcha.ok) {
        await logEntryAttempt(req, {
          competition: COMPETITION_WORLD_CUP_BALL,
          flow: 'world_cup_ball_start',
          ip,
          outcome: 'blocked',
          blockReason: captcha.code,
        }).catch(() => {})
        return json(res, 403, { error: captcha.error, code: captcha.code })
      }
    }

    const { combinationIndex, questionKeys } = pickRandomWorldCupBallCombination()
    const session = await createWorldCupBallSession(ip, { questionKeys, combinationIndex })
    try {
      await logEntryAttempt(req, {
        competition: COMPETITION_WORLD_CUP_BALL,
        flow: 'world_cup_ball_start',
        ip,
        outcome: 'success',
        metadata: { session_id: session.id, combination_index: combinationIndex },
      })
    } catch (logErr) {
      console.error('[world-cup-ball] entry attempt log failed:', logErr)
    }
    return json(res, 201, {
      ok: true,
      sessionId: session.id,
      startedAt: session.startedAt,
      questions: publicWorldCupBallQuestions(questionKeys),
      questionCount: questionKeys.length,
      combinationIndex,
      questionSeconds: WORLD_CUP_BALL_QUESTION_SECONDS,
      timeoutBonusSeconds: WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
      maxTimeouts: WORLD_CUP_BALL_MAX_TIMEOUTS,
      sessionMaxMinutes: WORLD_CUP_BALL_SESSION_MAX_MINUTES,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not start quiz session' })
  }
}

/** POST /api/submissions/world-cup-ball/submit */
export async function submitWorldCupBallQuiz(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const limited = applyRateLimit(req, res, { pathKey: 'wc-ball-submit', max: 6, windowMs: 60_000 })
  if (limited.blocked) return json(res, 429, { error: 'Too many requests. Please wait and try again.' })

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  const vpn = await checkVpnForRequest(req)
  if (!vpn.ok) {
    return json(res, 403, { error: vpn.error, code: vpn.code })
  }

  const body = parseJsonBody(req)
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const timeoutsUsed = Number(body.timeoutsUsed)
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  const salvageAnswer = typeof body.salvageAnswer === 'string' ? body.salvageAnswer.trim() : ''

  if (!sessionId) return json(res, 400, { error: 'sessionId required' })

  const session = await getWorldCupBallSession(sessionId)
  if (!session || session.status !== 'in_progress') {
    return json(res, 400, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'invalid_session' })
  }

  const ip = clientIp(req)
  const quizBypass = await isWorldCupBallQuizBypass(req)
  if (!quizBypass && session.ip_address && ip && session.ip_address !== ip) {
    return json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'ip_mismatch' })
  }

  if (sessionExpired(session.started_at)) {
    await finalizeWorldCupBallSession({
      sessionId,
      status: 'expired',
      timeoutsUsed: Number.isFinite(timeoutsUsed) ? timeoutsUsed : session.timeouts_used ?? 0,
      answers: parseSessionAnswers(session),
    })
    return json(res, 400, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'session_expired' })
  }

  const questionKeys = parseWorldCupBallSessionQuestionKeys(session)
  if (!questionKeys || questionKeys.length !== WORLD_CUP_BALL_QUESTION_COUNT) {
    return json(res, 400, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'invalid_session' })
  }

  const effectiveTimeouts = Number.isFinite(timeoutsUsed)
    ? timeoutsUsed
    : Number(session.timeouts_used) || 0
  const disqualified = isWorldCupBallDisqualifiedByTimeouts(effectiveTimeouts)

  if (salvageAnswer && session.salvage_question_key) {
    const mainAnswers = parseSessionAnswers(session)
    const validation = validateWorldCupBallAnswers(mainAnswers, questionKeys)
    const wrongCount = countWorldCupBallWrongAnswers(validation, questionKeys)
    const salvageQ = getWorldCupBallQuestionsByKeys([session.salvage_question_key])[0]
    const salvageCorrect =
      salvageQ && answerMatchesWorldCupBallAnswer(salvageAnswer, salvageQ.acceptedAnswers)
    const wrongReview = buildWorldCupBallWrongReview(mainAnswers, questionKeys)

    let status = 'lost'
    let claimToken = null
    if (!disqualified && wrongCount === WORLD_CUP_BALL_MAX_WRONG_FOR_SALVAGE && salvageCorrect) {
      ;({ status, claimToken } = await resolveWorldCupBallWinStatus(req))
    } else if (disqualified) {
      status = 'disqualified'
    }

    try {
      await finalizeWorldCupBallSession({
        sessionId,
        status,
        timeoutsUsed: effectiveTimeouts,
        answers: mainAnswers,
        claimToken,
      })

      await logEntryAttempt(req, {
        competition: COMPETITION_WORLD_CUP_BALL,
        flow: 'world_cup_ball_submit',
        ip,
        outcome: status,
        metadata: {
          session_id: sessionId,
          salvage: true,
          salvage_correct: salvageCorrect,
          wrong_count: wrongCount,
        },
      })

      return json(res, 200, {
        ok: true,
        result: status,
        allCorrect: status === 'won',
        disqualified,
        claimToken: status === 'won' ? claimToken : null,
        wrongReview: status === 'won' ? [] : wrongReview,
        salvageCorrect,
      })
    } catch (e) {
      console.error(e)
      return json(res, 500, { error: 'Could not save quiz result' })
    }
  }

  const validation = validateWorldCupBallAnswers(answers, questionKeys)
  const wrongCount = countWorldCupBallWrongAnswers(validation, questionKeys)
  const won = !disqualified && validation.allCorrect

  let status = 'lost'
  let claimToken = null
  if (disqualified) {
    status = 'disqualified'
  } else if (won) {
    ;({ status, claimToken } = await resolveWorldCupBallWinStatus(req))
  } else if (
    wrongCount === WORLD_CUP_BALL_MAX_WRONG_FOR_SALVAGE &&
    !session.salvage_question_key
  ) {
    const salvage = pickWorldCupBallSalvageQuestion(questionKeys)
    if (!salvage) {
      status = 'lost'
    } else {
      try {
        await saveWorldCupBallSalvageOffer({
          sessionId,
          answers,
          timeoutsUsed: effectiveTimeouts,
          salvageQuestionKey: salvage.questionKey,
        })
        return json(res, 200, {
          ok: true,
          result: 'salvage_bonus',
          allCorrect: false,
          disqualified: false,
          wrongCount,
          salvageQuestion: publicWorldCupBallQuestion(salvage.questionKey),
          claimToken: null,
        })
      } catch (e) {
        console.error(e)
        return json(res, 500, { error: 'Could not save quiz result' })
      }
    }
  }

  const wrongReview =
    status === 'lost' || status === 'disqualified'
      ? buildWorldCupBallWrongReview(answers, questionKeys)
      : []

  try {
    await finalizeWorldCupBallSession({
      sessionId,
      status,
      timeoutsUsed: effectiveTimeouts,
      answers,
      claimToken,
    })

    await logEntryAttempt(req, {
      competition: COMPETITION_WORLD_CUP_BALL,
      flow: 'world_cup_ball_submit',
      ip,
      outcome: status,
      metadata: {
        session_id: sessionId,
        all_correct: validation.allCorrect,
        disqualified,
        wrong_count: wrongCount,
      },
    })

    return json(res, 200, {
      ok: true,
      result: status,
      allCorrect: validation.allCorrect,
      disqualified,
      claimToken: status === 'won' ? claimToken : null,
      wrongReview,
      wrongCount,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not save quiz result' })
  }
}

/** GET /api/submissions/world-cup-ball/claim-status?token= */
export async function getWorldCupBallClaimStatus(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  const claimToken = typeof req.query?.token === 'string' ? req.query.token.trim() : ''
  if (!claimToken) return json(res, 400, { error: 'token required' })

  const session = await getWorldCupBallSessionByClaimToken(claimToken)
  if (!session || !['won', 'claimed'].includes(session.status)) {
    return json(res, 404, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'invalid_claim' })
  }

  const detailsComplete = session.status === 'claimed' || Boolean(session.claimed_at)
  return json(res, 200, {
    ok: true,
    status: session.status,
    detailsComplete,
    claimUrl: buildWorldCupBallClaimUrl(resolveSiteUrl(), claimToken),
    wonAt: session.submitted_at || null,
  })
}

/** POST /api/submissions/world-cup-ball/send-claim-link */
export async function sendWorldCupBallClaimLinkEmail(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const limited = applyRateLimit(req, res, { pathKey: 'wc-ball-claim-link', max: 4, windowMs: 60_000 })
  if (limited.blocked) return json(res, 429, { error: 'Too many requests. Please wait and try again.' })

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  const body = parseJsonBody(req)
  const claimToken = typeof body.claimToken === 'string' ? body.claimToken.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''

  if (!claimToken) return json(res, 400, { error: 'claimToken required' })
  if (!email.includes('@')) return json(res, 400, { error: 'A valid email address is required.' })

  const session = await getWorldCupBallSessionByClaimToken(claimToken)
  if (!session || session.status !== 'won') {
    if (session?.status === 'claimed') {
      return json(res, 200, {
        ok: true,
        alreadyClaimed: true,
        message: 'Your delivery details are already saved.',
      })
    }
    return json(res, 400, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'invalid_claim' })
  }

  const siteUrl = resolveSiteUrl()
  const claimUrl = buildWorldCupBallClaimUrl(siteUrl, claimToken)
  const emailResult = await sendWorldCupBallWinnerEmail({
    to: email,
    winReference: session.submission_id ? `WC-${String(session.id).slice(0, 8).toUpperCase()}` : undefined,
    wonAt: session.submitted_at || new Date().toISOString(),
    claimUrl,
    detailsComplete: false,
  })

  return json(res, 200, {
    ok: true,
    winnerEmail: {
      sent: Boolean(emailResult.ok),
      skipped: Boolean(emailResult.skipped),
      error: emailResult.error || null,
    },
    claimUrl,
  })
}

/** POST /api/submissions/world-cup-ball/claim */
export async function claimWorldCupBallPrize(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })

  const vpn = await checkVpnForRequest(req)
  if (!vpn.ok) return json(res, 403, { error: vpn.error, code: vpn.code })

  const body = parseJsonBody(req)
  const claimToken = typeof body.claimToken === 'string' ? body.claimToken.trim() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const phoneRaw =
    typeof body.phone === 'string'
      ? body.phone
      : typeof body.customerPhone === 'string'
        ? body.customerPhone
        : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''

  const entrantAgeBand = body.entrantAgeBand === '16-17' ? '16-17' : '18plus'
  const guardianName =
    typeof body.guardianName === 'string' ? body.guardianName.trim().slice(0, 200) : ''
  const guardianPhoneRaw =
    typeof body.guardianPhone === 'string'
      ? body.guardianPhone
      : typeof body.guardianContactPhone === 'string'
        ? body.guardianContactPhone
        : ''
  const guardianAddress = parsePostalAddress({
    addressLine1: body.guardianAddressLine1,
    addressLine2: body.guardianAddressLine2,
    city: body.guardianCity,
    postcode: body.guardianPostcode,
  })

  if (!claimToken) return json(res, 400, { error: 'claimToken required' })
  if (!fullName) return json(res, 400, { error: 'fullName required' })
  if (!email.includes('@')) return json(res, 400, { error: 'A valid email address is required.' })

  const phoneCheck = validateContactPhone(phoneRaw)
  if (!phoneCheck.ok) return json(res, 400, { error: phoneCheck.error })

  const address = parsePostalAddress(body)
  if (!address.ok) return json(res, 400, { error: address.error })

  if (entrantAgeBand === '16-17') {
    if (!guardianName) {
      return json(res, 400, { error: 'Parent or guardian full name is required for entrants aged 16 or 17.' })
    }
    const guardianPhoneCheck = validateContactPhone(guardianPhoneRaw)
    if (!guardianPhoneCheck.ok) {
      return json(res, 400, { error: guardianPhoneCheck.error || 'A valid parent/guardian mobile number is required.' })
    }
    if (!guardianAddress.ok) {
      return json(res, 400, { error: 'A complete parent or guardian UK delivery address is required for entrants aged 16 or 17.' })
    }
  }

  const session = await getWorldCupBallSessionByClaimToken(claimToken)
  if (!session || session.status !== 'won') {
    return json(res, 400, { error: FREE_ENTRY_ERRORS.worldCupBallInvalidSession, code: 'invalid_claim' })
  }

  const ip = clientIp(req)

  const nameKey = normalizePersonName(fullName)
  const phoneKey = phoneCheck.phone.replace(/\D/g, '')
  const addressKey = buildNameAddressKey({ fullName, ...address })

  const quizBypass = await isWorldCupBallQuizBypass(req)
  if (!quizBypass) {
    if (await hasWorldCupBallWinnerClaim(nameKey, phoneKey, addressKey)) {
      const nameRow = await query(`SELECT 1 FROM world_cup_ball_winners WHERE name_key = $1`, [nameKey])
      if (nameRow.rows[0]) {
        return json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallNameUsed, code: 'name_used' })
      }
      const phoneRow = await query(`SELECT 1 FROM world_cup_ball_winners WHERE phone_key = $1`, [phoneKey])
      if (phoneRow.rows[0]) {
        return json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallPhoneUsed, code: 'phone_used' })
      }
      return json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallAddressUsed, code: 'address_used' })
    }

    const winners = await countWorldCupBallWinners()
    if (winners >= 1) {
      return json(res, 403, { error: FREE_ENTRY_ERRORS.worldCupBallAlreadyWon, code: 'prize_claimed' })
    }
  }

  try {
    const submissionId = randomUUID()
    const winReference = `WC-${submissionId.slice(0, 8).toUpperCase()}`
    let adminNotes = `${WORLD_CUP_BALL_GIVEAWAY_LABEL} — instant skill win.\nAll ${WORLD_CUP_BALL_QUESTION_COUNT} answers correct.\nTimeouts used: ${session.timeouts_used ?? 0}\nEntrant age band: ${entrantAgeBand} (${WORLD_CUP_BALL_MIN_AGE}+ required).\nEmail: ${email}\nContact phone: ${phoneCheck.phone}\nDelivery address: ${address.addressLine1}${address.addressLine2 ? `, ${address.addressLine2}` : ''}, ${address.city}, ${address.postcode}`
    if (entrantAgeBand === '16-17') {
      const guardianPhoneCheck = validateContactPhone(guardianPhoneRaw)
      adminNotes += `\nParent/guardian: ${guardianName}\nGuardian phone: ${guardianPhoneCheck.phone}\nGuardian address: ${guardianAddress.addressLine1}${guardianAddress.addressLine2 ? `, ${guardianAddress.addressLine2}` : ''}, ${guardianAddress.city}, ${guardianAddress.postcode}`
    }
    await query(
      `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename, admin_notes, entry_number, competition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        submissionId,
        fullName,
        email,
        'skill:world-cup-ball-giveaway',
        `Phone: ${phoneCheck.phone}`,
        adminNotes,
        winReference,
        WORLD_CUP_BALL_GIVEAWAY_SLUG,
      ],
    )

    const winnerId = await recordWorldCupBallWinner({
      sessionId: session.id,
      submissionId,
      fullName,
      phone: phoneCheck.phone,
      nameKey,
      phoneKey,
      addressKey,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      postcode: address.postcode,
      email,
    })

    const claimUrl = buildWorldCupBallClaimUrl(resolveSiteUrl(), claimToken)
    const emailResult = await sendWorldCupBallWinnerEmail({
      to: email,
      customerFullName: fullName,
      customerPhone: phoneCheck.phone,
      winReference,
      wonAt: session.submitted_at || new Date().toISOString(),
      claimUrl,
      detailsComplete: true,
    })
    if (emailResult.ok && emailResult.id) {
      await markWorldCupBallWinnerEmailSent(winnerId, emailResult.id)
    }

    await logEntryAttempt(req, {
      competition: COMPETITION_WORLD_CUP_BALL,
      flow: 'world_cup_ball_claim',
      fullName,
      ip,
      addressKey,
      outcome: 'success',
      metadata: { submission_id: submissionId },
    })

    return json(res, 200, {
      ok: true,
      won: true,
      submissionId,
      winReference,
      winnerEmail: {
        sent: Boolean(emailResult.ok),
        skipped: Boolean(emailResult.skipped),
        error: emailResult.error || null,
        deliveredTo: emailResult.deliveredTo || null,
      },
      claimUrl,
      detailsComplete: true,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not record winner details' })
  }
}

/** Router for legacy single-path mount — defaults to start. */
export default async function handler(req, res) {
  return startWorldCupBallSession(req, res)
}
