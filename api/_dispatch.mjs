import adminLogin from '../backend/api/admin/login.js'
import adminVerifySms from '../backend/api/admin/verify-sms.js'
import adminLogout from '../backend/api/admin/logout.js'
import adminMe from '../backend/api/admin/me.js'
import adminStats from '../backend/api/admin/stats.js'
import adminUsers from '../backend/api/admin/users.js'
import adminEntries from '../backend/api/admin/entries.js'
import adminTickets from '../backend/api/admin/tickets.js'
import adminPayments from '../backend/api/admin/payments.js'
import adminSubmissions from '../backend/api/admin/submissions.js'
import adminKickupFile from '../backend/api/admin/kickup-file.js'

import paidQuiz from '../backend/api/entries/paid-quiz.js'
import kickups from '../backend/api/submissions/kickups.js'
import kickupsUpload from '../backend/api/submissions/kickups-upload.mjs'

import recordStripeSession from '../backend/api/records/stripe-session.js'
import createCheckoutSession from '../backend/api/create-checkout-session.js'
import createPaymentIntent from '../backend/api/create-payment-intent.js'
import recordStripePayment from '../backend/api/record-stripe-payment.js'
import createPayPalOrder from '../backend/api/create-paypal-order.js'
import capturePayPalOrder from '../backend/api/capture-paypal-order.js'
import stripeWebhook from '../backend/api/stripe-webhook.js'

export const routes = {
  '/api/admin/login': adminLogin,
  '/api/admin/verify-sms': adminVerifySms,
  '/api/admin/logout': adminLogout,
  '/api/admin/me': adminMe,
  '/api/admin/stats': adminStats,
  '/api/admin/users': adminUsers,
  '/api/admin/entries': adminEntries,
  '/api/admin/tickets': adminTickets,
  '/api/admin/payments': adminPayments,
  '/api/admin/submissions': adminSubmissions,
  '/api/admin/kickup-file': adminKickupFile,

  '/api/entries/paid-quiz': paidQuiz,
  '/api/submissions/kickups': kickups,
  '/api/submissions/kickups/upload': kickupsUpload,

  '/api/records/stripe-session': recordStripeSession,
  '/api/create-checkout-session': createCheckoutSession,
  '/api/create-payment-intent': createPaymentIntent,
  '/api/record-stripe-payment': recordStripePayment,
  '/api/create-paypal-order': createPayPalOrder,
  '/api/capture-paypal-order': capturePayPalOrder,
  '/api/stripe-webhook': stripeWebhook,
}

export function pathFromSlugParam(prefix, slug) {
  const parts = Array.isArray(slug) ? slug : slug ? [String(slug)] : []
  const tail = parts.map((s) => String(s).trim()).filter(Boolean).join('/')
  return tail ? `${prefix}/${tail}` : prefix
}

/** Vercel sometimes omits `slug` in query; fall back to the request pathname. */
export function pathFromRequest(req, prefix) {
  const fromSlug = pathFromSlugParam(prefix, req.query?.slug)
  if (fromSlug !== prefix) return fromSlug
  try {
    const raw = typeof req.url === 'string' ? req.url : '/'
    const { pathname } = new URL(raw, 'http://localhost')
    const normalized = pathname.replace(/\/+$/, '') || pathname
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return normalized
  } catch {
    /* ignore */
  }
  return fromSlug
}

export async function dispatch(req, res, path) {
  const fn = routes[path]
  if (!fn) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found', path }))
    return
  }
  return await fn(req, res)
}
