import {
  buildWorldCupBallWinnerEmailHtml,
  buildWorldCupBallWinnerEmailText,
  worldCupBallWinnerEmailSubject,
} from '../../../shared/worldCupBallWinnerEmail.mjs'
import {
  getResendApiKey,
  resolveResendFrom,
  resolveSiteUrl,
  formatResendError,
  resolveCustomerEmailRecipient,
  isResendProductionMode,
  parseResendSandboxRecipient,
} from './resendConfig.mjs'
import { generateWinnerChequePng } from './chequeGenerator.mjs'
import { WORLD_CUP_BALL_PRIZE_TITLE } from '../../../shared/worldCupBallGiveaway.mjs'
import { notifyAdminOfDrawWinner } from './notifyAdminOfDrawWinner.mjs'

export async function sendWorldCupBallWinnerEmail({
  to,
  customerFullName,
  customerPhone,
  winReference,
  wonAt,
  claimUrl,
  detailsComplete = true,
  prizeFulfilment,
  countryCode,
  cashPrizeUsd,
}) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping World Cup Ball winner notification')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const { to: deliverTo, intendedTo, redirected } = resolveCustomerEmailRecipient(to)
  if (!deliverTo || !deliverTo.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const props = {
    customerFullName,
    customerPhone,
    winReference,
    siteUrl: resolveSiteUrl(),
    wonAt,
    claimUrl,
    detailsComplete: Boolean(detailsComplete),
    prizeFulfilment,
    countryCode,
    sandboxNote: redirected
      ? `[Local test] This notification was sent to your Resend account inbox (${deliverTo}) instead of ${intendedTo}.`
      : undefined,
  }

  // Winners with complete claim details get an auto-generated winner's cheque attached —
  // a USD figure for cash winners, or a ball-prize variant for UK winners who keep the ball.
  // A failure here must never block the underlying notification email.
  let attachments
  if (detailsComplete && winReference && (prizeFulfilment === 'international_cash' ? cashPrizeUsd : prizeFulfilment === 'uk_ball')) {
    try {
      const chequePng = await generateWinnerChequePng(
        prizeFulfilment === 'international_cash'
          ? {
              fullName: customerFullName,
              amountUsd: cashPrizeUsd,
              chequeNumber: winReference,
              dateIso: wonAt,
            }
          : {
              fullName: customerFullName,
              prizeLabel: WORLD_CUP_BALL_PRIZE_TITLE,
              chequeNumber: winReference,
              dateIso: wonAt,
            },
      )
      attachments = [
        {
          filename: `${winReference}-winners-cheque.png`,
          content: chequePng.toString('base64'),
          content_type: 'image/png',
        },
      ]
    } catch (e) {
      console.error('[email] Winner cheque generation failed, sending email without attachment:', e)
    }
  }

  async function postEmail(recipient, note) {
    const emailProps = note ? { ...props, sandboxNote: note } : props
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resolveResendFrom(),
        to: [recipient],
        subject: worldCupBallWinnerEmailSubject(Boolean(detailsComplete)),
        html: buildWorldCupBallWinnerEmailHtml(emailProps),
        text: buildWorldCupBallWinnerEmailText(emailProps),
        ...(attachments?.length ? { attachments } : {}),
      }),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  let deliveredTo = deliverTo
  let sandboxNote = props.sandboxNote
  let { res, data } = await postEmail(deliveredTo, sandboxNote)

  if (!res.ok) {
    const allowed = parseResendSandboxRecipient(data?.message)
    if (allowed && allowed !== deliveredTo) {
      console.warn(`[email] World Cup Ball winner notification retry to Resend sandbox inbox ${allowed}`)
      deliveredTo = allowed
      sandboxNote =
        sandboxNote ||
        `[Local test] This notification was sent to your Resend account inbox (${allowed}) instead of ${intendedTo}.`
      ;({ res, data } = await postEmail(deliveredTo, sandboxNote))
    }
  }

  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] World Cup Ball winner notification failed:', msg)
    return { ok: false, error: msg }
  }

  await notifyAdminOfDrawWinner({
    competitionLabel: WORLD_CUP_BALL_PRIZE_TITLE || 'World Cup Ball giveaway',
    winnerEmail: intendedTo,
    winnerFullName: customerFullName,
    detailLines: [
      winReference ? `Win reference: ${winReference}` : null,
      prizeFulfilment ? `Prize choice: ${prizeFulfilment}` : null,
      countryCode ? `Country: ${countryCode}` : null,
      cashPrizeUsd ? `Cash prize (USD): ${cashPrizeUsd}` : null,
      wonAt ? `Won at: ${wonAt}` : null,
      detailsComplete ? 'Full claim details submitted.' : 'Initial win notification only — claim details pending.',
    ],
  })

  return {
    ok: true,
    id: data.id,
    deliveredTo,
    intendedTo,
    sandboxRedirect: !isResendProductionMode() && (redirected || deliveredTo !== intendedTo),
  }
}
