/** All /api routes — Vercel: api/[[...slug]].js + prefix catch-alls (see docs/DEPLOY-VERCEL.md). */
import adminLogin from '../backend/api/admin/login.js'
import adminSetupStatus from '../backend/api/admin/setup-status.js'
import adminResendCode from '../backend/api/admin/resend-code.js'
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
import adminDrawWinner from '../backend/api/admin/draw-winner.js'
import adminCompetitionPeriods from '../backend/api/admin/competition-periods.js'
import adminCompetitions from '../backend/api/admin/competitions.js'
import adminCompetitionUpload from '../backend/api/admin/competition-upload.mjs'
import adminForgotPassword from '../backend/api/admin/forgot-password.js'
import adminResetPassword from '../backend/api/admin/reset-password.js'
import adminResendResetCode from '../backend/api/admin/resend-reset-code.js'
import adminResendWinnerEmail from '../backend/api/admin/resend-winner-email.js'
import adminHomepageLayout from '../backend/api/admin/homepage-layout.js'
import adminSitePages from '../backend/api/admin/site-pages.js'

import paidQuiz from '../backend/api/entries/paid-quiz.js'
import resumePaidQuiz from '../backend/api/entries/resume-paid-quiz.js'
import sendUnansweredQuizEmail from '../backend/api/entries/send-unanswered-quiz-email.js'
import vpnCheck from '../backend/api/vpn-check.js'
import kickups from '../backend/api/submissions/kickups.js'
import kickupsUpload from '../backend/api/submissions/kickups-upload.mjs'

import createPayPalOrder from '../backend/api/create-paypal-order.js'
import capturePayPalOrder from '../backend/api/capture-paypal-order.js'
import createCashflowsPaymentIntent from '../backend/api/create-cashflows-payment-intent.js'
import recordCashflowsPayment from '../backend/api/record-cashflows-payment.js'
import cashflowsWebhook from '../backend/api/cashflows-webhook.js'
import contact from '../backend/api/contact.js'
import paymentConfig from '../backend/api/payment-config.js'
import createCashflowsFreeVerification from '../backend/api/create-cashflows-free-verification.js'
import confirmCashflowsFreeVerification from '../backend/api/confirm-cashflows-free-verification.js'
import completeFreeEntry from '../backend/api/complete-free-entry.js'
import adminEntryAttempts from '../backend/api/admin/entry-attempts.js'
import analyticsPageView from '../backend/api/analytics/page-view.js'
import publicCompetitions from '../backend/api/competitions.js'
import publicGiveaways from '../backend/api/giveaways.js'
import publicHomepageLayout from '../backend/api/homepage-layout.js'
import publicSitePages from '../backend/api/site-pages.js'
import publicWinners from '../backend/api/public-winners.js'
import competitionImage from '../backend/api/competition-image.js'
import newsletterSubscribe from '../backend/api/newsletter/subscribe.js'
import newsletterUnsubscribe from '../backend/api/newsletter/unsubscribe.js'
import newsletterPreferences from '../backend/api/newsletter/preferences.js'
import adminNewsletterSubscribers from '../backend/api/admin/newsletter-subscribers.js'
import adminNewsletterCampaign from '../backend/api/admin/newsletter-campaign.js'

export const routes = {
  '/api/admin/login': adminLogin,
  '/api/admin/setup-status': adminSetupStatus,
  '/api/admin/resend-code': adminResendCode,
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
  '/api/admin/draw-winner': adminDrawWinner,
  '/api/admin/competition-periods': adminCompetitionPeriods,
  '/api/admin/competitions': adminCompetitions,
  '/api/admin/competition-upload': adminCompetitionUpload,
  '/api/admin/forgot-password': adminForgotPassword,
  '/api/admin/reset-password': adminResetPassword,
  '/api/admin/resend-reset-code': adminResendResetCode,
  '/api/admin/resend-winner-email': adminResendWinnerEmail,
  '/api/admin/homepage-layout': adminHomepageLayout,
  '/api/admin/site-pages': adminSitePages,
  '/api/admin/entry-attempts': adminEntryAttempts,

  '/api/analytics/page-view': analyticsPageView,
  '/api/competitions': publicCompetitions,
  '/api/giveaways': publicGiveaways,
  '/api/homepage-layout': publicHomepageLayout,
  '/api/site-pages': publicSitePages,
  '/api/public-winners': publicWinners,
  '/api/competition-image': competitionImage,

  '/api/entries/paid-quiz': paidQuiz,
  '/api/entries/resume-paid-quiz': resumePaidQuiz,
  '/api/entries/send-unanswered-quiz-email': sendUnansweredQuizEmail,
  '/api/vpn-check': vpnCheck,
  '/api/submissions/kickups': kickups,
  '/api/submissions/kickups/upload': kickupsUpload,

  '/api/create-paypal-order': createPayPalOrder,
  '/api/capture-paypal-order': capturePayPalOrder,
  '/api/create-cashflows-payment-intent': createCashflowsPaymentIntent,
  '/api/record-cashflows-payment': recordCashflowsPayment,
  '/api/cashflows-webhook': cashflowsWebhook,
  '/api/contact': contact,
  '/api/payment-config': paymentConfig,
  '/api/create-cashflows-free-verification': createCashflowsFreeVerification,
  '/api/confirm-cashflows-free-verification': confirmCashflowsFreeVerification,
  '/api/complete-free-entry': completeFreeEntry,

  '/api/newsletter/subscribe': newsletterSubscribe,
  '/api/newsletter/unsubscribe': newsletterUnsubscribe,
  '/api/newsletter/preferences': newsletterPreferences,
  '/api/admin/newsletter-subscribers': adminNewsletterSubscribers,
  '/api/admin/newsletter-campaign': adminNewsletterCampaign,
}

export function pathFromSlugParam(prefix, slug) {
  const parts = Array.isArray(slug) ? slug : slug ? [String(slug)] : []
  const tail = parts.map((s) => String(s).trim()).filter(Boolean).join('/')
  return tail ? `${prefix}/${tail}` : prefix
}

/** Vercel sometimes omits `slug` in query; fall back to the request pathname. */
export function pathFromRequest(req, prefix) {
  try {
    const raw = typeof req.url === 'string' ? req.url : '/'
    const { pathname } = new URL(raw, 'http://localhost')
    const normalized = pathname.replace(/\/+$/, '') || pathname
    // Prefer the real URL path so `?slug=` query params (competition id) are not treated as route segments.
    if (normalized.length > prefix.length && normalized.startsWith(`${prefix}/`)) {
      return normalized
    }
    if (normalized === prefix) {
      return pathFromSlugParam(prefix, req.query?.slug)
    }
  } catch {
    /* ignore */
  }
  return pathFromSlugParam(prefix, req.query?.slug)
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
