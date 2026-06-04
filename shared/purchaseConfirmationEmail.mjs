import { formatBundlePriceGBP } from './ticketBundles.mjs'
import { DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'
import { buildTrustpilotEmailHtmlBlock, buildTrustpilotEmailTextLines } from './trustpilotEmailInvite.mjs'
import {
  buildPrizeRevealEmailHtmlBlock,
  buildPrizeRevealEmailTextLines,
} from './prizeRevealEmailBlock.mjs'

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const EMAIL_PUBLIC_SITE_URL = 'https://showskills.co.uk'

/** True when a URL host is localhost or otherwise unreachable from email clients. */
export function isLocalOrPrivateSiteUrl(url) {
  try {
    const u = new URL(String(url || 'http://localhost'))
    const h = u.hostname.toLowerCase()
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h === '[::1]' ||
      h.endsWith('.local')
    )
  } catch {
    return true
  }
}

/** Public https origin for images and links inside outbound email (never localhost). */
export function resolvePublicSiteUrlForEmail(siteUrl) {
  const envOverride = (
    typeof process !== 'undefined' &&
    (process.env.EMAIL_PUBLIC_SITE_URL || process.env.EMAIL_ASSET_BASE_URL)
  )
    ? String(process.env.EMAIL_PUBLIC_SITE_URL || process.env.EMAIL_ASSET_BASE_URL).trim()
    : ''
  if (envOverride && !isLocalOrPrivateSiteUrl(envOverride)) {
    return envOverride.replace(/\/$/, '')
  }
  const candidate = String(siteUrl || '').replace(/\/$/, '')
  if (candidate && !isLocalOrPrivateSiteUrl(candidate)) return candidate
  return EMAIL_PUBLIC_SITE_URL
}

export function emailLogoUrl(siteUrl, { forBrowserPreview = false } = {}) {
  if (forBrowserPreview && isLocalOrPrivateSiteUrl(siteUrl)) {
    return `${String(siteUrl || 'http://localhost').replace(/\/$/, '')}/email/showskills-logo.png`
  }
  const base = resolvePublicSiteUrlForEmail(siteUrl)
  return `${base}/email/showskills-logo.png`
}

export const PURCHASE_EMAIL_SAMPLE = {
  customerFullName: 'Alex Morgan',
  bundleTitle: 'Medium bundle',
  quantity: 10,
  amountPence: 600,
  purchaseRef: 'ORD-A1B2C3D4',
  siteUrl: 'https://showskills.co.uk',
  ticketNumbers: [
    'SS-1A2B3C4D',
    'SS-5E6F7081',
    'SS-9A0B1C2D',
    'SS-DEADBEEF',
    'SS-FACEB00C',
    'SS-AA11BB22',
    'SS-CC33DD44',
    'SS-EE55FF66',
    'SS-11223344',
    'SS-55667788',
  ],
}

function ticketChipHtml(ticketNumber) {
  return `<span style="display:block;box-sizing:border-box;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;font-weight:600;line-height:1.3;letter-spacing:0.02em;color:#ecfdf5;background:#064e3b;border:1px solid rgba(52,211,153,0.45);border-radius:6px;padding:5px 6px;text-align:center;word-break:break-all">${escapeHtml(ticketNumber)}</span>`
}

export function buildTicketGridHtml(ticketNumbers) {
  const rows = []
  for (let i = 0; i < ticketNumbers.length; i += 2) {
    const left = ticketNumbers[i]
    const right = ticketNumbers[i + 1]
    rows.push(`<tr>
      <td width="50%" style="padding:3px 6px 3px 0;vertical-align:top">${ticketChipHtml(left)}</td>
      <td width="50%" style="padding:3px 0 3px 6px;vertical-align:top">${right ? ticketChipHtml(right) : '&nbsp;'}</td>
    </tr>`)
  }
  return rows.join('')
}

const LABEL_STYLE = 'color:#fafaf9;font-size:12px;font-weight:600'
const VALUE_STYLE = 'color:#ecfdf5;font-size:13px'
const VALUE_MONO_STYLE = 'font-family:ui-monospace,Menlo,monospace;color:#ecfdf5;font-size:12px'

