import { getTicketBundleById, formatBundlePriceGBP } from '../../../shared/ticketBundles.mjs'

function purchaseFromEmail() {
  return (process.env.PURCHASE_EMAIL_FROM || process.env.RESEND_FROM || 'ShowSkills Rewards <orders@showskills.co.uk>').trim()
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://showskills.co.uk').replace(/\/$/, '')
}

function buildHtml({ customerFullName, bundleTitle, quantity, amountPence, ticketNumbers, purchaseRef }) {
  const list = ticketNumbers.map((n) => `<li style="font-family:monospace;margin:4px 0">${n}</li>`).join('')
  const price = formatBundlePriceGBP(amountPence)
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#1c1917;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
  <p>Hi ${escapeHtml(customerFullName || 'there')},</p>
  <p>Thank you for your purchase for the <strong>Ronaldo Legacy Bundle</strong> draw on ShowSkills Rewards.</p>
  <p><strong>Order reference:</strong> ${escapeHtml(purchaseRef)}<br>
  <strong>Bundle:</strong> ${escapeHtml(bundleTitle)} (${quantity} ticket${quantity === 1 ? '' : 's'})<br>
  <strong>Amount paid:</strong> ${escapeHtml(price)}</p>
  <p><strong>Your ticket number${ticketNumbers.length === 1 ? '' : 's'}:</strong></p>
  <ul>${list}</ul>
  <p>Keep this email — each ticket number is unique and linked to your purchase.</p>
  <p><strong>Next step:</strong> return to the site and submit your <strong>three skill answers</strong> to qualify for the draw. Only correct entries are included in the winner selection.</p>
  <p style="margin-top:24px"><a href="${escapeHtml(siteUrl())}" style="color:#0d9488">showskills.co.uk</a></p>
  <p style="font-size:12px;color:#78716c;margin-top:32px">ShowSkills Rewards — skill-based promotion. This email confirms payment only; qualification requires correct answers per the site terms.</p>
</body></html>`
}

function buildText({ customerFullName, bundleTitle, quantity, amountPence, ticketNumbers, purchaseRef }) {
  const price = formatBundlePriceGBP(amountPence)
  return [
    `Hi ${customerFullName || 'there'},`,
    '',
    'Thank you for your purchase for the Ronaldo Legacy Bundle draw on ShowSkills Rewards.',
    '',
    `Order reference: ${purchaseRef}`,
    `Bundle: ${bundleTitle} (${quantity} ticket${quantity === 1 ? '' : 's'})`,
    `Amount paid: ${price}`,
    '',
    `Your ticket number${ticketNumbers.length === 1 ? '' : 's'}:`,
    ...ticketNumbers.map((n) => `  • ${n}`),
    '',
    'Keep this email — each ticket number is unique.',
    '',
    'Next step: return to showskills.co.uk and submit your three skill answers to qualify for the draw.',
    '',
    siteUrl(),
  ].join('\n')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
  const payload = {
    from: purchaseFromEmail(),
    to: [email],
    subject: `Your ShowSkills ticket confirmation — ${purchaseRef}`,
    html: buildHtml({
      customerFullName,
      bundleTitle,
      quantity: qty,
      amountPence: amountPence ?? bundle?.totalPence ?? 0,
      ticketNumbers,
      purchaseRef,
    }),
    text: buildText({
      customerFullName,
      bundleTitle,
      quantity: qty,
      amountPence: amountPence ?? bundle?.totalPence ?? 0,
      ticketNumbers,
      purchaseRef,
    }),
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
