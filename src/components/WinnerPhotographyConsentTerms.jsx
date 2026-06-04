import {
  WINNER_PHOTOGRAPHY_CONSENT_INTRO,
  WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_HEADING,
  WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS,
  WINNER_PHOTOGRAPHY_CONSENT_PURPOSE,
  WINNER_PHOTOGRAPHY_CONSENT_REQUESTS,
  WINNER_PHOTOGRAPHY_CONSENT_TITLE,
  WINNER_PHOTOGRAPHY_VALID_REFUSAL_HEADING,
  WINNER_PHOTOGRAPHY_VALID_REFUSAL_INTRO,
  WINNER_PHOTOGRAPHY_VALID_REFUSAL_REASONS,
} from '../../shared/winnerPhotographyConsent.mjs'

/**
 * Winner photography & promotional consent — shared block for Terms and Privacy.
 * @param {{ id?: string, headingLevel?: 'h3' | 'h4', showTitle?: boolean }} props
 */
export function WinnerPhotographyConsentTerms({
  id = 'ss-winner-photography-consent',
  headingLevel = 'h3',
  showTitle = true,
}) {
  const Heading = headingLevel
  return (
    <div id={id} className="scroll-mt-4">
      {showTitle ? (
        <Heading className="mb-2 mt-6 font-semibold text-stone-200">{WINNER_PHOTOGRAPHY_CONSENT_TITLE}</Heading>
      ) : null}
      <p className="mb-2 text-zinc-300">{WINNER_PHOTOGRAPHY_CONSENT_INTRO}</p>
      <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-300">
        {WINNER_PHOTOGRAPHY_CONSENT_REQUESTS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mb-3 text-zinc-300">{WINNER_PHOTOGRAPHY_CONSENT_PURPOSE}</p>
      <p className="mb-2 font-semibold text-stone-200">{WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_HEADING}:</p>
      <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-300">
        {WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mb-2 font-semibold text-stone-200">{WINNER_PHOTOGRAPHY_VALID_REFUSAL_HEADING}</p>
      <p className="mb-2 text-zinc-300">{WINNER_PHOTOGRAPHY_VALID_REFUSAL_INTRO}</p>
      <ul className="mb-3 list-inside list-disc space-y-1 text-zinc-300">
        {WINNER_PHOTOGRAPHY_VALID_REFUSAL_REASONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
