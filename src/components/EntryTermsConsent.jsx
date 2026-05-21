/**
 * Terms + privacy consent — single flowing sentence beside the checkbox.
 */
export function EntryTermsConsent({ checked, onChange, onOpenTerms, variant = 'teal' }) {
  const linkClass =
    variant === 'emerald'
      ? 'font-medium text-emerald-400 underline decoration-emerald-600/50 underline-offset-2 hover:text-emerald-300'
      : 'font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300'

  return (
    <div className="ss-entry-consent-box rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 sm:px-4 sm:py-3.5">
      <label className="ss-entry-consent-label flex cursor-pointer items-start gap-2.5 sm:gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-teal-500 focus:ring-teal-600/50 sm:h-5 sm:w-5"
        />
        <span className="ss-entry-consent-text min-w-0 flex-1 text-[12px] leading-snug text-stone-300 sm:text-[13px]">
          I agree to the{' '}
          <button type="button" className={`${linkClass} inline`} onClick={onOpenTerms}>
            Terms &amp; Conditions
          </button>{' '}
          and{' '}
          <button type="button" className={`${linkClass} inline`} onClick={onOpenTerms}>
            Privacy Policy
          </button>
          .
        </span>
      </label>
    </div>
  )
}
