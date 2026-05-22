/**
 * Login + GET/POST /api/admin/draw-winner against local API (port 3000).
 * Run after: node scripts/seed-draw-pool.mjs
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const base = 'http://127.0.0.1:3000'
const user = (process.env.ADMIN_USER || 'admin').trim()
const pass = process.env.ADMIN_PASSWORD || ''

function parseCookies(setCookie) {
  const jar = new Map()
  for (const line of [].concat(setCookie || [])) {
    const part = String(line).split(';')[0]
    const i = part.indexOf('=')
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  return jar
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

const loginRes = await fetch(`${base}/api/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: user, password: pass }),
})
const loginJson = await loginRes.json().catch(() => ({}))
if (!loginRes.ok) {
  console.error('Login failed:', loginRes.status, loginJson)
  process.exit(1)
}
if (loginJson.verificationRequired || loginJson.smsRequired) {
  console.error('Still asked for email OTP — restart API (npm run dev:all) after OTP bypass change.')
  process.exit(1)
}

const jar = parseCookies(loginRes.headers.getSetCookie?.() ?? loginRes.headers.get('set-cookie'))
const headers = { Cookie: cookieHeader(jar), 'Content-Type': 'application/json' }

const statsRes = await fetch(`${base}/api/admin/draw-winner`, { headers })
const stats = await statsRes.json()
console.log('Pool:', stats.poolSize, 'slots,', stats.uniqueEntrants, 'entrants')
if (!stats.poolSize) {
  console.error('Empty pool — run: node scripts/seed-draw-pool.mjs')
  process.exit(1)
}

const drawRes = await fetch(`${base}/api/admin/draw-winner`, { method: 'POST', headers })
const draw = await drawRes.json()
if (!drawRes.ok) {
  console.error('Draw failed:', drawRes.status, draw)
  process.exit(1)
}
console.log('Winner:', draw.winner.ticketNumber, '—', draw.winner.fullName, draw.winner.email)
console.log('Pool index:', draw.randomIndex, '/', draw.poolSize)
