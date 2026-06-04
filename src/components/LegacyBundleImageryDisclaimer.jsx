/** Small print under Signed Legacy Bundle prize imagery (homepage, cards, featured promo). */
export function LegacyBundleImageryDisclaimer({ className = '' }) {
  return (
    <p
      className={`mt-2 px-1 text-center text-[9px] leading-snug text-stone-600 sm:text-[10px] ${className}`.trim()}
    >
      *Rare collectibles purchased on the open market.
      <br />
      ShowSkills Rewards is an independent platform and is not affiliated with, endorsed by, or connected to Cristiano
      Ronaldo, CR7, Manchester United, or Apple Inc.
      <br />
      All images are for illustrative purposes only. Some are AI-generated or edited. We do not infringe any image rights
      or trademarks.
    </p>
  )
}
