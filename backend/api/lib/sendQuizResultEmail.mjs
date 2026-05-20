import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import {
  buildQuizResultHtml,
  buildQuizResultText,
  quizResultSubject,
} from '../../../shared/quizResultEmail.mjs'

function purchaseFromEmail() {
  return (process.env.PURCHASE_EMAIL_FROM || process.env.RESEND_FROM || 'ShowSkills Rewards <orders@showskills.co.uk>').trim()
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://showskills.co.uk').replace(/\/$/, '')
}

/** Sent after paid entrants submit skill answers — qualified or not. Ticket numbers only when qualified. */
export async function sendQuizResultEmail({
  to,
  customerFullName,
  allCorrect,
  orderRef,
  bundleId,
  quantity,
  amountPence,
  ticketNumbers,
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping quiz result email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const email = to?.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const bundle = bundleId ? getTicketBundleById(bundleId) : null
  const nums = allCorrect && Array.isArray(ticketNumbers) ? ticketNumbers : []

  const props = {
    customerFullName,
    allCorrect: Boolean(allCorrect),
    siteUrl: siteUrl(),
    orderRef: allCorrect ? orderRef : undefined,
    bundleTitle: allCorrect ? bundle?.title ?? bundleId : undefined,
    quantity: allCorrect ? quantity ?? bundle?.qty : undefined,
    amountPence: allCorrect ? amountPence ?? bundle?.totalPence : undefined,
    ticketNumbers: nums,
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: purchaseFromEmail(),
      to: [email],
      subject: quizResultSubject(props.allCorrect),
      html: buildQuizResultHtml(props),
      text: buildQuizResultText(props),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText
    console.error('[email] Quiz result Resend failed:', msg)
    return { ok: false, error: String(msg) }
  }
  return { ok: true, id: data.id }
}
