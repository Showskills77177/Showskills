#!/usr/bin/env node
/** Smoke test Ronaldo Shirt Quiz API: start → perfect score → kickups entry with pass token.
 *  Also covers: 3-mistake loss (no token), and a 1-mistake salvage win. */
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { WORLD_CUP_BALL_QUESTION_BANK } from '../shared/worldCupBallQuestionBank.mjs'

const PORT = 3098
const base = `http://127.0.0.1:${PORT}`
const bankByKey = new Map(WORLD_CUP_BALL_QUESTION_BANK.map((q) => [q.questionKey, q]))

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    for (const pid of out.split(/\s+/)) {
      if (pid) process.kill(Number(pid), 'SIGKILL')
    }
  } catch {
    /* port free */
  }
}

async function resetData() {
  process.env.SQLITE_PATH = 'db/e2e.sqlite'
  const { query } = await import('../backend/api/lib/db.mjs')
  const { ensureRonaldoShirtQuizSchema } = await import('../backend/api/lib/ronaldoShirtQuizSchema.mjs')
  const { ensureShirtEntrySchema } = await import('../backend/api/lib/shirtEntryNumbers.mjs')
  const { ensureEntryAttemptLogSchema } = await import('../backend/api/lib/ensureFreeEntrySchema.mjs')
  const { COMPETITION_SHIRT_GIVEAWAY } = await import('../shared/freeEntryLimits.mjs')
  await ensureRonaldoShirtQuizSchema()
  await ensureShirtEntrySchema()
  await ensureEntryAttemptLogSchema()
  await query(`DELETE FROM ronaldo_shirt_quiz_sessions`)
  await query(`DELETE FROM kickup_submissions WHERE competition = $1`, [COMPETITION_SHIRT_GIVEAWAY])
  await query(`DELETE FROM entry_attempt_logs WHERE competition = $1`, [COMPETITION_SHIRT_GIVEAWAY])
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error('API did not start')
}

function buildCorrectAnswers(questions) {
  const answers = {}
  for (const q of questions) {
    const bank = bankByKey.get(q.questionKey)
    if (!bank) throw new Error(`missing question bank key: ${q.questionKey}`)
    answers[q.questionKey] = bank.acceptedAnswers[0]
  }
  return answers
}

