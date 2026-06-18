#!/usr/bin/env node
/** Smoke test World Cup Ball API: start → submit (mock win path check) → claim-status. */
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 3099
const base = `http://127.0.0.1:${PORT}`

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

async function main() {
  killPort(PORT)
  await sleep(200)
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

    const statusRes = await fetch(
      `${base}/api/submissions/world-cup-ball/claim-status?token=invalid-token-test`,
    )
    if (statusRes.status !== 404) {
      throw new Error(`claim-status should 404 invalid token, got ${statusRes.status}`)
    }

    console.log('world cup ball API smoke tests passed')
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
