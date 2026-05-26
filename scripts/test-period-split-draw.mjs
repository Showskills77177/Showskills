/**
 * Login, verify isolated draw pools per period, draw one period, resend winner email.
 * Prerequisites: API on :3000 (npm run dev:all), npm run seed:period-split
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

const jar = parseCookies(loginRes.headers.getSetCookie?.() ?? loginRes.headers.get('set-cookie'))
const headers = { Cookie: cookieHeader(jar), 'Content-Type': 'application/json' }

const periods = ['legacy-main-test', 'legacy-bundle-test-3']
for (const periodId of periods) {
  const res = await fetch(`${base}/api/admin/draw-winner?periodId=${encodeURIComponent(periodId)}`, {
    headers,
  })
  const j = await res.json()
  if (!res.ok) {
    console.error(periodId, 'GET failed', j)
    process.exit(1)
  }
  console.log(`${periodId}: pool=${j.poolSize} period="${j.period?.title}" canDraw=${j.canDraw}`)
}

const drawPeriod = process.argv[2] || 'legacy-bundle-test-3'
const pre = await fetch(`${base}/api/admin/draw-winner?periodId=${encodeURIComponent(drawPeriod)}`, { headers })
const preJson = await pre.json()
if (!preJson.canDraw) {
  console.error(`Period ${drawPeriod} cannot be drawn (status=${preJson.period?.status}, pool=${preJson.poolSize})`)
  console.error('Re-run: npm run seed:period-split')
  process.exit(1)
}

const drawRes = await fetch(`${base}/api/admin/draw-winner`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ periodId: drawPeriod, sendWinnerEmail: true }),
})
const draw = await drawRes.json()
if (!drawRes.ok) {
  console.error('Draw failed:', drawRes.status, draw)
  process.exit(1)
}

console.log('\nWinner:', draw.winner?.ticketNumber, draw.winner?.email, draw.winner?.phone)
console.log('Email:', draw.winnerEmail)

const drawId = draw.draw?.id || draw.drawId
if (drawId) {
  const resendRes = await fetch(`${base}/api/admin/resend-winner-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ drawId }),
  })
  const resend = await resendRes.json()
  console.log('Resend:', resendRes.status, resend)
}
