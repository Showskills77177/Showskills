import {
  formatBundlePriceGBP,
  getStandardCompetitionBundleTemplates,
  perTicketPence,
} from '../../../shared/ticketBundles.mjs'

const INPUT =
  'w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-stone-100'

export function emptyBundleRow() {
  return {
    bundleKey: '',
    title: '',
    qty: 1,
    totalPence: 75,
    line1: '',
    line2: '',
    featured: false,
    active: true,
  }
}

export function standardBundleRows() {
  return getStandardCompetitionBundleTemplates().map((b) => ({ ...b }))
}

function penceToGbpInput(pence) {
  return (Math.max(0, Number(pence) || 0) / 100).toFixed(2)
}

function gbpInputToPence(value) {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

/**
 * @param {{
 *   bundles: Array<ReturnType<typeof emptyBundleRow>>,
 *   onChange: (bundles: Array<ReturnType<typeof emptyBundleRow>>) => void,
 *   compact?: boolean,
 *   competitionTitle?: string,
 * }} props
 */
export function CompetitionBundleEditor({ bundles, onChange, compact = false, competitionTitle = '' }) {
  function updateRow(index, patch) {
    onChange(bundles.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function updatePrice(index, gbpValue) {
    updateRow(index, { totalPence: gbpInputToPence(gbpValue) })
  }

  function removeRow(index) {
    onChange(bundles.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">
          Each bundle = ticket quantity + total price. Checkout shows these when the competition is published.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(standardBundleRows())}
            className="rounded border border-white/15 px-2 py-1 text-xs text-stone-400 hover:bg-white/5"
          >
            Reset to standard tiers
          </button>
          <button
            type="button"
            onClick={() => onChange([...bundles, emptyBundleRow()])}
            className="rounded border border-teal-500/35 px-2 py-1 text-xs text-teal-100 hover:bg-teal-950/40"
          >
            Add bundle
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-black/30 text-[10px] uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-2 py-2">Key</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Tickets</th>
              <th className="px-2 py-2">Price (£)</th>
              <th className="px-2 py-2">Per ticket</th>
              {!compact ? <th className="px-2 py-2">Checkout line</th> : null}
              <th className="px-2 py-2">Featured</th>
              <th className="px-2 py-2">Active</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-stone-300">
            {bundles.map((row, index) => (
              <tr key={`${row.bundleKey}-${index}`}>
                <td className="px-2 py-2">
                  <input
                    required
                    value={row.bundleKey}
                    onChange={(e) => updateRow(index, { bundleKey: e.target.value })}
                    placeholder="medium10"
                    className={`${INPUT} font-mono text-xs`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    required
                    value={row.title}
                    onChange={(e) => updateRow(index, { title: e.target.value })}
                    placeholder="Medium bundle"
                    className={INPUT}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={1}
                    required
                    value={row.qty}
                    onChange={(e) => updateRow(index, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className={`${INPUT} w-20`}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={penceToGbpInput(row.totalPence)}
                    onChange={(e) => updatePrice(index, e.target.value)}
                    className={`${INPUT} w-24`}
                  />
                </td>
                <td className="px-2 py-2 text-xs text-stone-500">
                  {formatBundlePriceGBP(perTicketPence(row.totalPence, row.qty))}
                </td>
                {!compact ? (
                  <td className="px-2 py-2">
                    <input
                      value={row.line1}
                      onChange={(e) => updateRow(index, { line1: e.target.value })}
                      placeholder="Auto-generated if empty"
                      className={INPUT}
                    />
                  </td>
                ) : null}
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(row.featured)}
                    onChange={(e) => updateRow(index, { featured: e.target.checked })}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.active !== false}
                    onChange={(e) => updateRow(index, { active: e.target.checked })}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-xs text-red-300 hover:underline"
                    disabled={bundles.length <= 1}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bundles.length === 0 ? (
        <p className="text-xs text-amber-300">Add at least one bundle — customers need ticket options to enter.</p>
      ) : null}
    </div>
  )
}
