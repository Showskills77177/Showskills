export const SHIRT_GIVEAWAY_QUESTION =
  'Which Ronaldo is the one from Manchester United: Ronaldo R9 or Cristiano Ronaldo?'

/** Manchester United home shirt season for the free signed shirt prize. */
export const SHIRT_GIVEAWAY_SEASON = '2022/23'
export const SHIRT_GIVEAWAY_SEASON_LABEL = '2022/23 season'

export const SHIRT_GIVEAWAY_PRIZE_TITLE = `Signed Ronaldo United shirt (${SHIRT_GIVEAWAY_SEASON_LABEL})`

export const SHIRT_GIVEAWAY_DETAILS_PATH = '/archive/ronaldo-shirt-giveaway'
export const SHIRT_GIVEAWAY_HOW_TO_HASH = '#how-to-enter'

/** Rewrites legacy 2021–22 copy saved in the page editor to the current shirt season. */
export function refreshShirtGiveawaySeasonInText(text) {
  if (typeof text !== 'string' || !text) return text
  return text
    .replace(/2021[\u2013\-/]22 season/gi, SHIRT_GIVEAWAY_SEASON_LABEL)
    .replace(/2021[\u2013\-/]22/gi, SHIRT_GIVEAWAY_SEASON)
}

export function isCorrectShirtGiveawayAnswer(answer) {
  const normalized = String(answer || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  return (
    normalized === 'r9' ||
    normalized === 'cr7' ||
    normalized === 'ronaldo r9' ||
    normalized === 'r9 ronaldo' ||
    normalized === 'ronaldo nazario' ||
    normalized.includes('ronaldo r9') ||
    normalized.includes('cristiano ronaldo') ||
    (normalized.includes('cristiano') && normalized.includes('ronaldo')) ||
    (normalized.includes('r9') && normalized.includes('ronaldo'))
  )
}

