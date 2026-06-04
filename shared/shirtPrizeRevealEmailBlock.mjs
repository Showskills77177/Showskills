import { escapeHtml } from './purchaseConfirmationEmail.mjs'
import { SHIRT_PRIZE_REVEAL_VIEW_SECONDS } from './shirtPrizeReveal.mjs'
import { SHIRT_GIVEAWAY_SEASON_LABEL } from './shirtGiveaway.mjs'

/**
 * @param {{ shirtPrizeRevealUrl?: string, viewSeconds?: number }} props
 */
export function buildShirtPrizeRevealEmailHtmlBlock({
  shirtPrizeRevealUrl = '',
  viewSeconds = SHIRT_PRIZE_REVEAL_VIEW_SECONDS,
} = {}) {
  const url = typeof shirtPrizeRevealUrl === 'string' ? shirtPrizeRevealUrl.trim() : ''
  if (!url) return ''
  const safeUrl = escapeHtml(url)
  const secs = Number(viewSeconds) > 0 ? Number(viewSeconds) : SHIRT_PRIZE_REVEAL_VIEW_SECONDS
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:12px;border:1px solid rgba(132,204,22,0.4);background:linear-gradient(135deg,rgba(54,83,20,0.35) 0%,rgba(6,78,59,0.22) 100%)">
    <tr><td style="padding:18px 20px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#bef264">Your shirt prize preview</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#e7e5e4">See the <strong style="color:#ecfccb">signed Ronaldo United number 7 shirt (${escapeHtml(SHIRT_GIVEAWAY_SEASON_LABEL)})</strong> for <strong style="color:#ecfccb">${secs} seconds</strong> — <strong style="color:#ecfccb">one time only</strong>. Sponsor and league marks stay blurred for rights compliance.</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="border-radius:10px;background:linear-gradient(90deg,#4d7c0f,#65a30d)">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#0c0a09;text-decoration:none">View shirt imagery</a>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;line-height:1.45;color:#78716c">One-time personal link — ${secs}-second viewing window.</p>
    </td></tr>
  </table>`
}

export function buildShirtPrizeRevealEmailTextLines({
  shirtPrizeRevealUrl = '',
  viewSeconds = SHIRT_PRIZE_REVEAL_VIEW_SECONDS,
} = {}) {
  const url = typeof shirtPrizeRevealUrl === 'string' ? shirtPrizeRevealUrl.trim() : ''
  if (!url) return []
  const secs = Number(viewSeconds) > 0 ? Number(viewSeconds) : SHIRT_PRIZE_REVEAL_VIEW_SECONDS
  return [
    '',
    '--- Your shirt prize preview ---',
    `One-time ${secs}-second view of the signed Ronaldo United shirt (sponsor marks blurred):`,
    url,
  ]
}
