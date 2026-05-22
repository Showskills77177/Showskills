/**
 * Local API server for `npm run dev:api` (port 3000).
 * Vite proxies `/api` here. Production uses `api/*` serverless routes (see `api/_dispatch.mjs`).
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import express from 'express'
import cors from 'cors'
import multer from 'multer'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

const dbUrl = process.env.DATABASE_URL?.trim()
if (dbUrl?.startsWith('postgres')) {
  console.log('API database: PostgreSQL (DATABASE_URL)')
} else {
  const sqliteRel = process.env.SQLITE_PATH || 'db/db.sqlite'
  console.log('API database: SQLite at', resolve(process.cwd(), sqliteRel))
}

const resendKey = process.env.RESEND_API_KEY?.trim()
if (resendKey?.startsWith('re_')) {
  const { getAdminEmailSetupHint, isAdminEmailOtpConfigured, isAdminEmailOtpBypassed } =
    await import('./backend/api/lib/adminEmailOtp.mjs')
  if (isAdminEmailOtpBypassed()) {
    console.log('[admin] Local sign-in: password only (email OTP skipped)')
  } else if (isAdminEmailOtpConfigured()) {
    const hint = getAdminEmailSetupHint()
    if (hint) console.warn('[email]', hint)
    else console.log('[email] Resend configured (admin OTP + quiz confirmations)')
  } else {
    console.log('[email] Resend key set; set ADMIN_EMAIL for admin OTP step')
  }
} else {
  console.warn('[email] RESEND_API_KEY not set — purchase/quiz emails and admin OTP are disabled')
}

const PORT = parseInt(process.env.PORT || '3000', 10)

function adapt(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      } else {
        next(err)
      }
    })
  }
}

const app = express()
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
const stripeWebhookHandler = (await import('./backend/api/stripe-webhook.js')).default
app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  adapt(stripeWebhookHandler),
)

app.use(express.json({ limit: '2mb' }))

/**
 * POST /api/login — env-based check (curl-friendly).
 * Uses ADMIN_USER / ADMIN_PASSWORD from .env.local (same as admin panel).
 */
const kickupVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
})

app.post('/api/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const adminUser = (process.env.ADMIN_USER || '').trim()
  const adminPass = (process.env.ADMIN_PASSWORD || '').trim()

  if (!adminUser || !adminPass) {
    return res.status(503).json({ error: 'Set ADMIN_USER and ADMIN_PASSWORD in .env.local' })
  }
  if (username === adminUser && password === adminPass) {
    return res.status(200).json({ ok: true })
  }
  return res.status(401).json({ error: 'Invalid credentials' })
})

const kickupsUploadHandler = (await import('./backend/api/submissions/kickups-upload.mjs')).default
app.post(
  '/api/submissions/kickups/upload',
  kickupVideoUpload.single('video'),
  adapt(kickupsUploadHandler),
)

/** Same handlers as Vercel production (`api/_dispatch.mjs`) — avoids missing local routes. */
const { routes } = await import('./api/_dispatch.mjs')
const SKIP_ROUTE_MOUNT = new Set([
  '/api/stripe-webhook',
  '/api/submissions/kickups/upload',
])

for (const [routePath, handler] of Object.entries(routes)) {
  if (SKIP_ROUTE_MOUNT.has(routePath)) continue
  app.all(routePath, adapt(handler))
}

const mountedPaths = Object.keys(routes)
  .filter((p) => !SKIP_ROUTE_MOUNT.has(p))
  .sort()
for (const required of ['/api/admin/verify-sms', '/api/admin/resend-code']) {
  if (!mountedPaths.includes(required)) {
    console.error(`[api] FATAL: ${required} missing from dispatch routes`)
    process.exit(1)
  }
}
console.log(
  `[api] Mounted ${mountedPaths.length} routes (admin login, verify-sms, resend-code, Resend OTP)`,
)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    port: PORT,
    adminVerifySms: mountedPaths.includes('/api/admin/verify-sms'),
    adminResendCode: mountedPaths.includes('/api/admin/resend-code'),
    resendOtp: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ADMIN_EMAIL?.trim()),
  })
})

