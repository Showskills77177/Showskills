/**
 * Ticket bundle row icons — Lucide (ISC), https://lucide.dev
 * Fixed footprint; per-tier colour only (same shapes you approved earlier).
 */
import { Flame, Layers, Rocket, Sparkles, Ticket, Trophy } from 'lucide-react'

const BUNDLE_ICONS = {
  test1p: Ticket,
  single: Ticket,
  small5: Flame,
  medium10: Sparkles,
  bigger20: Rocket,
  whale40: Layers,
  mega25: Trophy,
}

/** Tier colours — icons only, not CTA buttons */
const BUNDLE_TONE = {
  test1p: 'text-teal-400/80',
  single: 'text-zinc-300',
  small5: 'text-amber-400',
  medium10: 'text-violet-400',
  bigger20: 'text-rose-400',
  whale40: 'text-indigo-400',
  mega25: 'text-yellow-400',
}

const SLOT_CLASS = {
  panel: 'h-[1.1875rem] w-[1.125rem] sm:h-[1.375rem] sm:w-[1.125rem]',
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
  const tone = BUNDLE_TONE[bundleId] ?? BUNDLE_TONE.single
  const slot = SLOT_CLASS[variant] ?? SLOT_CLASS.panel
  const icon = ICON_CLASS[variant] ?? ICON_CLASS.panel
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${tone} ${slot} ${className}`}
      aria-hidden
    >
      <Icon className={icon} strokeWidth={2} absoluteStrokeWidth />
    </span>
  )
}
