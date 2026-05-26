import { PROMOTER_ADDRESS_LINES } from '../competitionData'

/** Promoter postal address — always sourced from shared/competitionCopy.mjs */
export function PromoterAddress({ className = 'text-stone-400', lineClassName = '' }) {
  return (
    <address className={`not-italic ${className}`}>
      {PROMOTER_ADDRESS_LINES.map((line) => (
        <span key={line} className={`block ${lineClassName}`}>
          {line}
        </span>
      ))}
    </address>
  )
}
