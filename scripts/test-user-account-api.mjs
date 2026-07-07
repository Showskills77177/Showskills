#!/usr/bin/env node
/** Smoke test user account APIs: register, profile, entries, newsletter, resend, delete. */
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { readFileSync } from 'node:fs'

const PORT = 3103
const base = `http://127.0.0.1:${PORT}`
const e2eSecret = 'e2e-dev-only-secret'

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
    for (const pid of out.split(/\s+/)) if (pid) process.kill(Number(pid), 'SIGKILL')
  } catch {}
}

function extractCookie(res, name) {
  const rawList =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean)
  for (const raw of rawList) {
    const m = String(raw).match(new RegExp(`^${name}=([^;]+)`))
    if (m) return `${name}=${m[1]}`
  }
  return ''
}

async function api(path, { method = 'GET', cookie = '', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

let env = {
  ...process.env,
  PORT: String(PORT),
  SQLITE_PATH: 'db/e2e.sqlite',
  E2E_MODE: '1',
  E2E_SECRET: e2eSecret,
  NEWSLETTER_SEND_WELCOME: '0',
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

  const email = `account-smoke-${Date.now()}@example.test`
  const password = 'SmokeTestPass1!'
  const newPassword = 'SmokeTestPass2!'

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password, fullName: 'Smoke Tester' },
  })
  if (!reg.res.ok || !reg.data.ok) {
    throw new Error(`register failed: ${reg.res.status} ${JSON.stringify(reg.data)}`)
  }
  let cookie = extractCookie(reg.res, 'user_session')
  if (!cookie) throw new Error('register did not set user_session cookie')

  const me = await api('/api/auth/me', { cookie })
  if (!me.res.ok || me.data.user?.email !== email) {
    throw new Error(`me failed: ${me.res.status} ${JSON.stringify(me.data)}`)
  }

  const profileGet = await api('/api/auth/profile', { cookie })
  if (!profileGet.res.ok || !profileGet.data.profile) {
    throw new Error(`profile GET failed: ${profileGet.res.status}`)
  }

  const profilePatch = await api('/api/auth/profile', {
    method: 'PATCH',
    cookie,
    body: { fullName: 'Smoke Updated', phone: '07123456789' },
  })
  if (!profilePatch.res.ok || profilePatch.data.profile?.fullName !== 'Smoke Updated') {
    throw new Error(`profile PATCH failed: ${profilePatch.res.status} ${JSON.stringify(profilePatch.data)}`)
  }

  const newsletter = await api('/api/auth/newsletter', {
    method: 'PATCH',
    cookie,
    body: { preferences: { competitions: true, winners: false } },
  })
  if (!newsletter.res.ok || !newsletter.data.preferences) {
    throw new Error(`newsletter PATCH failed: ${newsletter.res.status} ${JSON.stringify(newsletter.data)}`)
  }

  const entriesEmpty = await api('/api/auth/entries', { cookie })
  if (!entriesEmpty.res.ok || !Array.isArray(entriesEmpty.data.entries)) {
    throw new Error(`entries GET failed: ${entriesEmpty.res.status}`)
  }
  if (entriesEmpty.data.entries.length !== 0) {
    throw new Error(`expected no entries before purchase, got ${entriesEmpty.data.entries.length}`)
  }

  const mock = await fetch(`${base}/api/e2e/mock-paid-completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-secret': e2eSecret,
    },
    body: JSON.stringify({
      customerEmail: email,
      customerFullName: 'Smoke Updated',
      bundleId: 'single',
    }),
  })
  const mockData = await mock.json()
  if (!mock.ok || !mockData.ticketId) {
    throw new Error(`mock paid completion failed: ${mock.status} ${JSON.stringify(mockData)}`)
  }

  const entries = await api('/api/auth/entries', { cookie })
  if (!entries.res.ok) throw new Error(`entries after purchase failed: ${entries.res.status}`)
  const paid = entries.data.entries?.find((e) => e.kind === 'paid_ticket')
  if (!paid) throw new Error(`expected paid_ticket entry: ${JSON.stringify(entries.data.entries)}`)
  if (!paid.orderRef || !paid.ticketNumbers?.length) {
    throw new Error(`paid entry missing refs: ${JSON.stringify(paid)}`)
  }
  if (paid.quizStatus !== 'pending') {
    throw new Error(`expected pending quiz, got ${paid.quizStatus}`)
  }

  const resend = await api('/api/auth/resend-entry-email', {
    method: 'POST',
    cookie,
    body: { ticketId: mockData.ticketId },
  })
  if (env.RESEND_API_KEY?.startsWith('re_')) {
    if (!resend.res.ok || !resend.data.emailSent) {
      throw new Error(`resend-entry-email failed: ${resend.res.status} ${JSON.stringify(resend.data)}`)
    }
  } else if (resend.res.status !== 400) {
    throw new Error(`resend without Resend should 400, got ${resend.res.status}`)
  }

  const changePw = await api('/api/auth/change-password', {
    method: 'POST',
    cookie,
    body: { currentPassword: password, newPassword },
  })
  if (!changePw.res.ok) {
    throw new Error(`change-password failed: ${changePw.res.status} ${JSON.stringify(changePw.data)}`)
  }

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: newPassword },
  })
  if (!login.res.ok) {
    throw new Error(`login with new password failed: ${login.res.status} ${JSON.stringify(login.data)}`)
  }
  cookie = extractCookie(login.res, 'user_session') || cookie

  const del = await api('/api/auth/delete-account', {
    method: 'POST',
    cookie,
    body: { password: newPassword },
  })
  if (!del.res.ok || !del.data.ok) {
    throw new Error(`delete-account failed: ${del.res.status} ${JSON.stringify(del.data)}`)
  }

  const loginAfter = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: newPassword },
  })
  if (loginAfter.res.ok) {
    throw new Error('login after delete should fail')
  }

  console.log('user account API smoke tests passed')
} finally {
  child.kill('SIGTERM')
}
