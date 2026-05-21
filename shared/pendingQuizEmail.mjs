import { escapeHtml, emailLogoUrl, buildTicketGridHtml } from './purchaseConfirmationEmail.mjs'
import { buildCompleteQuizUrl } from './quizLinks.mjs'
import { formatBundlePriceGBP } from './ticketBundles.mjs'

/**
 * Sent after payment when skill answers are still required.
 * @param {{
 *   customerFullName: string
 *   siteUrl: string
 *   completeQuizUrl: string
 *   orderRef?: string
 *   bundleTitle?: string
 *   quantity?: number
 *   amountPence?: number
 *   ticketNumbers?: string[]
 * }} props
 */
export function buildPendingQuizHtml(props) {
  const {
    customerFullName,
    siteUrl,
    completeQuizUrl,
    orderRef,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers = [],
  } = props
  const logoSrc = emailLogoUrl(siteUrl)
  const price = amountPence != null ? formatBundlePriceGBP(amountPence) : ''
  const ctaUrl = escapeHtml(completeQuizUrl)
  const ticketsHtml =
    ticketNumbers.length > 0
      ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#34d399">Your ticket number${ticketNumbers.length === 1 ? '' : 's'}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${buildTicketGridHtml(ticketNumbers)}</table><p style="margin:14px 0 16px;font-size:13px;line-height:1.5;color:#a8a29e">Keep this email — use the link below whenever you are ready to answer (same link on any phone or computer until you submit).</p>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 0 20px;text-align:center">
          <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
          <div style="font-size:22px;font-weight:700;color:#fef3c7;line-height:1.25">Answer your skill questions</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">Ronaldo Legacy Bundle</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(251,191,36,0.45);border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">Your payment was successful. <strong style="color:#fef3c7">You still need to submit your three skill answers</strong> on the website to complete your entry. You only qualify for the draw if all three answers are correct.</p>
          ${
            orderRef
              ? `<p style="margin:0 0 12px;font-size:13px;color:#a8a29e">Order: <span style="font-family:ui-monospace,Menlo,monospace;color:#ecfdf5">${escapeHtml(orderRef)}</span></p>`
              : ''
          }
          ${
            bundleTitle
              ? `<p style="margin:0 0 16px;font-size:13px;color:#a8a29e">${escapeHtml(bundleTitle)}${quantity ? ` · ${quantity} ticket${quantity === 1 ? '' : 's'}` : ''}${price ? ` · ${escapeHtml(price)}` : ''}</p>`
              : ''
          }
          ${ticketsHtml}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
            <tr><td style="border-radius:12px;background:linear-gradient(90deg,#0d9488,#059669)">
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Answer the questions now</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#78716c">If the button does not work, copy this link into your browser:<br /><a href="${ctaUrl}" style="color:#6ee7b7;word-break:break-all">${ctaUrl}</a></p>
        </td></tr>
        <tr><td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">ShowSkills Rewards — skill-based promotion (UK).</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function buildPendingQuizText(props) {
  const {
    customerFullName,
    completeQuizUrl,
    orderRef,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers = [],
  } = props
  const price = amountPence != null ? formatBundlePriceGBP(amountPence) : ''
  const lines = [
    `Hi ${customerFullName || 'there'},`,
    '',
    'Your payment was successful. You still need to submit your three skill answers on ShowSkills Rewards.',
    'You only qualify for the draw if all three answers are correct.',
    '',
  ]
  if (orderRef) lines.push(`Order: ${orderRef}`)
  if (bundleTitle) lines.push(`Bundle: ${bundleTitle}${quantity ? ` (${quantity} tickets)` : ''}`)
  if (price) lines.push(`Paid: ${price}`)
  if (ticketNumbers.length) {
    lines.push('', 'Your ticket numbers:', ...ticketNumbers.map((n) => `  • ${n}`))
  }
  lines.push(
    '',
    'Use this link on any device until you submit your answers (pass or fail):',
    completeQuizUrl,
    '',
  )
  return lines.join('\n')
}

export function pendingQuizSubject(orderRef) {
  const ref = orderRef ? ` — ${orderRef}` : ''
  return `ShowSkills: answer your skill questions${ref}`
}

export function pendingQuizEmailProps({
  customerFullName,
  siteUrl,
  orderRef,
  bundleTitle,
  quantity,
  amountPence,
  ticketNumbers,
  resumeToken,
}) {
  const completeQuizUrl = buildCompleteQuizUrl(siteUrl, resumeToken)
  return {
    customerFullName,
    siteUrl,
    completeQuizUrl,
    orderRef,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers: Array.isArray(ticketNumbers) ? ticketNumbers : [],
  }
}
