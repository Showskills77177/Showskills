import {
  formatResendError,
  getResendApiKey,
  isResendProductionMode,
  resendAccountEmail,
  resolveResendFrom,
} from './resendConfig.mjs'
import { SHOWSKILLS_CONTACT_EMAIL, contactTopicLabel } from '../../../shared/siteContact.mjs'

function resolveContactTo() {
  const override = (process.env.CONTACT_EMAIL_TO || '').trim()
  if (override.includes('@')) return override
  if (isResendProductionMode()) return SHOWSKILLS_CONTACT_EMAIL
  const sandbox = resendAccountEmail()
  return sandbox || SHOWSKILLS_CONTACT_EMAIL
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{ name: string, email: string, topic: string, message: string }} fields
 */
export async function sendContactFormEmail({ name, email, topic, message }) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping contact form email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const topicLabel = contactTopicLabel(topic)
  const to = resolveContactTo()
  const subject = `[ShowSkills Contact] ${topicLabel} — ${name}`
  const text = [
    `Topic: ${topicLabel}`,
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    message,
    '',
    isResendProductionMode()
      ? `Delivered to ${SHOWSKILLS_CONTACT_EMAIL}.`
      : `Local dev: delivered to ${to} (Resend sandbox). Production uses ${SHOWSKILLS_CONTACT_EMAIL}.`,
  ].join('\n')

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1c1917">
<p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
<hr style="border:none;border-top:1px solid #e7e5e4;margin:16px 0" />
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>
</body></html>`

  const payload = {
    from: resolveResendFrom(),
    to: [to],
    reply_to: email,
    subject,
    html,
    text,
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
    console.error('[email] Contact form Resend failed:', msg)
    return { ok: false, error: msg }
  }
  return { ok: true, id: data.id, deliveredTo: to }
}
