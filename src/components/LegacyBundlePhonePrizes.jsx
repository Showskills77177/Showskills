import { GoldCasePrizePhoto } from './GoldCasePrizePhoto'
import { IphonePrizePhoto } from './IphonePrizePhoto'

/** Built-in iPhone + gold case tiles for the Signed Legacy Bundle (bundled assets, not admin uploads). */
export function LegacyBundlePhonePrizes({ compact = false, eager = false }) {
  const photoClass = compact ? 'ss-prize-tile-photo ss-prize-tile-photo--compact' : 'ss-prize-tile-photo'
  const captionClass = compact ? 'ss-prize-tile-caption ss-prize-tile-caption--compact' : 'ss-prize-tile-caption'
  const imgLoading = eager ? 'eager' : 'lazy'

  return (
    <div className="ss-prize-studio-subgrid mx-auto grid w-full max-w-[20rem] grid-cols-2 gap-2 sm:gap-0">
      <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
        <div className={`${photoClass} rounded-md`}>
          <IphonePrizePhoto loading={imgLoading} />
        </div>
        <div className={captionClass}>
          <p className="ss-phone-prize-glow mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em]">Phone prize</p>
          <p className="mt-0.5 text-sm font-semibold text-stone-100">iPhone 17 Pro Max</p>
        </div>
      </div>
      <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
        <div className={`${photoClass} rounded-md`}>
          <GoldCasePrizePhoto loading={imgLoading} />
        </div>
        <div className={captionClass}>
          <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em] text-amber-300/90">Case prize</p>
          <p className="mt-0.5 text-sm font-semibold text-stone-100">24K gold case</p>
        </div>
      </div>
    </div>
  )
}
