/**
 * Shared photorealistic press-photo prompt for EOF image generators.
 * Kept separate so Grok / free clients do not circular-import orchestration.
 */
export function buildEofImageGenPrompt(opts = {}) {
  const subject = String(opts.subject || '').trim() || 'Premier League footballer'
  const intent = String(opts.intent || 'neutral').toLowerCase()
  const topic = String(opts.topic || '').trim()

  let roleLine =
    'recent editorial press photograph, natural expression, clear face, chest-up portrait'
  if (intent === 'pundit') {
    roleLine =
      'TV studio pundit appearance, suit or smart shirt, desk or broadcast lighting, recent years'
  } else if (intent === 'playing') {
    roleLine = 'match-day action or celebration in club kit, pitch side, athletic motion, sharp face'
  } else if (intent === 'coach') {
    roleLine = 'sideline manager / press conference, tracksuit or coat, serious expression'
  }

  const topicHint = topic && topic.toLowerCase() !== subject.toLowerCase() ? ` Context: ${topic}.` : ''

  return [
    `Photorealistic sports press photograph of ${subject},`,
    roleLine + '.',
    'Vertical 9:16 portrait crop suitable for Instagram/YouTube Shorts,',
    'editorial sports photography, natural skin texture, realistic lighting,',
    'no text, no captions, no watermarks, no logos, no collage, no illustration, no CGI.',
    topicHint,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
