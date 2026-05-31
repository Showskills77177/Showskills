/**
 * Local API server for `npm run dev:api` (port 3000).
 * Vite proxies `/api` here. Production uses one Vercel handler (see `lib/vercelApiDispatch.mjs`).
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
const cashflowsWebhookHandler = (await import('./backend/api/cashflows-webhook.js')).default
app.post(
  '/api/cashflows-webhook',
  express.json({ limit: '1mb' }),
  adapt(cashflowsWebhookHandler),
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
const competitionImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
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

const competitionUploadHandler = (await import('./backend/api/admin/competition-upload.mjs')).default
app.post(
  '/api/admin/competition-upload',
  competitionImageUpload.single('image'),
  adapt(competitionUploadHandler),
)

/** Same handlers as Vercel production (`lib/vercelApiDispatch.mjs`) — avoids missing local routes. */
const { routes } = await import('./lib/vercelApiDispatch.mjs')
const SKIP_ROUTE_MOUNT = new Set([
  '/api/cashflows-webhook',
  '/api/submissions/kickups/upload',
  '/api/admin/competition-upload',
])

for (const [routePath, handler] of Object.entries(routes)) {
  if (SKIP_ROUTE_MOUNT.has(routePath)) continue
  app.all(routePath, adapt(handler))
}

const mountedPaths = Object.keys(routes)
  .filter((p) => !SKIP_ROUTE_MOUNT.has(p))
  .sort()
for (const required of [
  '/api/payment-config',
  '/api/create-cashflows-payment-intent',
  '/api/admin/verify-sms',
  '/api/admin/resend-code',
  '/api/admin/resend-winner-email',
  '/api/admin/competition-periods',
]) {
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
  const { recordCashflowsPaymentCompleted } = await import('./backend/api/lib/recordSale.mjs')
  const { reserveTicketNumbers } = await import('./backend/api/lib/ticketNumbers.mjs')
  const { createPendingTicketCheckout } = await import('./backend/api/lib/pendingCheckout.mjs')
  const { getTicketBundleById } = await import('./shared/ticketBundles.mjs')
  const e2eSecret = (process.env.E2E_SECRET || 'e2e-dev-only-secret').trim()
  app.post('/api/e2e/mock-paid-completion', express.json(), async (req, res) => {
    if ((req.headers['x-e2e-secret'] || '').trim() !== e2eSecret) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const body = req.body || {}
    const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : ''
    const customerFullName =
      typeof body.customerFullName === 'string' ? body.customerFullName.trim() : 'E2E User'
    const bundleId = typeof body.bundleId === 'string' ? body.bundleId.trim() : 'single'
    const bundle = getTicketBundleById(bundleId)
    const quantity = bundle?.qty ?? (Number(body.quantity) > 0 ? Number(body.quantity) : 1)
    const amountPence = bundle?.totalPence ?? (Number(body.amountPence) >= 0 ? Number(body.amountPence) : 75)
    const paymentJobReference =
      typeof body.paymentJobReference === 'string' && body.paymentJobReference.trim()
        ? body.paymentJobReference.trim()
        : `e2e_cf_${Date.now()}`
    if (!customerEmail.includes('@')) {
      return res.status(400).json({ error: 'customerEmail required' })
    }
    try {
      const ticketNumbers = await reserveTicketNumbers(quantity)
      await createPendingTicketCheckout({
        provider: 'cashflows',
        externalId: paymentJobReference,
        bundleId: bundle?.id ?? bundleId,
        quantity,
        ticketNumbers,
        customerEmail,
        customerFullName,
        cashflowsIntentToken: `e2e_token_${paymentJobReference}`,
      })
      const r = await recordCashflowsPaymentCompleted({
        paymentJobReference,
        customerEmail,
        customerFullName,
        bundleId: bundle?.id ?? bundleId,
        quantity,
        amountPence,
        currency: 'gbp',
        reservedTicketNumbers: ticketNumbers,
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
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

const { ensureLocalDevEntryPeriod } = await import('./backend/api/lib/competitionPeriods.mjs')
const devPeriod = await ensureLocalDevEntryPeriod()
if (devPeriod) {
  console.log(`[competition] Local dev entry period open: ${devPeriod.id}`)
}

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
