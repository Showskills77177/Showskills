import { COMPETITION_NAME_POSTAL, TICKET_BUNDLES, formatBundlePriceGBP } from '../competitionData'
import { TicketBundleIcon } from './TicketBundleIcon'

/**
 * Mobile: native picker (short). Desktop: full radio list.
 */
export function TicketBundlePicker({
  paidBundleId,
  setPaidBundleId,
  paidEntryRoute,
  setPaidEntryRoute,
  selectedTicketBundle,
}) {
  const selectValue = paidEntryRoute === 'postal' ? 'postal' : paidBundleId

  return (
    <div>
      <p className="text-sm font-medium text-stone-300">Pay for tickets or enter by post</p>

      <div className="mt-2 max-md:block md:hidden">
        <label htmlFor="ticket-bundle-select" className="sr-only">
          Choose ticket bundle or postal entry
        </label>
        <select
          id="ticket-bundle-select"
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'postal') {
              setPaidEntryRoute('postal')
              return
            }
            setPaidEntryRoute('tickets')
            setPaidBundleId(v)
          }}
          className="mt-1 w-full min-h-[48px] appearance-none rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-base text-stone-100 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
        >
          <optgroup label="Pay online">
            {TICKET_BUNDLES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} — {formatBundlePriceGBP(b.totalPence)} ({b.qty} ticket{b.qty === 1 ? '' : 's'})
              </option>
            ))}
          </optgroup>
          <option value="postal">Free postal entry (same draw)</option>
        </select>
        {paidEntryRoute === 'tickets' && selectedTicketBundle ? (
          <div className="mt-2 rounded-lg border border-teal-500/20 bg-teal-950/25 px-3 py-2">
            <div className="flex items-center gap-2">
              <TicketBundleIcon bundleId={selectedTicketBundle.id} variant="modal" />
              <p className="text-sm font-medium text-teal-100/95">{selectedTicketBundle.title}</p>
              <span className="ml-auto font-display text-base text-white tabular-nums">
                {formatBundlePriceGBP(selectedTicketBundle.totalPence)}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-400">{selectedTicketBundle.line1}</p>
            {selectedTicketBundle.bullets?.length ? (
              <p className="mt-1 text-xs text-stone-500">{selectedTicketBundle.bullets[0]}</p>
            ) : null}
          </div>
        ) : null}
        {paidEntryRoute === 'postal' ? (
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            No payment online. Post your details and three skill answers for{' '}
            <span className="text-stone-400">{COMPETITION_NAME_POSTAL}</span>.
          </p>
        ) : null}
      </div>

      <div className="mt-2 hidden max-h-[min(52vh,22rem)] gap-2 overflow-y-auto pr-1 md:grid lg:max-h-[14rem] lg:overflow-y-auto xl:max-h-none">
        {TICKET_BUNDLES.map((b) => (
          <label
            key={b.id}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
              paidEntryRoute === 'tickets' && paidBundleId === b.id
                ? 'border-teal-400/55 bg-teal-950/35 ring-1 ring-teal-500/25'
                : 'border-white/10 bg-black/20 hover:border-white/18'
            } ${b.featured ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.12)]' : ''}`}
          >
            <input
              type="radio"
              name="legacy-draw-entry"
              value={b.id}
              checked={paidEntryRoute === 'tickets' && paidBundleId === b.id}
              onChange={() => {
                setPaidEntryRoute('tickets')
                setPaidBundleId(b.id)
              }}
              className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-black/40 text-teal-500 focus:ring-teal-600/50"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <TicketBundleIcon bundleId={b.id} variant="modal" />
                <span className="font-semibold leading-none text-stone-100">{b.title}</span>
                {b.featured ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-teal-200/90">{b.line1}</p>
              {b.line2 ? <p className="text-xs text-stone-500">{b.line2}</p> : null}
              {b.bullets?.length ? (
                <ul className="mt-1.5 space-y-0.5 text-xs text-stone-400">
                  {b.bullets.map((t) => (
                    <li key={t}>✓ {t}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="shrink-0 self-start font-display text-lg leading-none text-white tabular-nums">
              {formatBundlePriceGBP(b.totalPence)}
            </div>
          </label>
        ))}
        <label
          className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
            paidEntryRoute === 'postal'
              ? 'border-stone-400/45 bg-stone-900/40 ring-1 ring-stone-500/20'
              : 'border-white/10 bg-black/20 hover:border-white/18'
          }`}
        >
          <input
            type="radio"
            name="legacy-draw-entry"
            value="postal"
            checked={paidEntryRoute === 'postal'}
            onChange={() => setPaidEntryRoute('postal')}
            className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-black/40 text-stone-400 focus:ring-stone-500/50"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base" aria-hidden>
                ✉️
              </span>
              <span className="font-semibold text-stone-100">Free postal entry</span>
              <span className="rounded-full bg-stone-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-300/90">
                Same draw
              </span>
            </div>
            <p className="mt-0.5 text-sm text-stone-400">
              No payment. Post your details and the three written skill answers — same Ronaldo Legacy Bundle
              prize pool as paid tickets. One postal entry per person.
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}
