import { escapeHtml } from './purchaseConfirmationEmail.mjs'
import { PRIZE_REVEAL_VIEW_SECONDS } from './prizeReveal.mjs'

/**
 * Email bandeau — purchasers tap through to a timed full bundle preview (not on the public site).
 * @param {{ prizeRevealUrl?: string, viewSeconds?: number }} props
 */
export function buildPrizeRevealEmailHtmlBlock({
  prizeRevealUrl = '',
  viewSeconds = PRIZE_REVEAL_VIEW_SECONDS,
} = {}) {
  const url = typeof prizeRevealUrl === 'string' ? prizeRevealUrl.trim() : ''
  if (!url) return ''
  const safeUrl = escapeHtml(url)
  const secs = Number(viewSeconds) > 0 ? Number(viewSeconds) : PRIZE_REVEAL_VIEW_SECONDS
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;border:1px solid rgba(251,191,36,0.45);background:linear-gradient(135deg,rgba(120,53,15,0.35) 0%,rgba(6,78,59,0.25) 100%)">
    <tr><td style="padding:18px 20px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#fcd34d">Your prize preview</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#e7e5e4">You qualified with <strong style="color:#fef3c7">all three correct answers</strong>. See the <strong style="color:#fef3c7">same bundle prize imagery as on the site</strong> (poster, iPhone, and gold case) for <strong style="color:#fef3c7">${secs} seconds</strong> — <strong style="color:#fef3c7">one time only</strong>. Open this personal link when you are ready.</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:10px;background:linear-gradient(90deg,#b45309,#d97706)">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#0c0a09;text-decoration:none">View full bundle imagery</a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;line-height:1.45;color:#78716c">One-time personal link — ${secs}-second viewing window. Screenshots are discouraged and may breach our terms.</p>
    </td></tr>
  </table>`
}

export function buildPrizeRevealEmailTextLines({ prizeRevealUrl = '', viewSeconds = PRIZE_REVEAL_VIEW_SECONDS } = {}) {
  const url = typeof prizeRevealUrl === 'string' ? prizeRevealUrl.trim() : ''
  if (!url) return []
  const secs = Number(viewSeconds) > 0 ? Number(viewSeconds) : PRIZE_REVEAL_VIEW_SECONDS
  return [
    '',
    '--- Your prize preview (qualified entrants only) ---',
    `One-time ${secs}-second view of the same bundle prize imagery as on the site (poster, phone, and case):`,
    url,
    'This preview is not shown on the public website. The link works once.',
  ]
}
