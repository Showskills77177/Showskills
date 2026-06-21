/** Calendar months (YYYY-MM) when the World Cup Ball monthly draw runs — tournament host summer 2026. */
export const WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS = ['2026-06', '2026-07']

export const WORLD_CUP_BALL_MONTHLY_DRAW_ENTRY_COUNT = 1

export const WORLD_CUP_BALL_MONTHLY_DRAW_SUMMARY =
  'If you do not win the ball outright on your quiz attempt, you automatically receive one free entry into that month’s World Cup Ball draw — a random chance to win the same official-style FIFA World Cup football during the 2026 tournament summer (June and July).'

export const WORLD_CUP_BALL_MONTHLY_DRAW_SHORT =
  'Miss the skill win? You still get one free automatic entry into that month’s World Cup Ball draw.'

export const WORLD_CUP_BALL_MONTHLY_DRAW_GOVERNANCE = {
  isolation:
    'Each monthly draw uses only entries recorded for that calendar month (YYYY-MM). Failed skill attempts from other months are never mixed in.',
  oneDrawPerMonth:
    'Run at most one official draw per month. After a winner is recorded, that month is closed — the audit log preserves the result.',
  contact:
    'Draw entries are anonymous (IP + entry number only). Contact the winning entrant manually using server logs or ask them to complete delivery details if they come forward.',
}

/** Public-facing monthly draw entry number (one per failed quiz attempt). */
export function formatWorldCupBallDrawEntryNumber(serial) {
  const s = String(serial).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `WCD-${s}`
}

export function formatWorldCupBallDrawMonthKey(isoDate = new Date()) {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function formatWorldCupBallDrawMonthLabel(drawMonth) {
  if (typeof drawMonth !== 'string' || !/^\d{4}-\d{2}$/.test(drawMonth)) return drawMonth || ''
  const [year, monthPart] = drawMonth.split('-')
  const monthIndex = Number(monthPart) - 1
  if (monthIndex < 0 || monthIndex > 11) return drawMonth
  return `${MONTH_NAMES[monthIndex]} ${year}`
}

/**
 * @param {Date | string} [isoDate]
 * @param {{ promotionalPreview?: boolean }} [options] — staging/dev may award into the first draw month before June 2026.
 * @returns {{ drawMonth: string, label: string, preview?: boolean } | null}
 */
export function resolveWorldCupBallMonthlyDrawPeriod(isoDate = new Date(), options = {}) {
  const key = formatWorldCupBallDrawMonthKey(isoDate)
  if (!key) return null

  if (WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS.includes(key)) {
    return { drawMonth: key, label: formatWorldCupBallDrawMonthLabel(key) }
  }

  if (options.promotionalPreview && WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS.length) {
    const drawMonth = WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS[0]
    return {
      drawMonth,
      label: formatWorldCupBallDrawMonthLabel(drawMonth),
      preview: true,
    }
  }

  return null
}

/** @param {{ entryNumber?: string, drawMonthLabel?: string, drawMonth?: string }} [opts] */
export function formatWorldCupBallMonthlyDrawAwardMessage({
  entryNumber,
  drawMonthLabel,
  drawMonth,
} = {}) {
  const month =
    typeof drawMonthLabel === 'string' && drawMonthLabel.trim()
      ? drawMonthLabel.trim()
      : formatWorldCupBallDrawMonthLabel(drawMonth)
  if (!month) return null

  const entryLine =
    typeof entryNumber === 'string' && entryNumber.trim()
      ? ` Your draw entry number is ${entryNumber.trim()}.`
      : ''

  return `You did not win the ball on this skill attempt, but you have received ${WORLD_CUP_BALL_MONTHLY_DRAW_ENTRY_COUNT} free automatic ${WORLD_CUP_BALL_MONTHLY_DRAW_ENTRY_COUNT === 1 ? 'entry' : 'entries'} into the ${month} World Cup Ball draw — a random chance to win the same official-style FIFA World Cup football.${entryLine} We will contact the draw winner using details collected if you win the monthly draw.`
}
