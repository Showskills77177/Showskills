/**
 * Smoke test: £0 free-entry verification APIs (no browser).
 * Uses .env.local — same as npm run dev:all.
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const base = process.env.API_BASE || 'http://127.0.0.1:3000'

const payload = {
  fullName: 'Local Test User',
  email: `free-test-${Date.now()}@example.test`,
  phone: '07700900123',
  addressLine1: '1 Test Street',
  city: 'London',
  postcode: 'SW1A1AA',
}

console.log('POST', `${base}/api/create-cashflows-free-verification`)
const createRes = await fetch(`${base}/api/create-cashflows-free-verification`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
const create = await createRes.json().catch(() => ({}))
if (!createRes.ok) {
  console.error('create FAILED', createRes.status, create)
  process.exit(1)
}
console.log('create OK — paymentJobReference:', create.paymentJobReference)
console.log('token:', `${String(create.token || '').slice(0, 16)}…`)
console.log('\nNext: open http://localhost:5174 → Legacy entry → Free online → verify card in browser.')
console.log('Sandbox cards: docs/CASHFLOWS-TESTING.md (npm run dev:integration)')