/**
 * @param {{
 *   customerFullName: string
 *   bundleTitle: string
 *   quantity: number
 *   amountPence: number
 *   ticketNumbers: string[]
 *   purchaseRef: string
 *   siteUrl: string
 *   quizPending?: boolean
 *   completeQuizUrl?: string
 * }} props
 */
export function buildPurchaseConfirmationHtml(props) {
  const {
    customerFullName,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers,
    purchaseRef,
    siteUrl,
    quizPending = false,
    completeQuizUrl = '',
    prizeRevealUrl = '',
  } = props
  const price = formatBundlePriceGBP(amountPence)
  const logoSrc = emailLogoUrl(siteUrl, { forBrowserPreview: Boolean(props.forBrowserPreview) })
  const showTickets = ticketNumbers.length > 0
  const ticketLabel = ticketNumbers.length === 1 ? 'Ticket number' : 'Ticket numbers'
  const ticketsHtml = showTickets ? buildTicketGridHtml(ticketNumbers) : ''
  const ctaUrl = completeQuizUrl ? escapeHtml(completeQuizUrl) : ''
  const prizeRevealBlock = quizPending ? '' : buildPrizeRevealEmailHtmlBlock({ prizeRevealUrl })

  if (quizPending) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Answer your skill questions — ${escapeHtml(purchaseRef)}</title>
</head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr>
            <td style="padding:0 0 20px;text-align:center">
              <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" height="auto" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
              <div style="font-size:22px;font-weight:700;color:#fef3c7;line-height:1.25">Your questions are not answered</div>
              <div style="margin-top:6px;font-size:14px;color:#a8a29e">${DRAW_COMPETITION_LABEL}</div>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(251,191,36,0.5);border-radius:16px;padding:28px 24px">
              <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">Thank you for your purchase. Your payment was successful and your ticket numbers are below.</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#fde68a"><strong style="color:#fef3c7">You still need to answer your three skill questions</strong> to complete your entry. You only qualify for the draw if all three answers are correct.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
                <tr>
                  <td style="padding:14px 16px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:5px 0;${LABEL_STYLE}">Order</td><td align="right" style="padding:5px 0;${VALUE_MONO_STYLE}">${escapeHtml(purchaseRef)}</td></tr>
                      <tr><td style="padding:5px 0;${LABEL_STYLE}">Bundle</td><td align="right" style="padding:5px 0;${VALUE_STYLE}">${escapeHtml(bundleTitle)} · ${quantity} ticket${quantity === 1 ? '' : 's'}</td></tr>
                      <tr><td style="padding:5px 0;${LABEL_STYLE}">Paid</td><td align="right" style="padding:5px 0;font-weight:700;color:#6ee7b7;font-size:14px">${escapeHtml(price)}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${
                showTickets
                  ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#34d399">${escapeHtml(ticketLabel)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ticketsHtml}</table>
              <p style="margin:14px 0 20px;font-size:13px;line-height:1.5;color:#a8a29e">Keep this email — your ticket numbers are confirmed below.</p>`
                  : ''
              }
              ${
                ctaUrl
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
                <tr><td style="border-radius:12px;background:linear-gradient(90deg,#0d9488,#059669)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Answer your questions now</a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#78716c">Use this link on any phone or computer until you submit your answers:<br /><a href="${ctaUrl}" style="color:#6ee7b7;word-break:break-all">${ctaUrl}</a></p>`
                  : ''
              }
              ${buildTrustpilotEmailHtmlBlock()}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
              ShowSkills Rewards — skill-based promotion (UK).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ticket confirmation — ${escapeHtml(purchaseRef)}</title>
</head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr>
            <td style="padding:0 0 20px;text-align:center">
              <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" height="auto" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
              <div style="font-size:22px;font-weight:700;color:#f5f5f4;line-height:1.25">Purchase confirmed</div>
              <div style="margin-top:6px;font-size:14px;color:#a8a29e">${DRAW_COMPETITION_LABEL} draw</div>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(52,211,153,0.35);border-radius:16px;padding:28px 24px">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#d6d3d1">Thank you for your purchase. Your payment was successful.</p>
              ${
                showTickets
                  ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#d6d3d1">You qualify for the ${DRAW_COMPETITION_LABEL} draw. Your ticket numbers are below.</p>`
                  : `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#d6d3d1"><strong style="color:#ecfdf5">Important:</strong> paying for tickets does not enter you into the draw by itself. On the website, submit your three skill answers straight after payment. <strong style="color:#ecfdf5">You only qualify if all three answers are correct</strong> — we will email you the result. If you qualify, your ticket numbers will be in that email.</p>`
              }
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
                <tr>
                  <td style="padding:14px 16px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:5px 0;${LABEL_STYLE}">Order</td><td align="right" style="padding:5px 0;${VALUE_MONO_STYLE}">${escapeHtml(purchaseRef)}</td></tr>
                      <tr><td style="padding:5px 0;${LABEL_STYLE}">Bundle</td><td align="right" style="padding:5px 0;${VALUE_STYLE}">${escapeHtml(bundleTitle)} · ${quantity} ticket${quantity === 1 ? '' : 's'}</td></tr>
                      <tr><td style="padding:5px 0;${LABEL_STYLE}">Paid</td><td align="right" style="padding:5px 0;font-weight:700;color:#6ee7b7;font-size:14px">${escapeHtml(price)}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${
                showTickets
                  ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#34d399">${escapeHtml(ticketLabel)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ticketsHtml}</table>
              <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#a8a29e">Keep this email — each number is unique and linked to your qualified draw entry.</p>`
                  : ''
              }
              ${prizeRevealBlock}
              ${buildTrustpilotEmailHtmlBlock()}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
              ShowSkills Rewards — skill-based promotion (UK).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildPurchaseConfirmationText(props) {
  const {
    customerFullName,
    bundleTitle,
    quantity,
    amountPence,
    ticketNumbers,
    purchaseRef,
    siteUrl,
    quizPending = false,
    completeQuizUrl = '',
    prizeRevealUrl = '',
  } = props
  const price = formatBundlePriceGBP(amountPence)
  const prizeRevealLines = quizPending ? [] : buildPrizeRevealEmailTextLines({ prizeRevealUrl })

  if (quizPending) {
    return [
      `Hi ${customerFullName || 'there'},`,
      '',
      'Your payment was successful. Your ticket numbers are below.',
      '',
      'YOUR QUESTIONS ARE NOT ANSWERED — you still need to submit your three skill answers to complete your entry.',
      'You only qualify for the draw if all three answers are correct.',
      '',
      `Order reference: ${purchaseRef}`,
      `Bundle: ${bundleTitle} (${quantity} ticket${quantity === 1 ? '' : 's'})`,
      `Amount paid: ${price}`,
      '',
      ...(ticketNumbers.length ? ['Ticket numbers:', ...ticketNumbers.map((n) => `  • ${n}`), ''] : []),
      ...(completeQuizUrl
        ? ['Answer your questions here (any device):', completeQuizUrl, '']
        : []),
      ...buildTrustpilotEmailTextLines(),
      siteUrl,
    ].join('\n')
  }

  return [
    `Hi ${customerFullName || 'there'},`,
    '',
    `Thank you for your purchase for the ${DRAW_COMPETITION_LABEL} draw on ShowSkills Rewards.`,
    '',
    `Order reference: ${purchaseRef}`,
    `Bundle: ${bundleTitle} (${quantity} ticket${quantity === 1 ? '' : 's'})`,
    `Amount paid: ${price}`,
    '',
    ...(ticketNumbers.length
      ? [
          'You qualify for the draw. Your ticket numbers:',
          ...ticketNumbers.map((n) => `  • ${n}`),
          '',
          'Keep this email — each ticket number is linked to your qualified entry.',
        ]
      : [
          'Submit your three skill answers on the website straight after payment.',
          'You only qualify for the draw if all three answers are correct.',
          'We will email you whether your answers are correct or not.',
          'If you qualify, your ticket numbers will be in that email.',
        ]),
    ...prizeRevealLines,
    ...buildTrustpilotEmailTextLines(),
    '',
    siteUrl,
  ].join('\n')
}

export function purchaseConfirmationSubject(purchaseRef) {
  return `Your ShowSkills ticket confirmation — ${purchaseRef}`
}

export function purchaseConfirmationSubjectQuizPending(purchaseRef) {
  return `Your ShowSkills tickets — please answer your skill questions — ${purchaseRef}`
}
