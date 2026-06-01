function formatWinnerDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * @param {{ title?: string, subtitle?: string, winners?: Array<{ name: string, prize: string, drawnAt?: string }>, loading?: boolean }} props
 */
export function HomeWinnersPanel({ title = 'Recent winners', subtitle = '', winners = [], loading = false }) {
  if (loading) {
    return (
      <section className="ss-home-winners border-t border-white/10 bg-black/20 px-4 py-10 sm:px-6">
        <p className="text-center text-sm text-stone-500">Loading winners…</p>
      </section>
    )
  }

  if (!winners.length) return null

  return (
    <section className="ss-home-winners border-t border-emerald-900/25 bg-gradient-to-b from-black/30 to-transparent px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-white sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-stone-400 sm:text-base">{subtitle}</p> : null}
        <ul className="mt-6 grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {winners.map((w, index) => (
            <li
              key={`${w.name}-${w.prize}-${index}`}
              className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">Winner</p>
              <p className="mt-1 font-display text-lg text-white">{w.name}</p>
              <p className="mt-1 text-sm text-stone-400">{w.prize}</p>
              {formatWinnerDate(w.drawnAt) ? (
                <p className="mt-2 text-[11px] text-stone-600">{formatWinnerDate(w.drawnAt)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
