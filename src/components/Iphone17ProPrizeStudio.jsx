import iphone17ProPrize from '../assets/iphone-17-pro-prize.png'
import {
  IPHONE_17_PRO_COMPETITION_LABEL,
  IPHONE_17_PRO_PRIZE_LINE,
  IPHONE_17_PRO_RETAIL_LABEL,
} from '../../shared/iphone17ProCompetition.mjs'

/** Public card imagery for the iPhone 17 Pro or Cash main draw. */
export function Iphone17ProPrizeStudio({ compact = false }) {
  const photoClass = compact
    ? 'ss-iphone17-pro-prize-studio__photo ss-iphone17-pro-prize-studio__photo--compact'
    : 'ss-iphone17-pro-prize-studio__photo'
  const captionClass = compact
    ? 'ss-iphone17-pro-prize-studio__caption ss-iphone17-pro-prize-studio__caption--compact'
    : 'ss-iphone17-pro-prize-studio__caption'

  return (
    <div className="ss-iphone17-pro-prize-studio">
      <div className={`${photoClass} mx-auto rounded-md bg-black`}>
        <img
          src={iphone17ProPrize}
          alt="iPhone 17 Pro or Cash prize — product photo."
          width={290}
          height={430}
          loading="lazy"
          decoding="async"
          className="ss-iphone17-pro-prize-studio__img"
        />
      </div>
      <div className={`${captionClass} mt-3`}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300/90">Main prize</p>
        <p className="mt-1 text-base font-semibold leading-snug text-white md:text-sm">
          {IPHONE_17_PRO_COMPETITION_LABEL}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-stone-400 md:text-xs">
          UK retail from {IPHONE_17_PRO_RETAIL_LABEL}. {IPHONE_17_PRO_PRIZE_LINE}
        </p>
      </div>
    </div>
  )
}
