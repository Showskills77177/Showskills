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

/**
 * @param {{ closesAt?: string | null, opensAt?: string | null, label?: string, className?: string, live?: boolean, showDot?: boolean, pending?: boolean }} props
 */
export function CompetitionCountdown({
  closesAt,
  opensAt,
  label = 'Competition ends',
  className = '',
  live = true,
  showDot = true,
  pending = false,
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!live || pending) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [live, pending])

  const state = useMemo(() => {
    if (pending) return { kind: 'pending', text: '' }
    const openMs = opensAt ? new Date(opensAt).getTime() : null
    const closeMs = closesAt ? new Date(closesAt).getTime() : null
    if (closeMs && now >= closeMs) {
      return { kind: 'ended', text: `Ended on ${formatEndDate(closesAt)}` }
    }
    if (openMs && now < openMs) {
      return {
        kind: 'upcoming',
        text: `Opens ${formatEndDate(opensAt)} · starts in ${formatRemaining(openMs - now) || 'soon'}`,
      }
    }
    if (closeMs) {
      return {
        kind: 'live',
        text: `${label} ${formatEndDate(closesAt)} · ${formatRemaining(closeMs - now) || 'soon'} left`,
      }
    }
    return { kind: 'unknown', text: 'Entry dates not set yet' }
  }, [closesAt, opensAt, label, now, pending])

  if (pending) {
    return (
      <p
        className={`inline-flex w-fit max-w-full items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-semibold leading-snug sm:text-xs md:text-sm animate-pulse ${className}`}
        aria-hidden
      >
        <span className="invisible whitespace-nowrap">Competition ends 1 Jan 2026, 00:00 · 30d 0h 0m left</span>
      </p>
    )
  }

  const tone =
    state.kind === 'ended'
      ? 'border-stone-600/40 bg-stone-950/60 text-stone-400'
      : state.kind === 'upcoming'
        ? 'border-amber-500/30 bg-amber-950/30 text-amber-100'
        : 'border-emerald-400/35 bg-emerald-950/50 text-emerald-100'

  return (
    <p
      className={`inline-flex w-fit max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full border px-3 py-1.5 text-center text-[11px] font-semibold leading-snug sm:text-xs md:text-sm ${tone} ${className}`}
      role="status"
    >
      {showDot ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 opacity-90" aria-hidden /> : null}
      <span className="min-w-0">{state.text}</span>
    </p>
  )
}