if (process.env.E2E_MODE === '1' || process.env.E2E_MODE === 'true') {
  const { recordStripeCheckoutCompleted, recordStripePaymentIntentCompleted } = await import(
    './backend/api/lib/recordSale.mjs',
  )
  const { reserveTicketNumbers } = await import('./backend/api/lib/ticketNumbers.mjs')
  const { createPendingTicketCheckout } = await import('./backend/api/lib/pendingCheckout.mjs')
  const e2eSecret = (process.env.E2E_SECRET || 'e2e-dev-only-secret').trim()
  app.post('/api/e2e/mock-stripe-completion', express.json(), async (req, res) => {
    if ((req.headers['x-e2e-secret'] || '').trim() !== e2eSecret) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const body = req.body || {}
    const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : ''
    const customerFullName =
      typeof body.customerFullName === 'string' ? body.customerFullName.trim() : 'E2E User'
    const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : 'single'
    const quantity = Number(body.quantity) > 0 ? Number(body.quantity) : 1
    const amountPence = Number(body.amountPence) >= 0 ? Number(body.amountPence) : 75
    const stripeSessionId =
      typeof body.stripeSessionId === 'string' && body.stripeSessionId.trim()
        ? body.stripeSessionId.trim()
        : `e2e_cs_${Date.now()}`
    if (!customerEmail.includes('@')) {
      return res.status(400).json({ error: 'customerEmail required' })
    }
    try {
      const r = await recordStripeCheckoutCompleted({
        stripeSessionId,
        customerEmail,
        customerFullName,
        bundleId,
        quantity,
        amountPence,
        currency: 'gbp',
        paymentIntentId: `pi_e2e_${stripeSessionId}`,
      })
      if (!r?.ticketId) {
        return res.status(400).json({ error: 'Could not record sale (check email and DB)' })
      }
      return res.status(200).json({ ok: true, ...r })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'e2e mock failed' })
    }
  })

  app.post('/api/e2e/mock-stripe-payment-intent', express.json(), async (req, res) => {
    if ((req.headers['x-e2e-secret'] || '').trim() !== e2eSecret) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const body = req.body || {}
    const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : ''
    const customerFullName =
      typeof body.customerFullName === 'string' ? body.customerFullName.trim() : 'E2E User'
    const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : 'single'
    const quantity = Number(body.quantity) > 0 ? Number(body.quantity) : 1
    const amountPence = Number(body.amountPence) >= 0 ? Number(body.amountPence) : 75
    const paymentIntentId =
      typeof body.paymentIntentId === 'string' && body.paymentIntentId.trim()
        ? body.paymentIntentId.trim()
        : `pi_e2e_${Date.now()}`
    if (!customerEmail.includes('@')) {
      return res.status(400).json({ error: 'customerEmail required' })
    }
    try {
      const ticketNumbers = await reserveTicketNumbers(quantity)
      await createPendingTicketCheckout({
        provider: 'stripe_pi',
        externalId: paymentIntentId,
        bundleId,
        quantity,
        ticketNumbers,
        customerEmail,
        customerFullName,
      })
      const r = await recordStripePaymentIntentCompleted({
        paymentIntentId,
        customerEmail,
        customerFullName,
        bundleId,
        quantity,
        amountPence,
        currency: 'gbp',
        reservedTicketNumbers: ticketNumbers,
      })
      if (!r?.ticketId) {
        return res.status(400).json({ error: 'Could not record payment intent sale' })
      }
      if (!r.ticketNumbers?.length || r.ticketNumbers.length !== quantity) {
        return res.status(500).json({
          error: 'Ticket numbers missing or wrong count',
          expected: quantity,
          got: r.ticketNumbers?.length ?? 0,
        })
      }
      return res.status(200).json({ ok: true, ...r })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'e2e mock PI failed' })
    }
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use — local API did not start.\n` +
        `  lsof -ti :${PORT} | xargs kill -9\n` +
        `  Then run: npm run dev:all\n` +
        `Without the API on :${PORT}, /admin/login may hit an old process and email will fail.\n`,
    )
    process.exit(1)
  }
  throw err
})
