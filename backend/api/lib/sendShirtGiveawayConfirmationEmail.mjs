import {
  buildShirtGiveawayConfirmationHtml,
  buildShirtGiveawayConfirmationText,
  shirtGiveawayConfirmationSubject,
} from '../../../shared/shirtGiveawayConfirmationEmail.mjs'
import { buildShirtPrizeRevealUrl } from '../../../shared/shirtPrizeReveal.mjs'
import { getResendApiKey, resolveSiteUrl, resolveResendFrom, formatResendError } from './resendConfig.mjs'
import { ensureShirtPreviewToken } from './shirtPreviewToken.mjs'

export async function sendShirtGiveawayConfirmationEmail({
  to,
  customerFullName,
  submissionId,
  entryNumber,
}) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping shirt giveaway confirmation email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const email = to?.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const previewToken = await ensureShirtPreviewToken(submissionId)
  const siteUrl = resolveSiteUrl()
  const shirtPrizeRevealUrl = previewToken ? buildShirtPrizeRevealUrl(siteUrl, previewToken) : ''

  const payload = {
    from: resolveResendFrom(),
    to: [email],
    subject: shirtGiveawayConfirmationSubject(entryNumber),
    html: buildShirtGiveawayConfirmationHtml({
      customerFullName,
      entryNumber,
      siteUrl,
      shirtPrizeRevealUrl,
    }),
    text: buildShirtGiveawayConfirmationText({
      customerFullName,
      entryNumber,
      siteUrl,
      shirtPrizeRevealUrl,
    }),
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = formatResendError(data, res.status)
    console.error('[email] Shirt giveaway confirmation Resend failed:', msg)
    return { ok: false, error: msg }
  }
  return { ok: true, id: data.id }
}
