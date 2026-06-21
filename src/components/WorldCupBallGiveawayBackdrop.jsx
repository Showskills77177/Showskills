import stadiumBg from '../assets/world-cup-ball-stadium-bg.png'

/** Blurred 2026 host-nation stadium photo + gold pitch scrim for the giveaway rules page. */
export function WorldCupBallGiveawayBackdrop() {
  return (
    <div className="ss-wc-ball-giveaway-backdrop pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src={stadiumBg}
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        fetchPriority="high"
        className="ss-wc-ball-giveaway-backdrop__photo"
      />
      <div className="ss-wc-ball-giveaway-backdrop__tint absolute inset-0" />
      <div className="ss-wc-ball-giveaway-backdrop__scrim absolute inset-0" />
      <div className="ss-wc-ball-giveaway-backdrop__lights absolute inset-0" />
    </div>
  )
}
