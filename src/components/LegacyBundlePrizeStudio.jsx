import legacyBundlePoster from '../assets/legacy-bundle-poster.png'
import { LegacyBundleImageryCaption } from './LegacyBundleImageryCaption'
import { LegacyBundlePosterTitle } from './LegacyBundlePosterTitle'
import { LegacyBundlePhonePrizes } from './LegacyBundlePhonePrizes'

/**
 * Bundle prize imagery — same poster, stamp, phone, and gold case as the homepage / competition card.
 * @param {{ hero?: boolean, eager?: boolean, className?: string }} props
 */
export function LegacyBundlePrizeStudio({ hero = true, eager = false, className = '' }) {
  const imgLoading = eager ? 'eager' : 'lazy'
  return (
    <div
      className={`ss-prize-studio p-2 sm:p-3 ${hero ? 'ss-prize-studio--hero max-w-2xl' : 'max-w-xl'} ${className}`.trim()}
    >
      <div className="relative z-[1] grid gap-2">
        <div className="ss-prize-studio-tile ss-prize-studio-tile--main text-center">
          <div className="ss-prize-studio-photo overflow-hidden">
            <img
              src={legacyBundlePoster}
              alt="Signed Legacy Bundle: signed shirt, signed ball and gold phone case in a luxury poster layout."
              width={1024}
              height={576}
              loading={imgLoading}
              decoding="async"
              className="h-auto w-full"
              draggable={false}
            />
            <LegacyBundlePosterTitle />
            <LegacyBundleImageryCaption />
          </div>
        </div>
        <LegacyBundlePhonePrizes compact={!hero} eager={eager} />
      </div>
    </div>
  )
}
