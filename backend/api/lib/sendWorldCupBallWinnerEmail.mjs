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

  // Cash-prize winners with complete claim details get an auto-generated winner's cheque
  // attached — a failure here must never block the underlying notification email.
  let attachments
  if (detailsComplete && prizeFulfilment === 'international_cash' && cashPrizeUsd && winReference) {
    try {
      const chequePng = await generateWinnerChequePng({
        fullName: customerFullName,
        amountUsd: cashPrizeUsd,
        chequeNumber: winReference,
        dateIso: wonAt,
      })
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

  return {
    ok: true,
    id: data.id,
    deliveredTo,
    intendedTo,
    sandboxRedirect: !isResendProductionMode() && (redirected || deliveredTo !== intendedTo),
  }
}
