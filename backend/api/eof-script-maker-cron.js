import handler from './admin/eof-script-maker.js'

/**
 * Optional Script Maker cron alias (admin / manual). Staging Hobby schedule
 * is merged into /api/eof-daily-cron (≤2 once-daily jobs) — see vercel.json.
 */
export default handler
