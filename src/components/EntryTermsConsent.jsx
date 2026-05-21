/**
 * Terms + privacy consent — stacked layout on narrow screens to avoid overlap with Pay buttons.
 */
export function EntryTermsConsent({ checked, onChange, onOpenTerms, variant = 'teal' }) {
  const linkClass =
    variant === 'emerald'
      ? 'font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300'
      : 'font-medium text-teal-400 underline underline-offset-2 hover:text-teal-300'

  return (
    <div className="ss-entry-consent-box rounded-xl border border-white/10 bg-black/30 px-3.5 py-3.5 sm:px-4 sm:py-4">
      <label className="ss-entry-consent-label flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-black/40 text-teal-500 focus:ring-teal-600/50"
        />
        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-stone-300 sm:text-sm">
          <span className="block text-stone-400">I agree to the:</span>
          <span className="mt-2 flex flex-col items-start gap-1.5 sm:mt-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-1">
            <button type="button" className={`${linkClass} text-left`} onClick={onOpenTerms}>
              Terms &amp; Conditions
            </button>
            <span className="text-stone-500 sm:px-0.5">and</span>
            <button type="button" className={`${linkClass} text-left`} onClick={onOpenTerms}>
              Privacy Policy
            </button>
          </span>
        </span>
      </label>
    </div>
  )
}
