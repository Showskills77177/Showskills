import { useEffect, useMemo, useState } from 'react'

/** Widest realistic countdown line — reserves space so the pill never reflows. */
export const COMPETITION_COUNTDOWN_RESERVE_TEXT =
  'Competition ends 31 Dec 2026, 23:59 · 99d 23h 59m 59s left'

function formatRemaining(ms) {
  if (ms <= 0) return null
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`
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

function CountdownShell({ tone, className, showDot, children, ariaHidden = false }) {
  return (
    <p
      className={`ss-competition-countdown relative inline-flex w-fit max-w-full justify-center rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-snug sm:text-xs md:text-sm ${tone} ${className}`}
      role={ariaHidden ? undefined : 'status'}
      aria-hidden={ariaHidden || undefined}
    >
      <span className="invisible block whitespace-nowrap tabular-nums">{COMPETITION_COUNTDOWN_RESERVE_TEXT}</span>
      <span className="absolute inset-0 flex items-center justify-center gap-x-2 px-3">
        {showDot ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 opacity-90" aria-hidden /> : null}
        <span className="ss-competition-countdown__text whitespace-nowrap tabular-nums">{children}</span>
      </span>
    </p>
  )
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
    if (pending) return { kind: 'pending', text: COMPETITION_COUNTDOWN_RESERVE_TEXT }
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

  const tone =
    state.kind === 'pending'
      ? 'border-emerald-400/20 bg-emerald-950/30 text-emerald-100/40'
      : state.kind === 'ended'
        ? 'border-stone-600/40 bg-stone-950/60 text-stone-400'
        : state.kind === 'upcoming'
          ? 'border-amber-500/30 bg-amber-950/30 text-amber-100'
          : 'border-emerald-400/35 bg-emerald-950/50 text-emerald-100'

  return (
    <CountdownShell tone={tone} className={className} showDot={showDot && state.kind !== 'pending'} ariaHidden={pending}>
      {pending ? '\u00a0' : state.text}
    </CountdownShell>
  )
}
