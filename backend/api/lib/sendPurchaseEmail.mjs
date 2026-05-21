import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import {
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubject,
  purchaseConfirmationSubjectQuizPending,
} from '../../../shared/purchaseConfirmationEmail.mjs'
import { resolveResendFrom, formatResendError, resolveSiteUrl, getResendApiKey } from './resendConfig.mjs'

/**
 * Send purchase confirmation via Resend. Returns { ok, skipped?, error? }.
 * Skips silently when RESEND_API_KEY is unset (dev).
 */
export async function sendPurchaseConfirmationEmail({
  to,
  customerFullName,
  bundleId,
  quantity,
  amountPence,
  ticketNumbers,
  purchaseRef,
  quizPending = false,
  completeQuizUrl = '',
}) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping purchase confirmation email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const email = to?.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const bundle = getTicketBundleById(bundleId)
  const bundleTitle = bundle?.title ?? bundleId ?? 'Ticket bundle'
  const qty = quantity || bundle?.qty || ticketNumbers.length || 1
  const siteUrl = resolveSiteUrl()
  const emailProps = {
    customerFullName,
    bundleTitle,
    quantity: qty,
    amountPence: amountPence ?? bundle?.totalPence ?? 0,
    ticketNumbers,
    purchaseRef,
    siteUrl,
    quizPending: Boolean(quizPending),
    completeQuizUrl: typeof completeQuizUrl === 'string' ? completeQuizUrl : '',
  }

  const payload = {
    from: resolveResendFrom(),
    to: [email],
    subject: quizPending
      ? purchaseConfirmationSubjectQuizPending(purchaseRef)
      : purchaseConfirmationSubject(purchaseRef),
    html: buildPurchaseConfirmationHtml(emailProps),
    text: buildPurchaseConfirmationText(emailProps),
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] Resend failed:', msg)
    return { ok: false, error: msg }
  }
  return { ok: true, id: data.id }
}
