/**
 * Legal disclaimer & IP notice — shown in Terms & privacy (Signed Football Legend Bundle and site-wide).
 */
export function LegalDisclaimerNotice({ headingLevel = 'h3', id = 'ss-legal-disclaimer' }) {
  const Heading = headingLevel

  return (
    <section id={id} className="scroll-mt-4">
      <Heading className="mb-3 font-semibold text-stone-200">
        Legal disclaimer &amp; intellectual property notice
      </Heading>

      <p className="mb-3 rounded-lg border border-stone-700/50 bg-stone-900/40 px-3 py-2.5 text-zinc-200">
        <strong>ShowSkills Rewards</strong> is an{' '}
        <strong>independent skill-based prize competition platform</strong>. It is{' '}
        <strong>
          not affiliated with, endorsed by, sponsored by, or in any way officially connected to Cristiano Ronaldo, CR7,
          Manchester United Football Club, or Apple Inc.
        </strong>
      </p>

      <p className="mb-3">
        All prizes featured are <strong>genuine, legally purchased rare collectibles</strong> acquired on the{' '}
        <strong>open market</strong>. These items can be <strong>freely bought, owned, resold, or given away</strong>.
      </p>

      <h4 className="mb-2 mt-5 font-semibold text-stone-200">Image usage &amp; AI generation</h4>
      <p className="mb-3">
        Some images on this website are <strong>AI-generated or heavily edited for illustrative purposes only</strong>.
        Where necessary, names, logos, brands, and original imagery have been{' '}
        <strong>purposely blurred, modified, or replaced</strong> to strictly avoid any potential{' '}
        <strong>infringement of image rights, trademarks, or copyright</strong>. We{' '}
        <strong>do not use official promotional imagery</strong> belonging to the above parties for marketing or
        promotional advantage.
      </p>

      <p className="mb-3 rounded-lg border border-emerald-900/35 bg-emerald-950/25 px-3 py-2.5 text-zinc-200">
        This platform operates in <strong>full compliance with applicable laws</strong> and{' '}
        <strong>
          does not claim any licensing, partnership, or official relationship with Cristiano Ronaldo, CR7, Manchester
          United, or Apple
        </strong>
        .
      </p>
    </section>
  )
}
