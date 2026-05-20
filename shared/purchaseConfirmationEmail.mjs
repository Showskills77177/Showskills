import { formatBundlePriceGBP } from './ticketBundles.mjs'

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emailLogoUrl(siteUrl) {
  const base = String(siteUrl || 'https://showskills.co.uk').replace(/\/$/, '')
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
    'SS-TKT-1A2B3C4D',
    'SS-TKT-5E6F7081',
    'SS-TKT-9A0B1C2D',
    'SS-TKT-DEADBEEF',
    'SS-TKT-FACEB00C',
    'SS-TKT-AA11BB22',
    'SS-TKT-CC33DD44',
    'SS-TKT-EE55FF66',
    'SS-TKT-11223344',
    'SS-TKT-55667788',
  ],
}

function ticketChipHtml(ticketNumber) {
  return `<span style="display:block;box-sizing:border-box;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;font-weight:600;line-height:1.3;letter-spacing:0.02em;color:#ecfdf5;background:#064e3b;border:1px solid rgba(52,211,153,0.45);border-radius:6px;padding:5px 6px;text-align:center;word-break:break-all">${escapeHtml(ticketNumber)}</span>`
}

function buildTicketGridHtml(ticketNumbers) {
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
  } = props
  const price = formatBundlePriceGBP(amountPence)
  const ticketLabel = ticketNumbers.length === 1 ? 'Ticket number' : 'Ticket numbers'
  const logoSrc = emailLogoUrl(siteUrl)
  const ticketsHtml = buildTicketGridHtml(ticketNumbers)

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
              <div style="margin-top:6px;font-size:14px;color:#a8a29e">Ronaldo Legacy Bundle draw</div>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(52,211,153,0.35);border-radius:16px;padding:28px 24px">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#d6d3d1">Thank you for your purchase. Your payment was successful and your ticket numbers are below.</p>
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
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#34d399">${escapeHtml(ticketLabel)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ticketsHtml}</table>
              <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#a8a29e">Keep this email — each number is unique and tied to your purchase.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#134e3a;border-radius:12px;border:1px solid #10b981">
                <tr>
                  <td style="padding:18px 20px">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#ecfdf5">Next step: qualify for the draw</p>
                    <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a7f3d0">Return to the site and submit <strong style="color:#ecfdf5">three skill answers</strong>. Only entrants with all answers correct are included in the random winner selection.</p>
                    <a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:linear-gradient(90deg,#0d9488,#059669);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:10px">Submit answers on showskills.co.uk</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
              ShowSkills Rewards — skill-based promotion (UK).<br />
              This email confirms payment only; qualification requires correct answers per the site terms.
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
  } = props
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
    'Next step: return to the site and submit your three skill answers to qualify for the draw.',
    '',
    siteUrl,
  ].join('\n')
}

export function purchaseConfirmationSubject(purchaseRef) {
  return `Your ShowSkills ticket confirmation — ${purchaseRef}`
}
