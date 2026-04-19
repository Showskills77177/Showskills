/**
 * Local API server for `npm run dev:api` (port 3000).
 * Vite proxies `/api` here. Production uses a single Vercel function: `api/[[...slug]].js`.
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
app.use(express.json({ limit: '2mb' }))

/** Simple health check (optional). */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

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

async function mountApiRoutes() {
  const modules = [
    { path: '/api/admin/login', file: './backend/api/admin/login.js' },
    { path: '/api/admin/logout', file: './backend/api/admin/logout.js' },
    { path: '/api/admin/me', file: './backend/api/admin/me.js' },
    { path: '/api/admin/stats', file: './backend/api/admin/stats.js' },
    { path: '/api/admin/users', file: './backend/api/admin/users.js' },
    { path: '/api/admin/entries', file: './backend/api/admin/entries.js' },
    { path: '/api/admin/tickets', file: './backend/api/admin/tickets.js' },
    { path: '/api/admin/payments', file: './backend/api/admin/payments.js' },
    { path: '/api/admin/submissions', file: './backend/api/admin/submissions.js' },
    { path: '/api/admin/kickup-file', file: './backend/api/admin/kickup-file.js' },
    { path: '/api/entries/paid-quiz', file: './backend/api/entries/paid-quiz.js' },
    { path: '/api/submissions/kickups', file: './backend/api/submissions/kickups.js' },
    { path: '/api/records/stripe-session', file: './backend/api/records/stripe-session.js' },
    { path: '/api/create-checkout-session', file: './backend/api/create-checkout-session.js' },
    { path: '/api/create-paypal-order', file: './backend/api/create-paypal-order.js' },
    { path: '/api/capture-paypal-order', file: './backend/api/capture-paypal-order.js' },
  ]

  for (const { path: routePath, file } of modules) {
    const mod = await import(file)
    const handler = mod.default
    app.all(routePath, adapt(handler))
  }
}

await mountApiRoutes()

if (process.env.E2E_MODE === '1' || process.env.E2E_MODE === 'true') {
  const { recordStripeCheckoutCompleted } = await import('./backend/api/lib/recordSale.mjs')
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
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
