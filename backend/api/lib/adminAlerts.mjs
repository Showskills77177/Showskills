/**
 * Central recipient for automated admin alert emails — used for both the
 * every-50-impressions milestone alert and every draw-winner notification.
 * Overridable via env for testing/other deployments.
 */
export function resolveAdminAlertEmail() {
  return (process.env.ADMIN_ALERT_EMAIL || process.env.IMPRESSION_ALERT_EMAIL || 'alexander77177@protonmail.com').trim()
}
