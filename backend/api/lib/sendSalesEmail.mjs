import { buildSalesEmailHtml, buildSalesEmailText } from '../../../shared/salesEmail.mjs'
import {
  getResendApiKey,
  resolveSalesEmailFrom,
  resolveSiteUrl,
  formatResendError,
  resolveCustomerEmailRecipient,
  isResendProductionMode,
  parseResendSandboxRecipient,
} from './resendConfig.mjs'

/**
 * Send an admin-composed email from sales@showskills.co.uk, with optional attachments
 * (e.g. an auto-generated winner's cheque PNG).
 *
 * @param {{
 *   to: string
 *   subject: string
 *   message: string
 *   recipientName?: string
 *   attachments?: { filename: string, content: string, content_type?: string }[]
 * }} params
 */
export async function sendSalesEmail({ to, subject, message, recipientName, attachments }) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping sales email send')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const { to: deliverTo, intendedTo, redirected } = resolveCustomerEmailRecipient(to)
  if (!deliverTo || !deliverTo.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const siteUrl = resolveSiteUrl()
  const props = {
    subject,
    message,
    recipientName,
    siteUrl,
    sandboxNote: redirected
      ? `[Local test] This email was sent to your Resend account inbox (${deliverTo}) instead of ${intendedTo}.`
      : undefined,
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
        from: resolveSalesEmailFrom(),
        to: [recipient],
        subject,
        html: buildSalesEmailHtml(emailProps),
        text: buildSalesEmailText(emailProps),
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
      console.warn(`[email] Sales email retry to Resend sandbox inbox ${allowed}`)
      deliveredTo = allowed
      sandboxNote =
        sandboxNote ||
        `[Local test] This email was sent to your Resend account inbox (${allowed}) instead of ${intendedTo}.`
      ;({ res, data } = await postEmail(deliveredTo, sandboxNote))
    }
  }

  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] Sales email failed:', msg)
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