async function main() {
  killPort(PORT)
  await sleep(200)
  await resetData()

  const child = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      SQLITE_PATH: 'db/e2e.sqlite',
      E2E_MODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let bootLog = ''
  child.stderr.on('data', (c) => {
    bootLog += c.toString()
  })
  child.stdout.on('data', (c) => {
    bootLog += c.toString()
  })

  try {
    await waitForHealth()

    // 1) Perfect score → win → passToken → kickups entry succeeds.
    const startRes = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const start = await startRes.json()
    if (!startRes.ok || !start.sessionId) {
      throw new Error(`start failed: ${startRes.status} ${JSON.stringify(start)}`)
    }
    if (!Array.isArray(start.questions) || start.questions.length !== 25) {
      throw new Error(`expected 25 questions, got ${start.questions?.length}`)
    }

    const answers = buildCorrectAnswers(start.questions)
    const submitRes = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: start.sessionId, timeoutsUsed: 0, answers }),
    })
    const submit = await submitRes.json()
    if (!submitRes.ok || submit.result !== 'won' || !submit.passToken) {
      throw new Error(`submit win failed: ${submitRes.status} ${JSON.stringify(submit)}`)
    }

    const kickRes = await fetch(`${base}/api/submissions/kickups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Ronaldo Quiz Winner',
        email: 'ronaldo-quiz-winner@test.local',
        phone: '07700900123',
        quizPassToken: submit.passToken,
        newsletterOptIn: true,
        socialPlatform: 'instagram',
        socialHandle: 'quizwinner',
        socialFollowConfirmed: true,
      }),
    })
    const kick = await kickRes.json()
    if (!kickRes.ok || !kick.ok || !kick.entryNumber) {
      throw new Error(`kickups entry with pass token failed: ${kickRes.status} ${JSON.stringify(kick)}`)
    }

    // Re-using a consumed pass token must fail.
    const reuseRes = await fetch(`${base}/api/submissions/kickups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Second Person',
        email: 'ronaldo-quiz-reuse@test.local',
        phone: '07700900124',
        quizPassToken: submit.passToken,
        newsletterOptIn: true,
        socialPlatform: 'instagram',
        socialHandle: 'reuser',
        socialFollowConfirmed: true,
      }),
    })
    if (reuseRes.status !== 400) {
      throw new Error(`expected consumed pass token to be rejected, got ${reuseRes.status}`)
    }

    // 2) 3 mistakes in the base 25 → lost, no pass token.
    const start2Res = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
    })
    const start2 = await start2Res.json()
    if (!start2Res.ok || !start2.sessionId) {
      throw new Error(`second start failed: ${start2Res.status} ${JSON.stringify(start2)}`)
    }
    const answers2 = buildCorrectAnswers(start2.questions)
    const qKeys2 = Object.keys(answers2)
    answers2[qKeys2[0]] = 'definitely wrong'
    answers2[qKeys2[1]] = 'also wrong'
    answers2[qKeys2[2]] = 'still wrong'
    const submit2Res = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
      body: JSON.stringify({ sessionId: start2.sessionId, timeoutsUsed: 0, answers: answers2 }),
    })
    const submit2 = await submit2Res.json()
    if (!submit2Res.ok || submit2.result !== 'lost' || submit2.passToken) {
      throw new Error(`3-mistake loss check failed: ${submit2Res.status} ${JSON.stringify(submit2)}`)
    }

    // 3) 1 mistake → salvage question offered → answer correctly → won with passToken.
    const start3Res = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
    })
    const start3 = await start3Res.json()
    if (!start3Res.ok || !start3.sessionId) {
      throw new Error(`third start failed: ${start3Res.status} ${JSON.stringify(start3)}`)
    }
    const answers3 = buildCorrectAnswers(start3.questions)
    const qKeys3 = Object.keys(answers3)
    answers3[qKeys3[0]] = 'definitely wrong'
    const submit3Res = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
      body: JSON.stringify({ sessionId: start3.sessionId, timeoutsUsed: 0, answers: answers3 }),
    })
    const submit3 = await submit3Res.json()
    if (!submit3Res.ok || submit3.result !== 'salvage_bonus' || !submit3.salvageQuestion) {
      throw new Error(`salvage offer failed: ${submit3Res.status} ${JSON.stringify(submit3)}`)
    }
    const salvageBank = bankByKey.get(submit3.salvageQuestion.questionKey)
    if (!salvageBank) throw new Error(`missing salvage bank entry: ${submit3.salvageQuestion.questionKey}`)
    const salvageRes = await fetch(`${base}/api/submissions/ronaldo-shirt-quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
      body: JSON.stringify({
        sessionId: start3.sessionId,
        timeoutsUsed: 0,
        salvageAnswer: salvageBank.acceptedAnswers[0],
      }),
    })
    const salvage = await salvageRes.json()
    if (!salvageRes.ok || salvage.result !== 'won' || !salvage.passToken) {
      throw new Error(`salvage win failed: ${salvageRes.status} ${JSON.stringify(salvage)}`)
    }

    // 4) kickups rejects a missing/invalid pass token outright.
    const noTokenRes = await fetch(`${base}/api/submissions/kickups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'No Token',
        email: 'no-token@test.local',
        phone: '07700900125',
        quizPassToken: '',
        newsletterOptIn: true,
        socialPlatform: 'instagram',
        socialHandle: 'notoken',
        socialFollowConfirmed: true,
      }),
    })
    if (noTokenRes.status !== 400) {
      throw new Error(`expected missing pass token to be rejected, got ${noTokenRes.status}`)
    }

    console.log('ronaldo shirt quiz API smoke tests passed (win+entry, reuse-block, 3-mistake loss, salvage win, no-token block)')
  } catch (err) {
    console.error(bootLog)
    throw err
  } finally {
    child.kill('SIGTERM')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
