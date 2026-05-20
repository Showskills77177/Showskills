/**
 * Ticket bundle row icons — Lucide (ISC), https://lucide.dev
 * Fixed footprint; slot height matches bundle title line-height for alignment.
 */
import { Flame, Layers, Rocket, Sparkles, Ticket, Trophy } from 'lucide-react'

const BUNDLE_ICONS = {
  single: Ticket,
  small5: Flame,
  medium10: Sparkles,
  bigger20: Rocket,
  whale40: Layers,
  mega25: Trophy,
}

const SLOT_CLASS = {
  /** Homepage ticket panel — matches 0.9375rem / base title line */
  panel: 'h-[1.1875rem] w-[1.125rem] sm:h-[1.375rem] sm:w-[1.125rem]',
  /** Entry modal bundle title row */
  modal: 'h-5 w-[1.125rem]',
}

const ICON_CLASS = {
  panel: 'h-[1.125rem] w-[1.125rem]',
  modal: 'h-4 w-4',
}

export function TicketBundleIcon({
  bundleId,
  variant = 'panel',
  className = '',
}) {
  const Icon = BUNDLE_ICONS[bundleId] ?? Ticket
  const slot = SLOT_CLASS[variant] ?? SLOT_CLASS.panel
  const icon = ICON_CLASS[variant] ?? ICON_CLASS.panel
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-emerald-400/95 ${slot} ${className}`}
      aria-hidden
    >
      <Icon className={icon} strokeWidth={2} absoluteStrokeWidth />
    </span>
  )
}
