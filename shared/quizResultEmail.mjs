import { escapeHtml, emailLogoUrl, buildTicketGridHtml } from './purchaseConfirmationEmail.mjs'
import { formatBundlePriceGBP } from './ticketBundles.mjs'
import { buildTrustpilotEmailHtmlBlock, buildTrustpilotEmailTextLines } from './trustpilotEmailInvite.mjs'
import {
  CONSOLATION_MIN_SPEND_PENCE,
  CONSOLATION_NOT_AWARDED_PAID_BELOW_THRESHOLD,
} from './consolationShirtGiveaway.mjs'
import { SHIRT_GIVEAWAY_SEASON_LABEL } from './shirtGiveaway.mjs'
import { DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'
import {
  buildPrizeRevealEmailHtmlBlock,
  buildPrizeRevealEmailTextLines,
} from './prizeRevealEmailBlock.mjs'

const LABEL_STYLE = 'color:#fafaf9;font-size:12px;font-weight:600'
const VALUE_STYLE = 'color:#ecfdf5;font-size:13px'
const VALUE_MONO_STYLE = 'font-family:ui-monospace,Menlo,monospace;color:#ecfdf5;font-size:12px'

export function emailShirtPrizeUrl(siteUrl) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
  return `${base}/email/ronaldo-shirt-giveaway-jersey.png`
}

