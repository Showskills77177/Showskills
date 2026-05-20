import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'
import {
  buildPurchaseConfirmationHtml,
  buildPurchaseConfirmationText,
  purchaseConfirmationSubject,
} from '../../../shared/purchaseConfirmationEmail.mjs'

function purchaseFromEmail() {
  return (process.env.PURCHASE_EMAIL_FROM || process.env.RESEND_FROM || 'ShowSkills Rewards <orders@showskills.co.uk>').trim()
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://showskills.co.uk').replace(/\/$/, '')
}

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
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
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
  const emailProps = {
    customerFullName,
    bundleTitle,
    quantity: qty,
    amountPence: amountPence ?? bundle?.totalPence ?? 0,
    ticketNumbers,
    purchaseRef,
    siteUrl: siteUrl(),
  }

  const payload = {
    from: purchaseFromEmail(),
    to: [email],
    subject: purchaseConfirmationSubject(purchaseRef),
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
    const msg = data?.message || data?.error || res.statusText
    console.error('[email] Resend failed:', msg)
    return { ok: false, error: String(msg) }
  }
  return { ok: true, id: data.id }
}
