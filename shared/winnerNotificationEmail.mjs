import { escapeHtml, emailLogoUrl } from './purchaseConfirmationEmail.mjs'
import { DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'
import { EMAIL_ICONS, emailIconImg } from './emailIcons.mjs'

/**
 * @param {{
 *   customerFullName: string
 *   winningTicketNumber: string
 *   periodTitle: string
 *   siteUrl: string
 *   orderRef?: string
 *   customerPhone?: string
 *   drawnAt?: string
 *   sandboxNote?: string
 * }} props
 */
export function winnerEmailSubject(periodTitle) {
  const label = periodTitle || DRAW_COMPETITION_LABEL
  return `You have won — ${label} | ShowSkills Rewards`
}

export function buildWinnerEmailHtml(props) {
  const {
    customerFullName,
    customerPhone,
    winningTicketNumber,
    periodTitle,
    siteUrl,
    orderRef,
    drawnAt,
    sandboxNote,
  } = props
  const sandboxBanner = sandboxNote
    ? `<p style="margin:0 0 12px;padding:10px 12px;font-size:12px;line-height:1.45;color:#fde68a;background:rgba(120,53,15,0.35);border-radius:8px;border:1px solid rgba(251,191,36,0.4)">${escapeHtml(sandboxNote)}</p>`
    : ''
  const phoneLine = customerPhone
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr>
        <td style="padding-right:10px;vertical-align:top">${emailIconImg(EMAIL_ICONS.phone, 'Phone', 28)}</td>
        <td style="font-size:13px;line-height:1.5;color:#e7e5e4;vertical-align:middle">
          We will also reach you on <strong style="color:#fef3c7">${escapeHtml(customerPhone)}</strong>.
        </td></tr></table>`
    : ''
  const logoSrc = emailLogoUrl(siteUrl)
  const name = escapeHtml(customerFullName || 'Winner')
  const period = escapeHtml(periodTitle || DRAW_COMPETITION_LABEL)
  const ticket = escapeHtml(winningTicketNumber)
  const ref = orderRef ? escapeHtml(orderRef) : ''
  const drawn =
    drawnAt &&
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/London',
    }).format(new Date(drawnAt))

  const iconRow = [
    emailIconImg(EMAIL_ICONS.fireworks, 'Celebration', 36),
    emailIconImg(EMAIL_ICONS.sparkles, 'Sparkles', 32),
    emailIconImg(EMAIL_ICONS.crown, 'Winner', 40),
    emailIconImg(EMAIL_ICONS.sparkles, 'Sparkles', 32),
    emailIconImg(EMAIL_ICONS.fireworks, 'Celebration', 36),
  ].join('<span style="display:inline-block;width:8px"></span>')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0908;font-family:Georgia,'Times New Roman',Times,serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#1f1608 0%,#0c0a09 50%,#050504 100%);padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
        <tr><td style="padding:0 0 16px;text-align:center;line-height:1">${iconRow}</td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:22px;overflow:hidden;border:1px solid rgba(212,175,55,0.5);box-shadow:0 12px 48px rgba(0,0,0,0.6),0 0 80px rgba(212,175,55,0.15)">
            <tr><td style="padding:0;background:linear-gradient(135deg,#4a3a12 0%,#292524 40%,#141210 100%);text-align:center;border-bottom:1px solid rgba(212,175,55,0.4)">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:20px 24px 10px">
                  <p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#fbbf24">Official winner notification</p>
                </td></tr>
                <tr><td style="padding:6px 24px 8px">
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
                    <td style="padding-right:12px;vertical-align:middle">${emailIconImg(EMAIL_ICONS.trophy, 'Trophy', 52)}</td>
                    <td style="vertical-align:middle;text-align:left">
                      <p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:26px;line-height:1.2;font-weight:800;color:#fffbeb">You&apos;re the winner</p>
                      <p style="margin:6px 0 0;font-family:system-ui,sans-serif;font-size:13px;color:#fcd34d">Grand prize · ShowSkills Rewards</p>
                    </td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:8px 24px 22px">
                  <img src="${logoSrc}" alt="ShowSkills Rewards" width="148" style="max-width:148px;height:auto;opacity:0.96" />
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:24px 26px 28px;background:#141210;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
              ${sandboxBanner}
              <p style="margin:0 0 6px;font-size:14px;color:#a8a29e">Dear ${name},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#e7e5e4">
                Congratulations — you have been selected as the <strong style="color:#fef3c7">grand prize winner</strong> of
                <strong style="color:#fffbeb">${period}</strong>. This is a formal notification under our published terms and conditions.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-radius:16px;background:linear-gradient(145deg,rgba(212,175,55,0.25) 0%,rgba(5,46,22,0.35) 100%);border:1px solid rgba(212,175,55,0.55)">
                <tr><td style="padding:18px 20px;text-align:center">
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 8px"><tr>
                    <td style="padding-right:8px">${emailIconImg(EMAIL_ICONS.ticket, 'Ticket', 32)}</td>
                    <td style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#fbbf24;vertical-align:middle">Winning ticket</td>
                  </tr></table>
                  <p style="margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:0.08em;color:#fffbeb">${ticket}</p>
                  ${ref ? `<p style="margin:10px 0 0;font-size:11px;color:#a8a29e">Order ref: <span style="font-family:ui-monospace;color:#d6d3d1">${ref}</span></p>` : ''}
                  ${drawn ? `<p style="margin:6px 0 0;font-size:11px;color:#78716c">Draw: ${escapeHtml(drawn)} (UK)</p>` : ''}
                </td></tr>
              </table>
              ${phoneLine}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>
                <td style="padding-right:8px;vertical-align:middle">${emailIconImg(EMAIL_ICONS.star, 'Next steps', 24)}</td>
                <td style="font-size:14px;font-weight:600;color:#fafaf9;vertical-align:middle">What happens next</td>
              </tr></table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.65);font-size:13px;line-height:1.55;color:#d6d3d1">
                  Reply within <strong style="color:#fef3c7">14 days</strong> to confirm receipt, your legal name, and best contact number.
                </td></tr>
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.35);font-size:13px;line-height:1.55;color:#d6d3d1">
                  Provide proof of identity and eligibility as set out in our competition terms.
                </td></tr>
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.35);font-size:13px;line-height:1.55;color:#d6d3d1">
                  Our team will contact you to arrange your prize and any required documentation.
                </td></tr>
              </table>
              <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#78716c">
                If you did not enter, contact us immediately:
                <a href="mailto:contact@showskills.co.uk" style="color:#fbbf24;text-decoration:none">contact@showskills.co.uk</a>
              </p>
              <p style="margin:0;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#57534e;text-align:center">
                ShowSkills Rewards · Premium skill competitions<br/>
                <a href="${escapeHtml(siteUrl)}" style="color:#a8a29e;text-decoration:none">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 0 0;text-align:center;line-height:1">
          ${emailIconImg(EMAIL_ICONS.fireworks, '', 28)}<span style="display:inline-block;width:12px"></span>
          ${emailIconImg(EMAIL_ICONS.sparkles, '', 24)}<span style="display:inline-block;width:12px"></span>
          ${emailIconImg(EMAIL_ICONS.trophy, '', 32)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildWinnerEmailText(props) {
  const {
    customerFullName,
    customerPhone,
    winningTicketNumber,
    periodTitle,
    siteUrl,
    orderRef,
    drawnAt,
    sandboxNote,
  } = props
  const period = periodTitle || DRAW_COMPETITION_LABEL
  const lines = [
    'CONGRATULATIONS — YOU WON!',
    '',
    `Dear ${customerFullName || 'Winner'},`,
    '',
    `You have been selected as the grand prize winner of the ${period} skill competition.`,
    '',
  ]
  if (sandboxNote) lines.push(sandboxNote, '')
  lines.push(`Winning ticket number: ${winningTicketNumber}`)
  if (orderRef) lines.push(`Order reference: ${orderRef}`)
  if (customerPhone) lines.push(`Contact phone on file: ${customerPhone}`)
  if (drawnAt) lines.push(`Draw conducted: ${drawnAt}`)
  lines.push(
    '',
    'What happens next:',
    '1. Reply within 14 days to confirm receipt, your legal name, and contact number.',
    '2. Provide proof of identity and eligibility as required under our terms.',
    '3. We will arrange prize delivery with you directly.',
    '',
    'If you did not enter this competition, contact contact@showskills.co.uk immediately.',
    '',
    siteUrl,
  )
  return lines.join('\n')
}