function buildReceiptBlock({ orderRef, bundleTitle, quantity, amountPence }) {
  const price = amountPence != null ? formatBundlePriceGBP(amountPence) : ''
  if (!orderRef && !bundleTitle) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
    <tr><td style="padding:14px 16px">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a8a29e">Payment receipt</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${orderRef ? `<tr><td style="padding:5px 0;${LABEL_STYLE}">Order</td><td align="right" style="padding:5px 0;${VALUE_MONO_STYLE}">${escapeHtml(orderRef)}</td></tr>` : ''}
        ${bundleTitle ? `<tr><td style="padding:5px 0;${LABEL_STYLE}">Bundle</td><td align="right" style="padding:5px 0;${VALUE_STYLE}">${escapeHtml(bundleTitle)}${quantity ? ` · ${quantity} ticket${quantity === 1 ? '' : 's'}` : ''}</td></tr>` : ''}
        ${price ? `<tr><td style="padding:5px 0;${LABEL_STYLE}">Paid</td><td align="right" style="padding:5px 0;font-weight:700;color:#6ee7b7;font-size:14px">${escapeHtml(price)}</td></tr>` : ''}
      </table>
      <p style="margin:10px 0 0;font-size:11px;line-height:1.45;color:#78716c">You may also receive a payment receipt from your payment provider.</p>
    </td></tr>
  </table>`
}

function buildShirtEntryGridHtml(entryNumbers) {
  const rows = []
  for (let i = 0; i < entryNumbers.length; i += 2) {
    const left = entryNumbers[i]
    const right = entryNumbers[i + 1]
    const chip = (num) =>
      `<span style="display:block;box-sizing:border-box;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;font-weight:600;line-height:1.3;letter-spacing:0.02em;color:#fef9c3;background:#713f12;border:1px solid rgba(250,204,21,0.45);border-radius:6px;padding:5px 6px;text-align:center;word-break:break-all">${escapeHtml(num)}</span>`
    rows.push(`<tr>
      <td width="50%" style="padding:3px 6px 3px 0;vertical-align:top">${chip(left)}</td>
      <td width="50%" style="padding:3px 0 3px 6px;vertical-align:top">${right ? chip(right) : '&nbsp;'}</td>
    </tr>`)
  }
  return rows.join('')
}

function buildConsolationBlock({
  consolationShirtEntries,
  consolationShirtEntryNumbers = [],
  siteUrl,
}) {
  if (!consolationShirtEntries) return ''

  const shirtImg = emailShirtPrizeUrl(siteUrl)
  const entryLabel =
    consolationShirtEntryNumbers.length === 1
      ? 'Your shirt giveaway entry number'
      : 'Your shirt giveaway entry numbers'
  const numbersBlock = consolationShirtEntryNumbers.length
    ? `<p style="margin:14px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24">${escapeHtml(entryLabel)}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${buildShirtEntryGridHtml(consolationShirtEntryNumbers)}</table>
       <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#d6d3d1">Keep these entry numbers — they confirm you are in the separate <strong style="color:#fde68a">Free Ronaldo Shirt Giveaway</strong> draw.</p>`
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:rgba(113,63,18,0.28);border-radius:14px;border:1px solid rgba(250,204,21,0.28)">
    <tr><td style="padding:16px">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24">Consolation prize — Free Ronaldo Shirt Giveaway</p>
      <img src="${escapeHtml(shirtImg)}" alt="Signed Ronaldo Manchester United shirt, ${escapeHtml(SHIRT_GIVEAWAY_SEASON_LABEL)}" width="160" style="display:block;width:100%;max-width:160px;height:auto;margin:0 auto 14px;border-radius:12px;border:1px solid rgba(250,204,21,0.25)" />
      <p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#d6d3d1">You received <strong style="color:#fcd34d">${consolationShirtEntries} automatic ${consolationShirtEntries === 1 ? 'entry' : 'entries'}</strong> into the separate Free Ronaldo Shirt Giveaway. Prize: <strong style="color:#fde68a">signed Ronaldo United shirt (${escapeHtml(SHIRT_GIVEAWAY_SEASON_LABEL)})</strong> — not the full Signed Football Legend Bundle.</p>
      ${numbersBlock}
    </td></tr>
  </table>`
}

/**
 * Single post-entry email: receipt + ticket numbers + qualify / not qualified.
 * @param {{
 *   customerFullName: string
 *   allCorrect: boolean
 *   siteUrl: string
 *   orderRef?: string
 *   bundleTitle?: string
 *   quantity?: number
 *   amountPence?: number
 *   ticketNumbers?: string[]
 *   consolationShirtEntries?: number
 *   consolationShirtEntryNumbers?: string[]
 * }} props
 */
export function buildQuizResultHtml(props) {
  const {
    customerFullName,
    allCorrect,
    siteUrl,
    orderRef,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers = [],
    consolationShirtEntries = 0,
    consolationShirtEntryNumbers = [],
    prizeRevealUrl = '',
  } = props
  const logoSrc = emailLogoUrl(siteUrl, { forBrowserPreview: Boolean(props.forBrowserPreview) })
  const receiptBlock = buildReceiptBlock({ orderRef, bundleTitle, quantity, amountPence })
  const ticketsHtml = ticketNumbers.length ? buildTicketGridHtml(ticketNumbers) : ''
  const ticketLabel = ticketNumbers.length === 1 ? 'Your ticket number' : 'Your ticket numbers'

  const headline = allCorrect ? 'You qualify for the draw' : 'Answers not correct'
  const headlineColor = allCorrect ? '#ecfdf5' : '#fca5a5'
  const borderColor = allCorrect ? 'rgba(52,211,153,0.45)' : 'rgba(248,113,113,0.55)'

  const resultHtml = allCorrect
    ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#d6d3d1">Your three skill answers were <strong style="color:#6ee7b7">all correct</strong>. You are entered in the random winner selection for the ${DRAW_COMPETITION_LABEL} draw.</p>`
    : `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#d6d3d1">Your three skill answers were checked: <strong style="color:#f87171">one or more were incorrect</strong>. You <strong style="color:#f87171">do not qualify</strong> for the prize draw on this entry. Your payment is not refunded.</p>`

  const noConsolationHtml =
    !allCorrect &&
    consolationShirtEntries === 0 &&
    amountPence != null &&
    amountPence > 0 &&
    amountPence < CONSOLATION_MIN_SPEND_PENCE
      ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#d6d3d1">${escapeHtml(CONSOLATION_NOT_AWARDED_PAID_BELOW_THRESHOLD)}</p>`
      : ''

  const consolationHtml = buildConsolationBlock({
    consolationShirtEntries,
    consolationShirtEntryNumbers,
    siteUrl,
  })

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 0 20px;text-align:center">
          <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
          <div style="font-size:22px;font-weight:700;color:${headlineColor};line-height:1.25">${escapeHtml(headline)}</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">${DRAW_COMPETITION_LABEL}</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid ${borderColor};border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">Thank you for your entry. Here is your purchase summary, ticket numbers, and skill-question result.</p>
          ${receiptBlock}
          ${resultHtml}
          ${noConsolationHtml}
          ${consolationHtml}
          ${ticketsHtml ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#34d399">${escapeHtml(ticketLabel)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ticketsHtml}</table><p style="margin:14px 0 ${allCorrect && prizeRevealUrl ? '20px' : '0'};font-size:13px;line-height:1.5;color:#a8a29e">Keep this email for your records.${allCorrect ? '' : ' Ticket numbers are shown for your purchase; they do not enter the Signed Football Legend Bundle draw unless all answers are correct.'}</p>` : ''}
          ${allCorrect ? buildPrizeRevealEmailHtmlBlock({ prizeRevealUrl }) : ''}
          ${buildTrustpilotEmailHtmlBlock()}
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
  const {
    customerFullName,
    allCorrect,
    siteUrl,
    orderRef,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers = [],
    consolationShirtEntries = 0,
    consolationShirtEntryNumbers = [],
    prizeRevealUrl = '',
  } = props
  const price = amountPence != null ? formatBundlePriceGBP(amountPence) : ''
  const lines = [
    `Hi ${customerFullName || 'there'},`,
    '',
    `${DRAW_COMPETITION_LABEL} — entry confirmation`,
    '',
    '--- Payment receipt ---',
  ]
  if (orderRef) lines.push(`Order: ${orderRef}`)
  if (bundleTitle) lines.push(`Bundle: ${bundleTitle}${quantity ? ` (${quantity} tickets)` : ''}`)
  if (price) lines.push(`Paid: ${price}`)
  lines.push('(You may also receive a receipt from your payment provider.)', '')
  lines.push('--- Skill answers ---')
  if (allCorrect) {
    lines.push('All three answers correct — you qualify for the draw.')
  } else {
    lines.push('One or more answers incorrect — you do NOT qualify for the draw.')
    lines.push('Payment is not refunded.')
    if (consolationShirtEntries > 0) {
      lines.push(
        `Consolation prize: ${consolationShirtEntries} automatic ${consolationShirtEntries === 1 ? 'entry' : 'entries'} into the separate Free Ronaldo Shirt Giveaway (signed Ronaldo United shirt, ${SHIRT_GIVEAWAY_SEASON_LABEL}).`,
      )
      if (consolationShirtEntryNumbers.length) {
        lines.push('', '--- Shirt giveaway entry numbers ---', ...consolationShirtEntryNumbers.map((n) => `  • ${n}`))
      }
    } else if (amountPence != null && amountPence > 0 && amountPence < CONSOLATION_MIN_SPEND_PENCE) {
      lines.push(CONSOLATION_NOT_AWARDED_PAID_BELOW_THRESHOLD)
    }
  }
  if (ticketNumbers.length) {
    lines.push('', '--- Signed Football Legend Bundle ticket numbers ---', ...ticketNumbers.map((n) => `  • ${n}`))
  }
  if (allCorrect) {
    lines.push(...buildPrizeRevealEmailTextLines({ prizeRevealUrl }))
  }
  lines.push(...buildTrustpilotEmailTextLines(), '', siteUrl)
  return lines.join('\n')
}

export function quizResultSubject(orderRef, allCorrect) {
  const ref = orderRef ? ` — ${orderRef}` : ''
  return allCorrect
    ? `ShowSkills entry confirmed (qualified)${ref}`
    : `ShowSkills entry confirmed (not qualified)${ref}`
}
