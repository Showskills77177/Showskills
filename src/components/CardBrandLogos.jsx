/** Debit/credit marks shown above Cashflows card fields (scheme logos, not payment buttons). */
export function CardBrandLogos({ className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`.trim()}
      aria-label="We accept Visa, Mastercard, American Express, and Maestro"
    >
      <span className="ss-card-brand ss-card-brand--visa" title="Visa">
        Visa
      </span>
      <span className="ss-card-brand ss-card-brand--mc" title="Mastercard">
        Mastercard
      </span>
      <span className="ss-card-brand ss-card-brand--amex" title="American Express">
        Amex
      </span>
      <span className="ss-card-brand ss-card-brand--maestro" title="Maestro / debit">
        Maestro
      </span>
    </div>
  )
}
