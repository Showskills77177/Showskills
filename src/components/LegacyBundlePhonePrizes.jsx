import iphone17ProMax from '../assets/iphone-17-pro-max-silver.png'
import { GoldCasePrizePhoto } from './GoldCasePrizePhoto'

/** Built-in iPhone + gold case tiles for the Ronaldo Legacy Bundle (bundled assets, not admin uploads). */
export function LegacyBundlePhonePrizes({ compact = false }) {
  const photoMax = compact ? 'max-w-[7rem]' : 'max-w-[7.5rem]'
  return (
    <div className="ss-prize-studio-subgrid mx-auto grid w-full max-w-[20rem] grid-cols-2 gap-2 sm:gap-0">
      <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
        <div className={`ss-prize-studio-photo mx-auto ${photoMax} rounded-md`}>
          <img
            src={iphone17ProMax}
            alt="iPhone 17 Pro Max prize photo."
            width={768}
            height={1024}
            loading="lazy"
            decoding="async"
            className="aspect-[3/4] h-auto w-full object-cover object-center"
          />
        </div>
        <p className="ss-phone-prize-glow mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em]">Phone prize</p>
        <p className="mt-0.5 text-sm font-semibold text-stone-100">iPhone 17 Pro Max</p>
      </div>
      <div className="ss-prize-studio-tile px-1 pb-0.5 text-center sm:px-1.5">
        <div className={`ss-prize-studio-photo mx-auto ${photoMax} rounded-md`}>
          <GoldCasePrizePhoto />
        </div>
        <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.21em] text-amber-300/90">Case prize</p>
        <p className="mt-0.5 text-sm font-semibold text-stone-100">24K gold case</p>
      </div>
    </div>
  )
}
