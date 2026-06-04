/**
 * Short checkout copy — full consolation rules live in Terms & Conditions §2a.
 */
export function ConsolationTermsLink({ onOpenTerms, className = 'text-xs leading-relaxed text-stone-500' }) {
  const linkClass =
    'font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300'

  return (
    <p className={className}>
      For how wrong skill answers may affect the separate Free Ronaldo Shirt Giveaway (consolation prize), see{' '}
      <button type="button" onClick={onOpenTerms} className={linkClass}>
        Terms &amp; Conditions — consolation prize
      </button>
      .
    </p>
  )
}
