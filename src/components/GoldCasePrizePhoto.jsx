import iphone17ProMaxGoldCase from '../assets/iphone-17-pro-max-gold-case.png'

/** Gold case prize tile — Apple mark blurred in the processed asset. */
export function GoldCasePrizePhoto({
  className = '',
  imgClassName = '',
  loading = 'lazy',
  decoding = 'async',
}) {
  return (
    <div className={`ss-gold-case-photo relative ${className}`.trim()}>
      <img
        src={iphone17ProMaxGoldCase}
        alt="24K gold case for iPhone 17 Pro Max prize photo."
        width={960}
        height={1024}
        loading={loading}
        decoding={decoding}
        className={`aspect-[3/4] h-auto w-full object-cover object-center ${imgClassName}`.trim()}
      />
    </div>
  )
}
