import {
  buildQuizResultHtml,
  buildQuizResultText,
  quizResultSubject,
} from '../../../shared/quizResultEmail.mjs'

function purchaseFromEmail() {
  return (process.env.PURCHASE_EMAIL_FROM || process.env.RESEND_FROM || 'ShowSkills Rewards <orders@showskills.co.uk>').trim()
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://showskills.co.uk').replace(/\/$/, '')
}

/** Sent after paid entrants submit skill answers (correct or not). */
export async function sendQuizResultEmail({ to, customerFullName, allCorrect }) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping quiz result email')
    return { ok: false, skipped: true, reason: 'no_resend_key' }
  }

  const email = to?.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_email' }
  }

  const props = {
    customerFullName,
    allCorrect: Boolean(allCorrect),
    siteUrl: siteUrl(),
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: purchaseFromEmail(),
      to: [email],
      subject: quizResultSubject(props.allCorrect),
      html: buildQuizResultHtml(props),
      text: buildQuizResultText(props),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText
    console.error('[email] Quiz result Resend failed:', msg)
    return { ok: false, error: String(msg) }
  }
  return { ok: true, id: data.id }
}
