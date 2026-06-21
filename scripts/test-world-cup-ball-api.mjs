#!/usr/bin/env node
/** Smoke test World Cup Ball API: start → perfect score → claim form save. */
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { WORLD_CUP_BALL_QUESTION_BANK } from '../shared/worldCupBallQuestionBank.mjs'

const PORT = 3099
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

async function resetWcBallData() {
  process.env.SQLITE_PATH = 'db/e2e.sqlite'
  const { query } = await import('../backend/api/lib/db.mjs')
  const { ensureWorldCupBallSchema } = await import('../backend/api/lib/worldCupBallSchema.mjs')
  await ensureWorldCupBallSchema()
  await query(`DELETE FROM world_cup_ball_winners`)
  await query(`DELETE FROM world_cup_ball_sessions`)
  await query(`DELETE FROM kickup_submissions WHERE competition = 'world_cup_ball_giveaway'`)
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
  await resetWcBallData()

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

    const startRes = await fetch(`${base}/api/submissions/world-cup-ball/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const start = await startRes.json()
    if (!startRes.ok || !start.sessionId) {
      throw new Error(`start failed: ${startRes.status} ${JSON.stringify(start)}`)
    }
    if (!Array.isArray(start.questions) || start.questions.length !== 10) {
      throw new Error(`expected 10 questions, got ${start.questions?.length}`)
    }
    const mc = start.questions.filter((q) => Array.isArray(q.choices) && q.choices.length > 0)
    if (mc.length < 2) {
      throw new Error(`expected at least 2 MC questions, got ${mc.length}`)
    }

    if (mc.length < 2) {
      throw new Error(`expected at least 2 MC questions, got ${mc.length}`)
    }

    const [q1, q2, q3] = start.questions
    const oneWrongRes = await fetch(`${base}/api/submissions/world-cup-ball/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: start.sessionId,
        timeoutsUsed: 0,
        partialCheck: true,
        answers: {
          [q1.questionKey]: bankByKey.get(q1.questionKey).acceptedAnswers[0],
          [q2.questionKey]: 'definitely wrong',
        },
      }),
    })
    const oneWrong = await oneWrongRes.json()
    if (!oneWrongRes.ok || !oneWrong.continue) {
      throw new Error(`partial check after one wrong failed: ${oneWrongRes.status} ${JSON.stringify(oneWrong)}`)
    }

    const twoWrongRes = await fetch(`${base}/api/submissions/world-cup-ball/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: start.sessionId,
        timeoutsUsed: 0,
        partialCheck: true,
        answers: {
          [q1.questionKey]: bankByKey.get(q1.questionKey).acceptedAnswers[0],
          [q2.questionKey]: 'definitely wrong',
          [q3.questionKey]: 'also wrong',
        },
      }),
    })
    const twoWrong = await twoWrongRes.json()
    if (!twoWrongRes.ok || twoWrong.result !== 'lost' || !twoWrong.earlyExit) {
      throw new Error(`early exit after two wrong failed: ${twoWrongRes.status} ${JSON.stringify(twoWrong)}`)
    }
    if (!Array.isArray(twoWrong.wrongReview) || twoWrong.wrongReview.length !== 2) {
      throw new Error(`expected two wrong-review rows, got ${JSON.stringify(twoWrong.wrongReview)}`)
    }

    const start2Res = await fetch(`${base}/api/submissions/world-cup-ball/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const start2 = await start2Res.json()
    if (!start2Res.ok || !start2.sessionId) {
      throw new Error(`second start failed: ${start2Res.status} ${JSON.stringify(start2)}`)
    }

    const answers = buildCorrectAnswers(start2.questions)
    const submitRes = await fetch(`${base}/api/submissions/world-cup-ball/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: start2.sessionId,
        timeoutsUsed: 0,
        answers,
      }),
    })
    const submit = await submitRes.json()
    if (!submitRes.ok || submit.result !== 'won' || !submit.claimToken) {
      throw new Error(`submit win failed: ${submitRes.status} ${JSON.stringify(submit)}`)
    }

    const claimRes = await fetch(`${base}/api/submissions/world-cup-ball/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimToken: submit.claimToken,
        entrantAgeBand: '18plus',
        fullName: 'Test Winner',
        email: 'wc-ball-winner@test.local',
        phone: '07700900456',
        addressLine1: '1 Test Street',
        addressLine2: '',
        city: 'London',
        postcode: 'SW1A 1AA',
      }),
    })
    const claim = await claimRes.json()
    if (!claimRes.ok || !claim.winReference) {
      throw new Error(`claim failed: ${claimRes.status} ${JSON.stringify(claim)}`)
    }

    const statusRes = await fetch(
      `${base}/api/submissions/world-cup-ball/claim-status?token=${encodeURIComponent(submit.claimToken)}`,
    )
    const status = await statusRes.json()
    if (!statusRes.ok || !status.detailsComplete) {
      throw new Error(`claim-status failed: ${statusRes.status} ${JSON.stringify(status)}`)
    }

    const invalidRes = await fetch(
      `${base}/api/submissions/world-cup-ball/claim-status?token=invalid-token-test`,
    )
    if (invalidRes.status !== 404) {
      throw new Error(`claim-status should 404 invalid token, got ${invalidRes.status}`)
    }

    console.log('world cup ball API smoke tests passed (including winner claim form)')
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
