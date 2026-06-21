import { formatWorldCupBallMonthlyDrawAwardMessage } from '../../shared/worldCupBallMonthlyDraw.mjs'

/**
 * Shown after a failed World Cup Ball skill attempt when a monthly draw entry was awarded.
 * @param {{ monthlyDraw?: { entryNumbers?: string[], drawMonthLabel?: string, drawMonth?: string } | null, className?: string }} props
 */
export function WorldCupBallMonthlyDrawEntryCallout({ monthlyDraw, className = '' }) {
  if (!monthlyDraw?.entryNumbers?.length) return null

  const entryNumber = monthlyDraw.entryNumbers[0]
  const message = formatWorldCupBallMonthlyDrawAwardMessage({
    entryNumber,
    drawMonthLabel: monthlyDraw.drawMonthLabel,
    drawMonth: monthlyDraw.drawMonth,
  })

  if (!message) return null

  return (
    <div
      className={`mt-4 rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/45 via-stone-950/80 to-stone-950/90 px-4 py-4 ${className}`.trim()}
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/95">Free monthly draw entry</p>
      <p className="mt-2 text-sm leading-relaxed text-amber-50/90">{message}</p>
      <p className="mt-3 rounded-lg border border-amber-400/25 bg-black/30 px-3 py-2 text-center font-mono text-sm font-semibold tracking-wide text-amber-100">
        {entryNumber}
      </p>
    </div>
  )
}
