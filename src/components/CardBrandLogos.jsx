/**
 * Card scheme marks — SVGs from activemerchant/payment_icons (Shopify payment icon set).
 * @see public/payment-brands/README.md
 */

const BRANDS = [
  { title: 'Visa', src: '/payment-brands/visa.svg', variant: 'visa' },
  { title: 'Mastercard', src: '/payment-brands/mastercard.svg', variant: 'mc' },
  { title: 'American Express', src: '/payment-brands/american-express.svg', variant: 'amex' },
  { title: 'Maestro', src: '/payment-brands/maestro.svg', variant: 'maestro' },
]

function BrandMark({ title, src, variant }) {
  return (
    <span className={`ss-card-brand ss-card-brand--${variant}`} title={title}>
      <img
        className="ss-card-brand-img"
        src={src}
        alt=""
        width={38}
        height={24}
        loading="lazy"
        decoding="async"
      />
      <span className="sr-only">{title}</span>
    </span>
  )
}

export function CardBrandLogos({ className = '' }) {
  return (
    <div
      className={`ss-card-brands flex flex-wrap items-center justify-end gap-1.5 ${className}`.trim()}
      aria-label="We accept Visa, Mastercard, American Express, and Maestro"
    >
      {BRANDS.map((b) => (
        <BrandMark key={b.variant} {...b} />
      ))}
    </div>
  )
}
