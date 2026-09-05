import { sendSalesEmail } from './sendSalesEmail.mjs'
import { resolveAdminAlertEmail } from './adminAlerts.mjs'

/**
 * Fire-and-forget admin alert email sent whenever ANY draw/giveaway winner is
 * notified — covers the legacy/main ticket draw and Ronaldo shirt giveaway
 * (via sendWinnerNotificationEmail) and the World Cup Ball giveaway (via
 * sendWorldCupBallWinnerEmail). Never throws — must never block or fail the
 * customer-facing winner email flow that triggers it.
 *
 * @param {{
 *   competitionLabel: string
 *   winnerEmail?: string
 *   winnerFullName?: string
 *   detailLines?: (string | null | undefined)[]
 * }} params
 */
export async function notifyAdminOfDrawWinner({
  competitionLabel,
  winnerEmail,
  winnerFullName,
  detailLines = [],
}) {
  try {
    const to = resolveAdminAlertEmail()
    if (!to || !to.includes('@')) return

    const lines = [
      `A winner has just been notified for: ${competitionLabel}.`,
      `Winner: ${winnerFullName || 'Unknown name'} <${winnerEmail || 'no email on file'}>`,
      ...detailLines.filter(Boolean),
      '\nThis is an automated alert sent every time a draw/giveaway winner email goes out.',
    ]

    await sendSalesEmail({
      to,
      subject: `New draw winner — ${competitionLabel}`,
      message: lines.join('\n\n'),
    })
  } catch (e) {
    console.error('[admin-alert] Failed to send draw-winner alert email:', e)
  }
}
