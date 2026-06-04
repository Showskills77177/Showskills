import { SHOWSKILLS_CONTACT_EMAIL } from '../../shared/siteContact.mjs'

/** Prize authenticity — Terms, Privacy, and cross-linked from FAQs. */
export function PrizeAuthenticityNotice({ headingLevel = 'h3', id = 'ss-prize-authenticity', showHeading = true }) {
  const Heading = headingLevel

  return (
    <section id={id} className="scroll-mt-4">
      {showHeading ? (
        <Heading className="mb-3 font-semibold text-stone-200">Prize authenticity</Heading>
      ) : null}

      <p className="mb-3">
        At <strong>ShowSkills Rewards</strong>, we take the authenticity of our prizes{' '}
        <strong>very seriously</strong>.
      </p>

      <p className="mb-3 rounded-lg border border-stone-700/50 bg-stone-900/40 px-3 py-2.5 text-zinc-200">
        All prizes featured in our competitions are <strong>genuine items purchased by us on the open secondary market</strong>{' '}
        (primarily through reputable platforms such as <strong>eBay</strong> and{' '}
        <strong>specialist memorabilia dealers</strong>).
      </p>

      <p className="mb-2 font-medium text-stone-300">For the Signed Football Legend Bundle:</p>
      <ul className="mb-3 list-inside list-disc space-y-1.5 text-zinc-300">
        <li>
          The signed Cristiano Ronaldo shirt comes with a <strong>Certificate of Authenticity</strong>.
        </li>
        <li>
          The signed museum golden ball is an <strong>officially licensed collectible</strong> with supporting
          documentation.
        </li>
        <li>
          The iPhone 17 Pro Max and luxury gold case are <strong>brand new, sealed</strong>, and sourced through{' '}
          <strong>authorised channels</strong>.
        </li>
      </ul>

      <p className="mb-3">
        We <strong>do not claim any official partnership, sponsorship, or affiliation</strong> with Cristiano Ronaldo,
        CR7, Manchester United Football Club, or Apple Inc. These are{' '}
        <strong>independently acquired rare collectibles</strong> that are legally owned by us and can be freely given
        away as competition prizes.
      </p>

      <p className="mb-3">
        Every item is <strong>thoroughly verified</strong> before being offered as a prize. We retain all{' '}
        <strong>original documentation and purchase records</strong>.
      </p>

      <p className="mb-3 rounded-lg border border-emerald-900/35 bg-emerald-950/25 px-3 py-2.5 text-zinc-200">
        <strong>Transparency</strong> is important to us. If you have any questions about the authenticity of a specific
        prize, please contact us at{' '}
        <a
          href={`mailto:${SHOWSKILLS_CONTACT_EMAIL}`}
          className="font-medium text-teal-400 underline decoration-teal-600/50 underline-offset-2 hover:text-teal-300"
        >
          {SHOWSKILLS_CONTACT_EMAIL}
        </a>{' '}
        and we will be happy to provide additional information.
      </p>
    </section>
  )
}
