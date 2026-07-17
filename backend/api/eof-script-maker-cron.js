import handler from './admin/eof-script-maker.js'

/**
 * Vercel Cron entry for Script Maker.
 * Two once-daily UTC schedules (23:00 + 00:00) — Hobby forbids a single
 * expression that fires more than once per day. Handler gates to Europe/London midnight.
 */
export default handler
