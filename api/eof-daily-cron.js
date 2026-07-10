import handler from '../backend/api/admin/eof-scheduler.js'

/**
 * Dedicated Vercel function for the daily EOF Short cron.
 * Path must exist as a real api/*.js file so vercel.json crons resolve reliably.
 * Keep this file thin — logic lives in backend/api/admin/eof-scheduler.js.
 */
export default handler
