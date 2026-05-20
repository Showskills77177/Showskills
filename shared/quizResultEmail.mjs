import { escapeHtml, emailLogoUrl, buildTicketGridHtml } from './purchaseConfirmationEmail.mjs'
import { getTicketBundleById, formatBundlePriceGBP } from './ticketBundles.mjs'

const LABEL_STYLE = 'color:#fafaf9;font-size:12px;font-weight:600'
const VALUE_STYLE = 'color:#ecfdf5;font-size:13px'
const VALUE_MONO_STYLE = 'font-family:ui-monospace,Menlo,monospace;color:#ecfdf5;font-size:12px'

/**
 * @param {{
 *   customerFullName: string
 *   allCorrect: boolean
 *   siteUrl: string
 *   orderRef?: string
 *   bundleTitle?: string
 *   quantity?: number
 *   amountPence?: number
 *   ticketNumbers?: string[]
 * }} props
 */
export function buildQuizResultHtml(props) {
  const { customerFullName, allCorrect, siteUrl, orderRef, bundleTitle, quantity, ticketNumbers = [] } =
    props
  const logoSrc = emailLogoUrl(siteUrl)
  const ticketsHtml = ticketNumbers.length ? buildTicketGridHtml(ticketNumbers) : ''
  const ticketLabel = ticketNumbers.length === 1 ? 'Your ticket number' : 'Your ticket numbers'

  if (allCorrect) {
    const orderBlock = orderRef
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
        <tr><td style="padding:14px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:5px 0;${LABEL_STYLE}">Order</td><td align="right" style="padding:5px 0;${VALUE_MONO_STYLE}">${escapeHtml(orderRef)}</td></tr>
            ${bundleTitle ? `<tr><td style="padding:5px 0;${LABEL_STYLE}">Bundle</td><td align="right" style="padding:5px 0;${VALUE_STYLE}">${escapeHtml(bundleTitle)}${quantity ? ` · ${quantity} ticket${quantity === 1 ? '' : 's'}` : ''}</td></tr>` : ''}
          </table>
        </td></tr>
      </table>`
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
          <div style="font-size:22px;font-weight:700;color:#ecfdf5">You qualify for the draw</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">Ronaldo Legacy Bundle</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(52,211,153,0.45);border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#d6d3d1">We checked your three skill answers: <strong style="color:#6ee7b7">all correct</strong>. You are entered in the random winner selection for the Ronaldo Legacy Bundle draw.</p>
          ${orderBlock}
          ${ticketsHtml ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#34d399">${escapeHtml(ticketLabel)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ticketsHtml}</table><p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#a8a29e">Keep this email — your ticket numbers are only valid for this draw while you remain qualified.</p>` : ''}
        </td></tr>
        <tr><td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
          ShowSkills Rewards — skill-based promotion (UK).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 0 20px;text-align:center">
          <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
          <div style="font-size:22px;font-weight:700;color:#f5f5f4">Not qualified for the draw</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">Ronaldo Legacy Bundle</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#1c1412 0%,#0a1f19 100%);border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#d6d3d1">We checked your three skill answers: <strong style="color:#fbbf24">one or more were incorrect</strong>.</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#d6d3d1">You <strong style="color:#fbbf24">do not qualify</strong> for the prize draw on this entry. Paying for tickets does not enter the draw unless all skill answers are correct.</p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#d6d3d1">Your payment is not refunded. You will not receive draw ticket numbers by email for this entry.</p>
        </td></tr>
        <tr><td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
          ShowSkills Rewards — skill-based promotion (UK).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function buildQuizResultText(props) {
  const { customerFullName, allCorrect, siteUrl, orderRef, bundleTitle, quantity, ticketNumbers = [] } =
    props
  if (allCorrect) {
    const lines = [
      `Hi ${customerFullName || 'there'},`,
      '',
      'Ronaldo Legacy Bundle — skill question result',
      '',
      'All three of your answers were correct.',
      'You qualify for the random winner selection.',
    ]
    if (orderRef) lines.push('', `Order: ${orderRef}`)
    if (bundleTitle) lines.push(`Bundle: ${bundleTitle}${quantity ? ` (${quantity} tickets)` : ''}`)
    if (ticketNumbers.length) {
      lines.push('', 'Your ticket numbers:', ...ticketNumbers.map((n) => `  • ${n}`))
    }
    lines.push('', siteUrl)
    return lines.join('\n')
  }
  return [
    `Hi ${customerFullName || 'there'},`,
    '',
    'Ronaldo Legacy Bundle — skill question result',
    '',
    'One or more of your answers were incorrect.',
    'You do NOT qualify for the prize draw on this entry.',
    'Paying for tickets does not enter the draw unless all skill answers are correct.',
    'Your payment is not refunded. No draw ticket numbers are sent for this entry.',
    '',
    siteUrl,
  ].join('\n')
}

export function quizResultSubject(allCorrect) {
  return allCorrect
    ? 'ShowSkills — you qualify for the Ronaldo Legacy Bundle draw'
    : 'ShowSkills — you did not qualify (answers not correct)'
}
