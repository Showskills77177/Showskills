import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'

/** iPhone 17 Pro Max prize tile — top trimmed via object-position, sized to match the gold case tile. */
export function IphonePrizePhoto({
  loading = 'lazy',
  decoding = 'async',
  className = '',
}) {
  return (
    <img
      src={iphone17ProMax}
      alt="iPhone 17 Pro Max prize photo."
      width={768}
      height={1024}
      loading={loading}
      decoding={decoding}
      className={`ss-phone-prize-photo__img ${className}`.trim()}
    />
  )
}
