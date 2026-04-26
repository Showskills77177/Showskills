export const SHIRT_GIVEAWAY_QUESTION =
  'Which Ronaldo is the one from Manchester United: Ronaldo R9 or Cristiano Ronaldo?'

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

