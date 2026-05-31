import { TRUSTPILOT_REVIEW_URL } from './trustpilotConfig.mjs'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function resolveTrustpilotReviewUrl(override) {
  const url = typeof override === 'string' && override.trim() ? override.trim() : TRUSTPILOT_REVIEW_URL
  return url.replace(/\/$/, '')
}

/** Inline Trustpilot review invite for transactional emails (HTML). */
export function buildTrustpilotEmailHtmlBlock(reviewUrl = TRUSTPILOT_REVIEW_URL) {
  const url = escapeHtml(resolveTrustpilotReviewUrl(reviewUrl))
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;background:rgba(0,182,122,0.08);border-radius:12px;border:1px solid rgba(0,182,122,0.28)">
    <tr><td style="padding:18px 20px;text-align:center">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6ee7b7">Trustpilot</p>
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#ecfdf5">How was your experience?</p>
      <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#a8a29e">If you have a moment, we would really appreciate a review on Trustpilot. Your feedback helps other players find ShowSkills Rewards.</p>
      <a href="${url}" style="display:inline-block;padding:11px 22px;border-radius:10px;background:#00b67a;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">Review us on Trustpilot</a>
      <p style="margin:12px 0 0;font-size:11px;line-height:1.45;color:#78716c"><a href="${url}" style="color:#6ee7b7;word-break:break-all">${url}</a></p>
    </td></tr>
  </table>`
}

/** Plain-text lines for transactional emails. */
export function buildTrustpilotEmailTextLines(reviewUrl = TRUSTPILOT_REVIEW_URL) {
  const url = resolveTrustpilotReviewUrl(reviewUrl)
  return [
    '',
    'How was your experience?',
    'If you have a moment, we would really appreciate a review on Trustpilot:',
    url,
  ]
}
