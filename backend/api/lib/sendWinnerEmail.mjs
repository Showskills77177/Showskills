import {
  buildWinnerEmailHtml,
  buildWinnerEmailText,
  winnerEmailSubject,
} from '../../../shared/winnerNotificationEmail.mjs'
import {
  getResendApiKey,
  resolveResendFrom,
  resolveSiteUrl,
  formatResendError,
  resolveCustomerEmailRecipient,
  isResendProductionMode,
  parseResendSandboxRecipient,
} from './resendConfig.mjs'

export async function sendWinnerNotificationEmail({
  to,
  customerFullName,
  customerPhone,
  winningTicketNumber,
  periodTitle,
  orderRef,
  drawnAt,
}) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping winner notification')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const { to: deliverTo, intendedTo, redirected } = resolveCustomerEmailRecipient(to)
  if (!deliverTo || !deliverTo.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const props = {
    customerFullName,
    customerPhone,
    winningTicketNumber,
    periodTitle,
    siteUrl: resolveSiteUrl(),
    orderRef,
    drawnAt,
    sandboxNote: redirected
      ? `[Local test] This notification was sent to your Resend account inbox (${deliverTo}) instead of ${intendedTo}.`
      : undefined,
  }

  async function postWinnerEmail(recipient, note) {
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
        subject: winnerEmailSubject(periodTitle),
        html: buildWinnerEmailHtml(emailProps),
        text: buildWinnerEmailText(emailProps),
      }),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  let deliveredTo = deliverTo
  let sandboxNote = props.sandboxNote
  let { res, data } = await postWinnerEmail(deliveredTo, sandboxNote)

  if (!res.ok) {
    const allowed = parseResendSandboxRecipient(data?.message)
    if (allowed && allowed !== deliveredTo) {
      console.warn(`[email] Winner notification retry to Resend sandbox inbox ${allowed} (was ${deliveredTo})`)
      deliveredTo = allowed
      sandboxNote =
        sandboxNote ||
        `[Local test] This notification was sent to your Resend account inbox (${allowed}) instead of ${intendedTo}.`
      ;({ res, data } = await postWinnerEmail(deliveredTo, sandboxNote))
    }
  }

  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] Winner notification failed:', msg)
    return { ok: false, error: msg }
  }
  return {
    ok: true,
    id: data.id,
    deliveredTo,
    intendedTo,
    sandboxRedirect:
      !isResendProductionMode() && (redirected || deliveredTo !== intendedTo),
  }
}
