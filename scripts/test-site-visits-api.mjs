#!/usr/bin/env node
/** Smoke test site visits analytics + admin report + staging reset gating. */
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { readFileSync } from 'node:fs'
import { isWorldCupBallStagingResetServerEnabled } from '../shared/worldCupBallStagingReset.mjs'

const PORT = 3102
const base = `http://127.0.0.1:${PORT}`

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    for (const pid of out.split(/\s+/)) if (pid) process.kill(Number(pid), 'SIGKILL')
  } catch {}
}

let env = {
  ...process.env,
  PORT: String(PORT),
  SQLITE_PATH: 'db/e2e.sqlite',
  E2E_MODE: '1',
  VERCEL_GIT_COMMIT_REF: 'staging',
}
try {
  const dotenv = readFileSync('.env', 'utf8')
  for (const line of dotenv.split('\n')) {
    const m = line.match(/^ADMIN_JWT_SECRET=(.+)$/)
    if (m) env.ADMIN_JWT_SECRET = m[1].trim()
  }
} catch {}
if (!env.ADMIN_JWT_SECRET || env.ADMIN_JWT_SECRET.length < 32) {
  env.ADMIN_JWT_SECRET = 'e2e-test-admin-jwt-secret-32chars-min'
}
process.env.ADMIN_JWT_SECRET = env.ADMIN_JWT_SECRET

killPort(PORT)
await sleep(200)

const child = spawn('node', ['server.js'], { cwd: process.cwd(), env, stdio: 'ignore' })
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break
    } catch {}
    await sleep(250)
  }

  const viewRes = await fetch(`${base}/api/analytics/page-view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vercel-ip-country': 'GB',
    },
    body: JSON.stringify({
      sessionId: 'test-visit-session-1',
      path: '/',
      utmSource: 'tiktok',
      utmMedium: 'social',
      referrer: 'https://www.tiktok.com/@showskills',
    }),
  })
  const view = await viewRes.json()
  if (!viewRes.ok || !view.ok) throw new Error(`page-view failed: ${viewRes.status} ${JSON.stringify(view)}`)

  const { signAdminSession } = await import('../backend/api/lib/adminAuth.mjs')
  const token = await signAdminSession()
  const adminRes = await fetch(`${base}/api/admin/site-visits?period=24h`, {
    headers: { Cookie: `admin_session=${token}` },
  })
  const admin = await adminRes.json()
  if (!adminRes.ok) throw new Error(`admin site-visits failed: ${adminRes.status}`)
  if (!admin.summary?.pageViews) throw new Error(`expected page views, got ${JSON.stringify(admin.summary)}`)
  if (!admin.visitsByCountry?.some((r) => r.countryCode === 'GB')) {
    throw new Error(`expected GB country row: ${JSON.stringify(admin.visitsByCountry)}`)
  }

  const resetRes = await fetch(`${base}/api/submissions/world-cup-ball/reset-attempt`, {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.50' },
  })
  const reset = await resetRes.json()
  if (!resetRes.ok || !reset.ok) throw new Error(`staging reset failed: ${resetRes.status} ${JSON.stringify(reset)}`)

  process.env.VERCEL_GIT_COMMIT_REF = 'main'
  process.env.SITE_URL = 'https://showskills.com'
  if (isWorldCupBallStagingResetServerEnabled()) {
    throw new Error('staging reset should be disabled on production main env')
  }

  process.env.VERCEL_GIT_COMMIT_REF = 'staging'
  process.env.SITE_URL = ''
  if (!isWorldCupBallStagingResetServerEnabled()) {
    throw new Error('staging reset should be enabled when VERCEL_GIT_COMMIT_REF=staging')
  }

  process.env.VERCEL_GIT_COMMIT_REF = 'main'
  process.env.SITE_URL = 'https://vercelshowskillstesteasynow.online'
  if (!isWorldCupBallStagingResetServerEnabled()) {
    throw new Error('staging reset should be enabled on staging hostname')
  }

  console.log('site visits + staging reset smoke tests passed')
} finally {
  child.kill('SIGTERM')
}
