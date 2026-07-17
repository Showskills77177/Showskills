/**
 * EOF Scheduler + Script Maker time helpers.
 *
 * Hobby cron (vercel.json) fires /api/eof-daily-cron at:
 *   - 09:00 UTC → daily Short auto-publish window
 *   - 23:00 UTC → UK midnight Script Maker window (BST); gated by isLondonLocalMidnightHour
 *
 * Auto-publish also stores hourUtc/minuteUtc so the shared 23:00 fire does not
 * rebuild+upload unless the owner deliberately set that UTC hour.
 */
import { EOF_SCRIPT_MAKER_TZ, londonDateParts, isLondonLocalMidnightHour } from './eofScriptMakerSchedule.mjs'

/** Hobby once-daily slot used for the morning auto-publish Short. */
export const EOF_HOBBY_AUTO_PUBLISH_UTC = Object.freeze({ hour: 9, minute: 0 })

/** Hobby once-daily slot that covers UK midnight during BST (swap to 00:00 UTC in GMT winters). */
export const EOF_HOBBY_SCRIPT_MAKER_UTC = Object.freeze({ hour: 23, minute: 0 })

export function pad2(n) {
  return String(Math.min(99, Math.max(0, Number(n) || 0))).padStart(2, '0')
}

/** @param {number} hourUtc @param {number} [minuteUtc] */
export function formatUtcClock(hourUtc, minuteUtc = 0) {
  return `${pad2(hourUtc)}:${pad2(minuteUtc)} UTC`
}

/**
 * Convert a UTC clock (today's date in UTC) to Europe/London wall clock label.
 * @param {number} hourUtc
 * @param {number} [minuteUtc]
 * @param {Date} [anchor] — calendar day for DST lookup
 */
export function utcClockToLondonLabel(hourUtc, minuteUtc = 0, anchor = new Date()) {
  const h = Math.min(23, Math.max(0, Number(hourUtc) || 0))
  const m = Math.min(59, Math.max(0, Number(minuteUtc) || 0))
  const d = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), h, m, 0),
  )
  const parts = londonDateParts(d)
  if (parts.hour == null) return '—'
  return `${pad2(parts.hour)}:${pad2(parts.minute)} UK (${EOF_SCRIPT_MAKER_TZ})`
}

/**
 * True when `when` is in the configured auto-publish UTC hour
 * (minute must be >= minuteUtc within that hour — cron fires at :00).
 */
export function isEofSchedulerHourMatch(when, hourUtc, minuteUtc = 0) {
  const d = when instanceof Date ? when : new Date(when)
  if (Number.isNaN(d.getTime())) return false
  const wantH = Math.min(23, Math.max(0, Number(hourUtc) || 0))
  const wantM = Math.min(59, Math.max(0, Number(minuteUtc) || 0))
  if (d.getUTCHours() !== wantH) return false
  return d.getUTCMinutes() >= wantM
}

/** Hobby auto-publish slot matches the saved scheduler hour. */
export function isAutoPublishAlignedWithHobbyCron(hourUtc, minuteUtc = 0) {
  return (
    Number(hourUtc) === EOF_HOBBY_AUTO_PUBLISH_UTC.hour &&
    Number(minuteUtc || 0) === EOF_HOBBY_AUTO_PUBLISH_UTC.minute
  )
}

/**
 * Estimated YouTube publish-at instant from "now" + delay minutes.
 * @param {number} delayMinutes
 * @param {Date} [from]
 */
export function estimatePublishAtIso(delayMinutes = 30, from = new Date()) {
  const mins = Math.min(24 * 60, Math.max(0, Number(delayMinutes) || 0))
  return new Date(from.getTime() + mins * 60 * 1000).toISOString()
}

/** Human London + UTC labels for a publish-at instant. */
export function formatPublishAtLabels(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) {
    return { utc: '—', london: '—', local: '—' }
  }
  const london = londonDateParts(d)
  return {
    utc: `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    london:
      london.hour == null
        ? '—'
        : `${london.year}-${pad2(london.month)}-${pad2(london.day)} ${pad2(london.hour)}:${pad2(london.minute)} UK`,
    local: d.toLocaleString(),
  }
}

/**
 * Coordinated overnight pipeline copy for admin UI.
 * Script Maker = UK midnight drafts · Auto-publish = morning Hobby slot (default 09:00 UTC).
 */
export function eofOvernightPipelineNote({ hourUtc = 9, minuteUtc = 0, autoPublishEnabled = false } = {}) {
  const publishUtc = formatUtcClock(hourUtc, minuteUtc)
  const publishLondon = utcClockToLondonLabel(hourUtc, minuteUtc)
  const aligned = isAutoPublishAlignedWithHobbyCron(hourUtc, minuteUtc)
  return {
    scriptMaker: 'Script Maker: UK midnight (00:00 Europe/London) via Hobby cron 23:00 UTC in BST.',
    autoPublish: `Auto-publish: ${publishUtc} (= ${publishLondon}).${
      aligned ? '' : ' Hobby cron fires at 09:00 UTC — set Hour to 9 so the job actually runs.'
    }`,
    autoPublishEnabled: Boolean(autoPublishEnabled),
    alignedWithHobbyCron: aligned,
    scriptMakerMidnightGate: true,
  }
}

export { isLondonLocalMidnightHour, EOF_SCRIPT_MAKER_TZ }
