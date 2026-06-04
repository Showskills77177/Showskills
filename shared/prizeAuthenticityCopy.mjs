import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'

/** Plain-text prize authenticity notice — Terms, Privacy, FAQs. */
export const PRIZE_AUTHENTICITY_INTRO =
  'At ShowSkills Rewards, we take the authenticity of our prizes very seriously.'

export const PRIZE_AUTHENTICITY_MARKET =
  'All prizes featured in our competitions are genuine items purchased by us on the open secondary market (primarily through reputable platforms such as eBay and specialist memorabilia dealers).'

export const PRIZE_AUTHENTICITY_LEGACY_ITEMS = [
  'The signed Cristiano Ronaldo shirt comes with a Certificate of Authenticity.',
  'The signed museum golden ball is an officially licensed collectible with supporting documentation.',
  'The iPhone 17 Pro Max and luxury gold case are brand new, sealed, and sourced through authorised channels.',
]

export const PRIZE_AUTHENTICITY_AFFILIATION =
  'We do not claim any official partnership, sponsorship, or affiliation with Cristiano Ronaldo, CR7, Manchester United Football Club, or Apple Inc. These are independently acquired rare collectibles that are legally owned by us and can be freely given away as competition prizes.'

export const PRIZE_AUTHENTICITY_VERIFICATION =
  'Every item is thoroughly verified before being offered as a prize. We retain all original documentation and purchase records.'

export const PRIZE_AUTHENTICITY_TRANSPARENCY = `Transparency is important to us. If you have any questions about the authenticity of a specific prize, please contact us at ${SHOWSKILLS_CONTACT_EMAIL} and we will be happy to provide additional information.`

/** Single block for FAQ answers. */
export const PRIZE_AUTHENTICITY_FAQ_ANSWER = [
  PRIZE_AUTHENTICITY_INTRO,
  PRIZE_AUTHENTICITY_MARKET,
  'For the Signed Football Legend Bundle:',
  ...PRIZE_AUTHENTICITY_LEGACY_ITEMS.map((item) => `• ${item}`),
  PRIZE_AUTHENTICITY_AFFILIATION,
  PRIZE_AUTHENTICITY_VERIFICATION,
  PRIZE_AUTHENTICITY_TRANSPARENCY,
].join(' ')
