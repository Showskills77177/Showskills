import competitionsPageBg from '../assets/competitions-page-bg.png'

/** Blurred pitch photo + green scrim (Competitions, FAQ, etc.). */
export function PhotoPageBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src={competitionsPageBg}
        alt=""
        width={1600}
        height={1067}
        decoding="async"
        className="ss-photo-page-bg-img"
      />
      <div className="ss-photo-page-tint absolute inset-0" />
      <div className="ss-photo-page-scrim absolute inset-0" />
    </div>
  )
}
