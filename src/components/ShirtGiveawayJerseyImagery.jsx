import { KICKUPS_GIVEAWAY_IMAGE } from '../competitionVisuals'
import { SHIRT_GIVEAWAY_SEASON_LABEL } from '../../shared/shirtGiveaway.mjs'

/**
 * Blurred sponsor / signature jersey — public site and timed preview use the same asset.
 * @param {{ size?: 'sm' | 'lg', className?: string, showNotice?: boolean }} props
 */
export function ShirtGiveawayJerseyImagery({ size = 'sm', className = '', showNotice = true }) {
  const isLarge = size === 'lg'
  return (
    <figure className={`ss-shirt-jersey-imagery ${className}`}>
      <div
        className={
          isLarge
            ? 'mx-auto max-w-md overflow-hidden rounded-xl border border-lime-400/35 bg-black shadow-inner'
            : 'overflow-hidden rounded-lg border border-lime-400/30 bg-black/60'
        }
      >
        <img
          src={KICKUPS_GIVEAWAY_IMAGE}
          alt={`Signed Cristiano Ronaldo Manchester United number 7 shirt, ${SHIRT_GIVEAWAY_SEASON_LABEL} — sponsor marks blurred.`}
          width={771}
          height={1024}
          className={`h-auto w-full object-cover object-top ${isLarge ? '' : 'max-h-48'}`}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
      {showNotice ? (
        <figcaption className="mt-2 text-center text-[11px] leading-relaxed text-stone-500">
          Sponsor, Premier League, and signature marks are blurred on the site and in your confirmation email preview.
        </figcaption>
      ) : null}
    </figure>
  )
}
