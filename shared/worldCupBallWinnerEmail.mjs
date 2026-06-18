import { escapeHtml, emailLogoUrl } from './purchaseConfirmationEmail.mjs'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_PRIZE_TITLE,
} from './worldCupBallGiveaway.mjs'
import {
  WORLD_CUP_BALL_FREE_SHIPPING_NOTICE,
} from './worldCupBallGiveawayRules.mjs'
import { WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY } from './worldCupBallPhotography.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { EMAIL_ICONS, emailIconImg } from './emailIcons.mjs'

export function worldCupBallWinnerEmailSubject(detailsComplete = true) {
  if (detailsComplete) {
    return `You have won — ${WORLD_CUP_BALL_GIVEAWAY_LABEL} | ShowSkills Rewards`
  }
  return `Action required — complete your World Cup Ball winner details | ShowSkills Rewards`
}

/**
 * @param {{
 *   customerFullName?: string
 *   customerEmail?: string
 *   customerPhone?: string
 *   winReference?: string
 *   siteUrl: string
 *   wonAt?: string
 *   sandboxNote?: string
 *   claimUrl?: string
 *   detailsComplete?: boolean
 * }} props
 */
export function buildWorldCupBallWinnerEmailHtml(props) {
  const {
    customerFullName,
    customerPhone,
    winReference,
    siteUrl,
    wonAt,
    sandboxNote,
    claimUrl,
    detailsComplete = true,
  } = props
  const sandboxBanner = sandboxNote
    ? `<p style="margin:0 0 12px;padding:10px 12px;font-size:12px;line-height:1.45;color:#fde68a;background:rgba(120,53,15,0.35);border-radius:8px;border:1px solid rgba(251,191,36,0.4)">${escapeHtml(sandboxNote)}</p>`
    : ''
  const phoneLine = customerPhone
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr>
        <td style="padding-right:10px;vertical-align:top">${emailIconImg(EMAIL_ICONS.phone, 'Phone', 28)}</td>
        <td style="font-size:13px;line-height:1.5;color:#e7e5e4;vertical-align:middle">
          Contact number on file: <strong style="color:#fef3c7">${escapeHtml(customerPhone)}</strong>.
        </td></tr></table>`
    : ''
  const logoSrc = emailLogoUrl(siteUrl)
  const name = escapeHtml(customerFullName || 'Winner')
  const prize = escapeHtml(WORLD_CUP_BALL_PRIZE_TITLE)
  const promotion = escapeHtml(WORLD_CUP_BALL_GIVEAWAY_LABEL)
  const ref = winReference ? escapeHtml(winReference) : ''
  const claimHref = claimUrl ? escapeHtml(claimUrl) : ''
  const won =
    wonAt &&
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/London',
    }).format(new Date(wonAt))

  const introComplete = `Congratulations — you have won the <strong style="color:#fef3c7">${prize}</strong> in the
                <strong style="color:#fffbeb">${promotion}</strong>. You answered every skill question correctly within the time limits.
                Your delivery details are saved and we will arrange <strong style="color:#fef3c7">free UK shipping</strong> of your football.`

  const introPending = `Congratulations — you have won the <strong style="color:#fef3c7">${prize}</strong> in the
                <strong style="color:#fffbeb">${promotion}</strong>. You answered every skill question correctly within the time limits.
                <strong style="color:#fef3c7">Please provide your delivery details</strong> using the secure link below so we can ship your football — UK delivery is <strong style="color:#fef3c7">free</strong> for the winner.`

  const claimButton = claimHref
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td align="center" style="border-radius:12px;background:linear-gradient(135deg,#d97706,#fbbf24)">
          <a href="${claimHref}" style="display:inline-block;padding:14px 28px;font-family:system-ui,sans-serif;font-size:15px;font-weight:800;color:#1c1917;text-decoration:none">
            ${detailsComplete ? 'View your winner delivery form' : 'Complete your delivery details'}
          </a>
        </td></tr></table>
        <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#78716c;word-break:break-all">
          Or copy this link: <a href="${claimHref}" style="color:#fbbf24">${claimHref}</a>
        </p>`
    : ''

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
                      <p style="margin:6px 0 0;font-family:system-ui,sans-serif;font-size:13px;color:#fcd34d">Skill challenge · ShowSkills Rewards</p>
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
                ${detailsComplete ? introComplete : introPending}
                This is a formal notification under our published terms and conditions.
              </p>
              ${ref ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-radius:16px;background:linear-gradient(145deg,rgba(212,175,55,0.25) 0%,rgba(5,46,22,0.35) 100%);border:1px solid rgba(212,175,55,0.55)">
                <tr><td style="padding:18px 20px;text-align:center">
                  <p style="margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:0.08em;color:#fffbeb">${ref}</p>
                  ${won ? `<p style="margin:10px 0 0;font-size:11px;color:#78716c">Won: ${escapeHtml(won)} (UK)</p>` : ''}
                </td></tr>
              </table>` : ''}
              ${claimButton}
              ${phoneLine}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>
                <td style="padding-right:8px;vertical-align:middle">${emailIconImg(EMAIL_ICONS.star, 'Next steps', 24)}</td>
                <td style="font-size:14px;font-weight:600;color:#fafaf9;vertical-align:middle">What happens next</td>
              </tr></table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.65);font-size:13px;line-height:1.55;color:#d6d3d1">
                  ${detailsComplete ? '<strong style="color:#fef3c7">Your delivery details are saved.</strong> We will ship your football to the UK address you provided.' : '<strong style="color:#fef3c7">Please complete the delivery form</strong> with your name, email, mobile number, and UK postal address (parent/guardian details if you are 16 or 17).'}
                </td></tr>
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.35);font-size:13px;line-height:1.55;color:#d6d3d1">
                  ${escapeHtml(WORLD_CUP_BALL_FREE_SHIPPING_NOTICE)}
                </td></tr>
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.35);font-size:13px;line-height:1.55;color:#d6d3d1">
                  ${escapeHtml(WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY)}
                </td></tr>
                <tr><td style="padding:9px 0 9px 14px;border-left:2px solid rgba(212,175,55,0.35);font-size:13px;line-height:1.55;color:#d6d3d1">
                  Questions or problems? Email <a href="mailto:${SHOWSKILLS_CONTACT_EMAIL}" style="color:#fbbf24;text-decoration:none">${SHOWSKILLS_CONTACT_EMAIL}</a>.
                </td></tr>
              </table>
              <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#78716c">
                If you did not enter, contact us immediately:
                <a href="mailto:${SHOWSKILLS_CONTACT_EMAIL}" style="color:#fbbf24;text-decoration:none">${SHOWSKILLS_CONTACT_EMAIL}</a>
              </p>
              <p style="margin:0;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#57534e;text-align:center">
                ShowSkills Rewards · Premium skill competitions<br/>
                <a href="${escapeHtml(siteUrl)}" style="color:#a8a29e;text-decoration:none">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildWorldCupBallWinnerEmailText(props) {
  const {
    customerFullName,
    customerPhone,
    winReference,
    siteUrl,
    wonAt,
    sandboxNote,
    claimUrl,
    detailsComplete = true,
  } = props
  const lines = [
    detailsComplete ? 'CONGRATULATIONS — YOU WON!' : 'ACTION REQUIRED — COMPLETE YOUR WINNER DETAILS',
    '',
    `Dear ${customerFullName || 'Winner'},`,
    '',
    `You have won the ${WORLD_CUP_BALL_PRIZE_TITLE} in the ${WORLD_CUP_BALL_GIVEAWAY_LABEL}.`,
    'You answered every skill question correctly within the time limits.',
    '',
  ]
  if (sandboxNote) lines.push(sandboxNote, '')
  if (winReference) lines.push(`Skill win reference: ${winReference}`)
  if (customerPhone) lines.push(`Contact phone on file: ${customerPhone}`)
  if (wonAt) lines.push(`Won: ${wonAt}`)
  if (claimUrl) {
    lines.push('', detailsComplete ? 'Your delivery form link:' : 'Complete your delivery details here:', claimUrl)
  }
  lines.push(
    '',
    detailsComplete
      ? 'Your delivery details are saved. We will arrange free UK shipping of your football.'
      : 'Please provide your name, email, mobile number, and UK postal address using the link above so we can ship your football.',
    WORLD_CUP_BALL_FREE_SHIPPING_NOTICE,
    '',
    WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY,
    '',
    `Questions: ${SHOWSKILLS_CONTACT_EMAIL}`,
    '',
    'If you did not enter this promotion, contact contact@showskills.co.uk immediately.',
    '',
    siteUrl,
  )
  return lines.join('\n')
}
