import { escapeHtml, emailLogoUrl } from './purchaseConfirmationEmail.mjs'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_PRIZE_TITLE,
} from './worldCupBallGiveaway.mjs'
import {
  WORLD_CUP_BALL_FREE_SHIPPING_NOTICE,
} from './worldCupBallGiveawayRules.mjs'
import { worldCupBallPhotographySummaryForFulfilment } from './worldCupBallPhotography.mjs'
import {
  resolveWorldCupBallPrizeFulfilment,
  worldCupBallPrizeHeadlineForCountry,
  WORLD_CUP_BALL_INTERNATIONAL_CASH_USD,
} from './worldCupBallInternationalPrize.mjs'
import { countryDisplayName } from './trafficSource.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'

const LABEL_STYLE =
  'font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#a8a29e'
const VALUE_STYLE = 'font-size:14px;color:#e7e5e4'
const VALUE_MONO_STYLE = 'font-family:ui-monospace,Menlo,Consolas,monospace;color:#fef3c7;font-size:13px'

export function worldCupBallWinnerEmailSubject(detailsComplete = true) {
  if (detailsComplete) {
    return `You have won — ${WORLD_CUP_BALL_GIVEAWAY_LABEL} | ShowSkills Rewards`
  }
  return `Action required — complete your ${WORLD_CUP_BALL_GIVEAWAY_LABEL} winner details | ShowSkills Rewards`
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
 *   forBrowserPreview?: boolean
 *   prizeFulfilment?: 'uk_ball' | 'international_cash'
 *   countryCode?: string
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
    forBrowserPreview = false,
    countryCode,
  } = props

  const prizeFulfilment =
    props.prizeFulfilment || resolveWorldCupBallPrizeFulfilment(countryCode)
  const isInternationalCash = prizeFulfilment === 'international_cash'
  const prizeHeadline = isInternationalCash
    ? `USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} cash prize`
    : WORLD_CUP_BALL_PRIZE_TITLE
  const photographySummary = worldCupBallPhotographySummaryForFulfilment(prizeFulfilment)

  const sandboxBanner = sandboxNote
    ? `<p style="margin:0 0 16px;padding:12px 14px;font-size:13px;line-height:1.5;color:#fde68a;background:rgba(120,53,15,0.25);border-radius:10px;border:1px solid rgba(251,191,36,0.35)">${escapeHtml(sandboxNote)}</p>`
    : ''

  const logoSrc = emailLogoUrl(siteUrl, { forBrowserPreview })
  const name = escapeHtml(customerFullName || 'Winner')
  const prize = escapeHtml(prizeHeadline)
  const promotion = escapeHtml(WORLD_CUP_BALL_GIVEAWAY_LABEL)
  const claimHref = claimUrl ? escapeHtml(claimUrl) : ''
  const won =
    wonAt &&
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/London',
    }).format(new Date(wonAt))

  const introComplete = isInternationalCash
    ? `You answered every skill question correctly within the time limits and have won <strong style="color:#fef3c7">${prize}</strong> in the <strong style="color:#fef3c7">${promotion}</strong>. Your fulfilment details are saved and we will issue your official ShowSkills winning cheque for USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} after you provide the mandatory winning-cheque photograph.`
    : `You answered every skill question correctly within the time limits and have won the <strong style="color:#fef3c7">${prize}</strong> in the <strong style="color:#fef3c7">${promotion}</strong>. Your delivery details are saved and we will arrange <strong style="color:#fef3c7">free UK shipping</strong> of your football after you provide the mandatory USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning-cheque photograph.`

  const introPending = isInternationalCash
    ? `You answered every skill question correctly within the time limits and have won <strong style="color:#fef3c7">${prize}</strong> in the <strong style="color:#fef3c7">${promotion}</strong>. <strong style="color:#fef3c7">Please provide your fulfilment details</strong> using the secure link below so we can process your USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} cash prize. You must agree to the mandatory winning-cheque photograph.`
    : `You answered every skill question correctly within the time limits and have won the <strong style="color:#fef3c7">${prize}</strong> in the <strong style="color:#fef3c7">${promotion}</strong>. <strong style="color:#fef3c7">Please provide your delivery details</strong> using the secure link below so we can ship your football — UK delivery is free for the winner. You must agree to the mandatory USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning-cheque photograph.`

  const detailRows = []
  if (winReference) {
    detailRows.push(
      `<tr><td style="padding:6px 0;${LABEL_STYLE}">Win reference</td><td align="right" style="padding:6px 0;${VALUE_MONO_STYLE}">${escapeHtml(winReference)}</td></tr>`,
    )
  }
  if (won) {
    detailRows.push(
      `<tr><td style="padding:6px 0;${LABEL_STYLE}">Won</td><td align="right" style="padding:6px 0;${VALUE_STYLE}">${escapeHtml(won)} (UK)</td></tr>`,
    )
  }
  if (countryCode) {
    detailRows.push(
      `<tr><td style="padding:6px 0;${LABEL_STYLE}">Country</td><td align="right" style="padding:6px 0;${VALUE_STYLE}">${escapeHtml(countryDisplayName(countryCode))}</td></tr>`,
    )
  }
  if (customerPhone) {
    detailRows.push(
      `<tr><td style="padding:6px 0;${LABEL_STYLE}">Contact number</td><td align="right" style="padding:6px 0;${VALUE_STYLE}">${escapeHtml(customerPhone)}</td></tr>`,
    )
  }
  detailRows.push(
    `<tr><td style="padding:6px 0;${LABEL_STYLE}">Prize</td><td align="right" style="padding:6px 0;${VALUE_STYLE}">${prize}</td></tr>`,
  )

  const detailsBox =
    detailRows.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:rgba(0,0,0,0.22);border-radius:12px;border:1px solid rgba(251,191,36,0.25)">
          <tr><td style="padding:16px 18px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows.join('')}</table>
          </td></tr>
        </table>`
      : ''

  const claimButton = claimHref
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
          <tr><td style="border-radius:10px;background:#b45309">
            <a href="${claimHref}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">
              ${detailsComplete ? 'View your fulfilment form' : 'Complete your winner details'}
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 20px;font-size:12px;line-height:1.55;color:#78716c">
          Or use this link: <a href="${claimHref}" style="color:#fbbf24;word-break:break-all">${claimHref}</a>
        </p>`
    : ''

  const nextSteps = [
    detailsComplete
      ? isInternationalCash
        ? `<strong style="color:#fef3c7">Your fulfilment details are saved.</strong> We will contact you to issue your USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning cheque once you provide the mandatory photograph holding it.`
        : `<strong style="color:#fef3c7">Your delivery details are saved.</strong> We will ship your football to the UK address you provided after you provide the mandatory USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning-cheque photograph.`
      : isInternationalCash
        ? '<strong style="color:#fef3c7">Complete the fulfilment form</strong> with your name, email, contact phone, country, and mailing address (parent or guardian details if you are 16 or 17). You must agree to the mandatory winning-cheque photograph.'
        : `<strong style="color:#fef3c7">Complete the delivery form</strong> with your name, email, mobile number, and UK postal address (parent or guardian details if you are 16 or 17). You must agree to the mandatory USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning-cheque photograph.`,
    isInternationalCash ? null : escapeHtml(WORLD_CUP_BALL_FREE_SHIPPING_NOTICE),
    escapeHtml(photographySummary),
    `Questions? Email <a href="mailto:${SHOWSKILLS_CONTACT_EMAIL}" style="color:#fbbf24;text-decoration:none">${SHOWSKILLS_CONTACT_EMAIL}</a>.`,
  ].filter(Boolean)

  const nextStepsHtml = nextSteps
    .map(
      (step) =>
        `<tr><td style="padding:8px 0 8px 14px;border-left:2px solid rgba(251,191,36,0.4);font-size:13px;line-height:1.6;color:#d6d3d1">${step}</td></tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Winner notification — ${promotion}</title>
</head>
<body style="margin:0;padding:0;background:#0c1a16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a16;padding:36px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr>
            <td style="padding:0 0 24px;text-align:center">
              <img src="${escapeHtml(logoSrc)}" alt="ShowSkills Rewards" width="156" style="display:block;margin:0 auto 16px;max-width:156px;height:auto;border:0" />
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#d97706">Official winner notification</p>
              <p style="margin:0;font-size:24px;font-weight:700;line-height:1.3;color:#fef3c7">You have won</p>
              <p style="margin:8px 0 0;font-size:14px;color:#a8a29e">${promotion}</p>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(180deg,#0f2922 0%,#0a1f19 100%);border:1px solid rgba(251,191,36,0.35);border-radius:16px;padding:28px 24px">
              ${sandboxBanner}
              <p style="margin:0 0 14px;font-size:16px;color:#e7e5e4">Dear ${name},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#d6d3d1">
                ${detailsComplete ? introComplete : introPending}
                This is a formal notification under our published terms and conditions.
              </p>
              ${detailsBox}
              ${claimButton}
              <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#a8a29e">What happens next</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${nextStepsHtml}</table>
              <p style="margin:0;font-size:12px;line-height:1.55;color:#78716c">
                If you did not enter this promotion, contact
                <a href="mailto:${SHOWSKILLS_CONTACT_EMAIL}" style="color:#fbbf24;text-decoration:none">${SHOWSKILLS_CONTACT_EMAIL}</a>
                immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 12px 0;text-align:center;font-size:11px;line-height:1.5;color:#57534e">
              ShowSkills Rewards · Premium skill competitions<br />
              <a href="${escapeHtml(siteUrl)}" style="color:#78716c;text-decoration:none">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
    countryCode,
  } = props

  const prizeFulfilment =
    props.prizeFulfilment || resolveWorldCupBallPrizeFulfilment(countryCode)
  const isInternationalCash = prizeFulfilment === 'international_cash'
  const prizeHeadline = isInternationalCash
    ? `USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} cash prize`
    : WORLD_CUP_BALL_PRIZE_TITLE
  const photographySummary = worldCupBallPhotographySummaryForFulfilment(prizeFulfilment)

  const lines = [
    detailsComplete ? 'You have won — ShowSkills Rewards' : 'Action required — complete your winner details',
    '',
    `Dear ${customerFullName || 'Winner'},`,
    '',
    `You have won ${prizeHeadline} in the ${WORLD_CUP_BALL_GIVEAWAY_LABEL}.`,
    'You answered every skill question correctly within the time limits.',
    '',
  ]
  if (sandboxNote) lines.push(sandboxNote, '')
  if (winReference) lines.push(`Win reference: ${winReference}`)
  if (countryCode) lines.push(`Country: ${countryDisplayName(countryCode)}`)
  if (customerPhone) lines.push(`Contact number: ${customerPhone}`)
  if (wonAt) lines.push(`Won: ${wonAt}`)
  if (claimUrl) {
    lines.push('', detailsComplete ? 'Your fulfilment form:' : 'Complete your winner details:', claimUrl)
  }
  lines.push(
    '',
    'What happens next:',
    detailsComplete
      ? isInternationalCash
        ? `• Your fulfilment details are saved. We will issue your USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning cheque after the mandatory photograph is provided.`
        : `• Your delivery details are saved. We will arrange free UK shipping of your football after the mandatory USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning-cheque photograph is provided.`
      : isInternationalCash
        ? '• Please provide your name, email, contact phone, country, and mailing address using the link above.'
        : `• Please provide your name, email, mobile number, and UK postal address using the link above. You must agree to the mandatory USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD} winning-cheque photograph.`,
  )
  if (!isInternationalCash) {
    lines.push(`• ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE}`)
  }
  lines.push(
    `• ${photographySummary}`,
    '',
    `Questions: ${SHOWSKILLS_CONTACT_EMAIL}`,
    '',
    'If you did not enter this promotion, contact contact@showskills.co.uk immediately.',
    '',
    siteUrl,
  )
  return lines.join('\n')
}
