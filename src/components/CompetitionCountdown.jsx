import { useEffect, useMemo, useState } from 'react'

function formatRemaining(ms) {
  if (ms <= 0) return null
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

function formatEndDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/London',
    }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

const THEME_TONES = {
  teal: {
    pending: 'border-emerald-400/20 bg-emerald-950/30',
    live: 'border-emerald-400/35 bg-emerald-950/50 text-emerald-100',
    dot: 'bg-emerald-400',
  },
  lime: {
    pending: 'border-lime-400/25 bg-lime-950/35',
    live: 'border-lime-400/40 bg-lime-950/45 text-lime-100',
    dot: 'bg-lime-400',
  },
}

const PILL_CLASS =
  'inline-flex min-h-[2.85rem] w-full max-w-full items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-center text-[11px] font-semibold leading-snug tabular-nums sm:min-h-[3rem] sm:w-fit sm:text-xs md:text-sm'

const BODY_CLASS = 'flex min-w-0 flex-col items-center gap-0.5 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-1.5 sm:gap-y-0'

function CountdownBody({ primary, secondary }) {
  if (!secondary) {
    return <span className="min-w-0">{primary}</span>
  }
  return (
    <span className={BODY_CLASS}>
      <span className="min-w-0">{primary}</span>
      <span className="whitespace-nowrap">
        <span className="hidden sm:inline" aria-hidden>
          ·{' '}
        </span>
        {secondary}
      </span>
    </span>
  )
}

/**
 * @param {{ closesAt?: string | null, opensAt?: string | null, label?: string, className?: string, live?: boolean, showDot?: boolean, pending?: boolean, showUnknown?: boolean, theme?: 'teal' | 'lime' }} props
 */
export function CompetitionCountdown({
  closesAt,
  opensAt,
  label = 'Competition ends',
  className = '',
  live = true,
  showDot = true,
  pending = false,
  showUnknown = true,
  theme = 'teal',
}) {
  const palette = THEME_TONES[theme] || THEME_TONES.teal
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!live || pending) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [live, pending])

  const state = useMemo(() => {
    if (pending) return { kind: 'pending' }
    const openMs = opensAt ? new Date(opensAt).getTime() : null
    const closeMs = closesAt ? new Date(closesAt).getTime() : null
    if (closeMs && now >= closeMs) {
      return { kind: 'ended', primary: `Ended on ${formatEndDate(closesAt)}` }
    }
    if (openMs && now < openMs) {
      const remaining = formatRemaining(openMs - now) || 'soon'
      return {
        kind: 'upcoming',
        primary: `Opens ${formatEndDate(opensAt)}`,
        secondary: `starts in ${remaining}`,
      }
    }
    if (closeMs) {
      const remaining = formatRemaining(closeMs - now) || 'soon'
      return {
        kind: 'live',
        primary: `${label} ${formatEndDate(closesAt)}`,
        secondary: `${remaining} left`,
      }
    }
    return { kind: 'unknown', primary: 'Entry dates not set yet' }
  }, [closesAt, opensAt, label, now, pending, showUnknown])

  if (!showUnknown && state.kind === 'unknown') {
    return null
  }

  if (pending) {
    return (
      <p
        className={`${PILL_CLASS} ${palette.pending} ${className}`}
        aria-hidden
      >
        <span className={`${BODY_CLASS} invisible`}>
          <span>Competition ends 1 Jan 2026, 00:00</span>
          <span className="whitespace-nowrap">30d 0h 0m left</span>
        </span>
      </p>
    )
  }

  const tone =
    state.kind === 'ended'
      ? 'border-stone-600/40 bg-stone-950/60 text-stone-400'
      : state.kind === 'upcoming'
        ? 'border-amber-500/30 bg-amber-950/30 text-amber-100'
        : palette.live

  return (
    <p className={`${PILL_CLASS} ${tone} ${className}`} role="status">
      {showDot ? <span className={`h-2 w-2 shrink-0 rounded-full opacity-90 ${palette.dot}`} aria-hidden /> : null}
      <CountdownBody primary={state.primary} secondary={state.secondary} />
    </p>
  )
}
