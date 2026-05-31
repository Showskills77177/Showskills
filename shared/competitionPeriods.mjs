/** Draw time-scales — each period is an isolated competition window. */

export const PERIOD_STATUS = {
  draft: 'draft',
  open: 'open',
  closed: 'closed',
  drawn: 'drawn',
}

export const PERIOD_STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open for entry',
  closed: 'Closed — ready to draw',
  drawn: 'Draw completed',
}

export const DRAW_COMPETITION_SLUG = 'ronaldo_legacy_bundle'

export const DRAW_COMPETITION_LABEL = 'Ronaldo Legacy Bundle'

export const PERIOD_COPY = {
  isolation:
    'Each competition period has its own entry window and draw pool. Ticket numbers from one period are never included in another period\'s draw.',
  closeBeforeDraw:
    'Close the competition period before running the draw. Only entries received between the period open and close times are eligible.',
  drawnArchive:
    'After a winner is drawn, this period is archived. Start a new period for the next competition cycle.',
  postalNote:
    'Free postal entries are not stored online. Merge qualifying postal entrants into the draw procedure separately if required by your terms.',
}

export function formatPeriodRange(opensAt, closesAt, locale = 'en-GB') {
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  })
  const open = opensAt ? fmt.format(new Date(opensAt)) : '—'
  const close = closesAt ? fmt.format(new Date(closesAt)) : '—'
  return `${open} → ${close}`
}

/** e.g. "June 2026" for entry window labels */
export function formatPeriodMonthLabel(iso, locale = 'en-GB') {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/London',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function isPeriodEligibleForDraw(status) {
  return status === PERIOD_STATUS.closed
}
