/**
 * Script Maker overnight schedule — UK midnight (Europe/London).
 * Vercel crons are UTC-only; Hobby requires one fire per expression per day,
 * so vercel.json lists two once-daily entries (23:00 and 00:00 UTC). The
 * handler gates with this timezone check so only true UK midnight runs.
 */

export const EOF_SCRIPT_MAKER_TZ = 'Europe/London'

/** @param {Date | string | number} [when] */
export function londonDateParts(when = new Date()) {
  const d = when instanceof Date ? when : new Date(when)
  if (Number.isNaN(d.getTime())) {
    return { year: null, month: null, day: null, hour: null, minute: null }
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EOF_SCRIPT_MAKER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type) => {
    const v = parts.find((p) => p.type === type)?.value
    return v == null ? null : Number(v)
  }
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** True during the UK local midnight hour (00:00–00:59 Europe/London). */
export function isLondonLocalMidnightHour(when = new Date()) {
  const { hour } = londonDateParts(when)
  return hour === 0
}

/** YYYY-MM-DD in Europe/London, or null if invalid. */
export function londonCalendarDayKey(when = new Date()) {
  const { year, month, day } = londonDateParts(when)
  if (year == null || month == null || day == null) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Same UK calendar day (handles GMT/BST vs UTC day boundaries). */
export function sameLondonCalendarDay(a, b = new Date()) {
  const ka = londonCalendarDayKey(a)
  const kb = londonCalendarDayKey(b)
  return Boolean(ka && kb && ka === kb)
}
