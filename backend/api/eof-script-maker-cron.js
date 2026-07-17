import handler from './admin/eof-script-maker.js'

/**
 * Vercel Cron entry for Script Maker.
 * Schedule: `0 0,23 * * *` (UTC). Handler gates to Europe/London midnight only.
 */
export default handler
