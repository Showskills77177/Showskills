/**
 * Single Vercel Serverless Function (Hobby plan — max 12 functions per deployment).
 * All `/api/*` requests are handled here; handlers live in `backend/api/`.
 */
import adminLogin from '../backend/api/admin/login.js'
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
import createPayPalOrder from '../backend/api/create-paypal-order.js'
import capturePayPalOrder from '../backend/api/capture-paypal-order.js'

function getRoutedPath(req) {
  try {
    const raw = typeof req.url === 'string' ? req.url : '/'
    const { pathname } = new URL(raw, 'http://localhost')
    if (pathname.startsWith('/api/') && !pathname.includes('[') && pathname.length > '/api/'.length) {
      return pathname.replace(/\/+$/, '') || pathname
    }
  } catch {
    /* ignore */
  }
  const slug = req.query?.slug
  if (slug == null || slug === '') return '/api'
  if (Array.isArray(slug)) return `/api/${slug.join('/')}`
  if (typeof slug === 'string') return `/api/${slug}`
  return '/api'
}

const routes = {
  '/api/admin/login': adminLogin,
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
  '/api/create-paypal-order': createPayPalOrder,
  '/api/capture-paypal-order': capturePayPalOrder,
}

export default async function handler(req, res) {
  const path = getRoutedPath(req)
  const fn = routes[path]
  if (!fn) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found', path }))
    return
  }
  return await fn(req, res)
}
