import { escapeHtml, emailLogoUrl } from './purchaseConfirmationEmail.mjs'
import { SHIRT_GIVEAWAY_SEASON_LABEL, SHIRT_GIVEAWAY_PRIZE_TITLE } from './shirtGiveaway.mjs'
import {
  buildShirtPrizeRevealEmailHtmlBlock,
  buildShirtPrizeRevealEmailTextLines,
} from './shirtPrizeRevealEmailBlock.mjs'
import { buildTrustpilotEmailHtmlBlock, buildTrustpilotEmailTextLines } from './trustpilotEmailInvite.mjs'

export function shirtGiveawayConfirmationSubject(entryNumber) {
  const ref = entryNumber ? ` — ${entryNumber}` : ''
  return `ShowSkills shirt giveaway entry confirmed${ref}`
}

/**
 * @param {{
 *   customerFullName: string
 *   entryNumber: string
 *   siteUrl: string
 *   shirtPrizeRevealUrl?: string
 *   forBrowserPreview?: boolean
 * }} props
 */
export function buildShirtGiveawayConfirmationHtml(props) {
  const {
    customerFullName,
    entryNumber,
    siteUrl,
    shirtPrizeRevealUrl = '',
    forBrowserPreview = false,
  } = props
  const logoSrc = emailLogoUrl(siteUrl, { forBrowserPreview })
  const entry = escapeHtml(entryNumber || '')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 0 20px;text-align:center">
          <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 12px;max-width:156px;height:auto;border:0" />
          <div style="font-size:22px;font-weight:700;color:#ecfccb;line-height:1.25">Entry confirmed</div>
          <div style="margin-top:6px;font-size:14px;color:#a8a29e">Free Ronaldo Shirt Giveaway</div>
        </td></tr>
        <tr><td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(132,204,22,0.4);border-radius:16px;padding:28px 24px">
          <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Hi ${escapeHtml(customerFullName || 'there')},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d6d3d1">Thank you for entering the free <strong style="color:#ecfccb">${escapeHtml(SHIRT_GIVEAWAY_PRIZE_TITLE)}</strong> draw. Your entry is recorded.</p>
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#84cc16">Your entry number</p>
          <p style="margin:0 0 20px;font-family:ui-monospace,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:0.06em;color:#ecfccb">${entry}</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#d6d3d1">Keep this email. We verify newsletter signup and social follow before the draw. Prize imagery on the website uses blurred sponsor and signature marks — your confirmation email includes a one-time timed preview link.</p>
          ${buildShirtPrizeRevealEmailHtmlBlock({ shirtPrizeRevealUrl })}
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

export function buildShirtGiveawayConfirmationText(props) {
  const { customerFullName, entryNumber, siteUrl, shirtPrizeRevealUrl = '' } = props
  const lines = [
    `Hi ${customerFullName || 'there'},`,
    '',
    'Free Ronaldo Shirt Giveaway — entry confirmed',
    '',
    `Entry number: ${entryNumber}`,
    '',
    `Prize: ${SHIRT_GIVEAWAY_PRIZE_TITLE}.`,
    'Keep this email for your records.',
    ...buildShirtPrizeRevealEmailTextLines({ shirtPrizeRevealUrl }),
    ...buildTrustpilotEmailTextLines(),
    '',
    siteUrl,
  ]
  return lines.join('\n')
}
