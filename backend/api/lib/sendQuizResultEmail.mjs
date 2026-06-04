import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import {
  buildQuizResultHtml,
  buildQuizResultText,
  quizResultSubject,
} from '../../../shared/quizResultEmail.mjs'
import { resolveResendFrom, formatResendError, resolveSiteUrl, getResendApiKey } from './resendConfig.mjs'

/** One email after quiz: receipt + ticket numbers + qualified or not. */
export async function sendQuizResultEmail({
  to,
  customerFullName,
  allCorrect,
  orderRef,
  bundleId,
  quantity,
  amountPence,
  ticketNumbers,
  consolationShirtEntries = 0,
  consolationShirtEntryNumbers = [],
  prizeRevealUrl = '',
}) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping entry confirmation email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const email = to?.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const bundle = bundleId ? getTicketBundleById(bundleId) : null
  const props = {
    customerFullName,
    allCorrect: Boolean(allCorrect),
    siteUrl: resolveSiteUrl(),
    orderRef,
    bundleTitle: bundle?.title ?? bundleId,
    quantity: quantity ?? bundle?.qty,
    amountPence: amountPence ?? bundle?.totalPence,
    ticketNumbers: Array.isArray(ticketNumbers) ? ticketNumbers : [],
    consolationShirtEntries: Number(consolationShirtEntries) || 0,
    consolationShirtEntryNumbers: Array.isArray(consolationShirtEntryNumbers)
      ? consolationShirtEntryNumbers.filter(Boolean)
      : [],
    prizeRevealUrl: typeof prizeRevealUrl === 'string' ? prizeRevealUrl : '',
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resolveResendFrom(),
      to: [email],
      subject: quizResultSubject(orderRef, props.allCorrect),
      html: buildQuizResultHtml(props),
      text: buildQuizResultText(props),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] Entry confirmation Resend failed:', msg)
    return { ok: false, error: msg }
  }
  return { ok: true, id: data.id }
}
