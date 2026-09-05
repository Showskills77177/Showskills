import { query } from './db.mjs'
import { sendSalesEmail } from './sendSalesEmail.mjs'
import { resolveAdminAlertEmail } from './adminAlerts.mjs'

/** Send an email alert every N total page-view "impressions" recorded. */
export const IMPRESSION_ALERT_STEP = 50

/** Where impression milestone alerts are sent. Overridable via env for testing/other deployments. */
export function resolveImpressionAlertEmail() {
  return resolveAdminAlertEmail()
}

/**
 * Called after every page view is recorded, with the new all-time total impression count.
 * Sends exactly one email per multiple of IMPRESSION_ALERT_STEP, using a unique-constraint
 * "claim" row so concurrent requests racing to the same milestone only send one email.
 * Never throws — analytics recording must never fail because of an alert-email issue.
 *
 * @param {number} totalCount all-time row count in site_visits, including the just-recorded view
 */
export async function checkImpressionMilestone(totalCount) {
  try {
    if (!Number.isFinite(totalCount) || totalCount <= 0) return
    if (totalCount % IMPRESSION_ALERT_STEP !== 0) return

    const claim = await query(
      `INSERT INTO impression_milestone_alerts (milestone_count) VALUES ($1) ON CONFLICT (milestone_count) DO NOTHING`,
      [totalCount],
    )
    if (!claim.rowCount) return // another request already claimed and is sending this milestone's email

    const to = resolveImpressionAlertEmail()
    if (!to || !to.includes('@')) return

    await sendSalesEmail({
      to,
      subject: `ShowSkills just hit ${totalCount.toLocaleString('en-GB')} page views`,
      message: `Your website has now recorded ${totalCount.toLocaleString('en-GB')} total page-view impressions (site_visits), reaching another ${IMPRESSION_ALERT_STEP}-view milestone.\n\nThis is an automated alert sent every ${IMPRESSION_ALERT_STEP} new impressions.`,
    })
  } catch (e) {
    console.error('[impression-milestone] Failed to send milestone alert email:', e)
  }
}
