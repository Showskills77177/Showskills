import { ChevronDown } from 'lucide-react'
import { COMPETITION_NAME_POSTAL, POSTAL_ENTRY_ADDRESS, formatBundlePriceGBP } from '../competitionData'
import { LEGACY_SKILL_ONE_ATTEMPT_NOTICE } from '../../shared/consolationShirtGiveaway.mjs'
import { legacyEntryMethods } from '../../shared/competitionEntryMethods.mjs'
import { ConsolationTermsLink } from './ConsolationTermsLink'
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
  visibleTicketBundles,
  entryMethods = legacyEntryMethods(),
  postalCompetitionName = COMPETITION_NAME_POSTAL,
  competitionTitle = 'this prize draw',
  onOpenTerms,
}) {
  const methods = entryMethods || legacyEntryMethods()
  const postalName = postalCompetitionName || COMPETITION_NAME_POSTAL
  const showPaid = methods.allowPaidEntry !== false
  const showFreeOnline = Boolean(methods.allowFreeOnline)
  const showPostal = Boolean(methods.allowPostalEntry)
  const bundles = showPaid && visibleTicketBundles?.length ? visibleTicketBundles : []
  const selectValue =
    paidEntryRoute === 'postal' ? 'postal' : paidEntryRoute === 'free_online' ? 'free_online' : paidBundleId

  const routeHeading =
    [showPaid && 'Pay for tickets', showFreeOnline && 'enter free online', showPostal && 'enter by post']
      .filter(Boolean)
      .join(' or ') || 'Choose how to enter'

  return (
    <div>
      <p className="text-sm font-medium text-stone-300">{routeHeading}</p>

      <div className="mt-2 max-md:block md:hidden">
        <label htmlFor="ticket-bundle-select" className="mb-1.5 flex items-center justify-between text-xs text-stone-500">
          <span>Entry route</span>
          <span className="text-[10px] uppercase tracking-wide text-teal-400/90">Tap to choose</span>
        </label>
        <div className="relative">
          <select
            id="ticket-bundle-select"
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'postal') {
                setPaidEntryRoute('postal')
                return
              }
              if (v === 'free_online') {
                setPaidEntryRoute('free_online')
                return
              }
              setPaidEntryRoute('tickets')
              setPaidBundleId(v)
            }}
            className="ss-bundle-select w-full min-h-[52px] cursor-pointer appearance-none rounded-xl border border-teal-500/35 bg-gradient-to-b from-stone-900/90 to-black/80 py-3.5 pl-4 pr-12 text-base font-medium text-stone-100 shadow-inner focus:border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-900/50"
          >
            {showPaid ? (
              <optgroup label="Pay online">
                {bundles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} — {formatBundlePriceGBP(b.totalPence)} ({b.qty} ticket{b.qty === 1 ? '' : 's'})
                  </option>
                ))}
              </optgroup>
            ) : null}
            {showFreeOnline ? <option value="free_online">Free online entry (card verify, £0)</option> : null}
            {showPostal ? <option value="postal">Free postal entry (same draw)</option> : null}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-300/90"
            aria-hidden
          />
        </div>
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
        {paidEntryRoute === 'free_online' ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Verify your card online (£0, no charge), then answer three skill questions — same {competitionTitle} prize
              pool as paid tickets. {LEGACY_SKILL_ONE_ATTEMPT_NOTICE}
            </p>
            {onOpenTerms ? <ConsolationTermsLink onOpenTerms={onOpenTerms} className="mt-1.5" /> : null}
          </>
        ) : null}
        {paidEntryRoute === 'tickets' ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">{LEGACY_SKILL_ONE_ATTEMPT_NOTICE}</p>
            {onOpenTerms ? <ConsolationTermsLink onOpenTerms={onOpenTerms} className="mt-1.5" /> : null}
          </>
        ) : null}
        {paidEntryRoute === 'postal' ? (
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            No payment online. Post your details and three skill answers for{' '}
            <span className="text-stone-400">{postalName}</span> to{' '}
            <span className="text-stone-400">{POSTAL_ENTRY_ADDRESS}</span>.
          </p>
        ) : null}
      </div>

      <div className="mt-2 hidden max-h-[min(52vh,22rem)] gap-2 overflow-y-auto pr-1 md:grid lg:max-h-[14rem] lg:overflow-y-auto xl:max-h-none">
        {showPaid
          ? bundles.map((b) => (
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
            ))
          : null}
        {showFreeOnline ? (
          <label
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
              paidEntryRoute === 'free_online'
                ? 'border-teal-400/45 bg-teal-950/30 ring-1 ring-teal-500/20'
                : 'border-white/10 bg-black/20 hover:border-white/18'
            }`}
          >
            <input
              type="radio"
              name="legacy-draw-entry"
              value="free_online"
              checked={paidEntryRoute === 'free_online'}
              onChange={() => setPaidEntryRoute('free_online')}
              className="mt-1 h-4 w-4 shrink-0 border-white/20 bg-black/40 text-teal-500 focus:ring-teal-600/50"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base" aria-hidden>
                  🎟️
                </span>
                <span className="font-semibold text-stone-100">Free online entry</span>
                <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200/90">
                  £0 card verify
                </span>
              </div>
              <p className="mt-0.5 text-sm text-stone-400">
                Same draw as paid tickets. Verify your card (£0 authorisation, no charge), then answer three skill
                questions online. {LEGACY_SKILL_ONE_ATTEMPT_NOTICE}
              </p>
              {onOpenTerms ? (
                <ConsolationTermsLink onOpenTerms={onOpenTerms} className="mt-2 text-xs text-stone-500" />
              ) : null}
            </div>
          </label>
        ) : null}
        {showPostal ? (
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
                No payment. Post your details and the three written skill answers — same {competitionTitle} prize pool
                as paid tickets. One postal entry per person. Post to{' '}
                <span className="text-stone-300">{POSTAL_ENTRY_ADDRESS}</span>.
              </p>
            </div>
          </label>
        ) : null}
      </div>
    </div>
  )
}
