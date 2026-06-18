import { WORLD_CUP_BALL_PRIZE_IMAGE } from '../competitionVisuals'
import { WORLD_CUP_BALL_PRIZE_IMAGE_ALT } from '../../shared/worldCupBallGiveaway.mjs'

/**
 * Prize photo for the World Cup Ball Giveaway — rules page, cards, homepage panel.
 * @param {{ className?: string, imgClassName?: string, fit?: 'contain' | 'cover', scale?: 'sm' | 'md' | 'lg' }} props
 */
export function WorldCupBallPrizeImage({
  className = '',
  imgClassName = '',
  fit = 'contain',
  scale = 'md',
}) {
  const scaleClass =
    scale === 'sm'
      ? 'max-h-[62%] max-w-[62%]'
      : scale === 'lg'
        ? 'max-h-[88%] max-w-[88%]'
        : 'max-h-[72%] max-w-[72%]'

  const imgBase =
    fit === 'cover'
      ? 'h-full w-full object-cover object-center'
      : `${scaleClass} object-contain object-center`

  return (
    <div
      className={`ss-world-cup-ball-prize-image flex items-center justify-center overflow-hidden rounded-xl ${className}`}
    >
      <img
        src={WORLD_CUP_BALL_PRIZE_IMAGE}
        alt={WORLD_CUP_BALL_PRIZE_IMAGE_ALT}
        width={1024}
        height={1024}
        loading="lazy"
        decoding="async"
        className={`ss-world-cup-ball-prize-image__img rounded-xl brightness-[1.14] contrast-[1.03] ${imgBase} ${imgClassName}`}
      />
    </div>
  )
}
