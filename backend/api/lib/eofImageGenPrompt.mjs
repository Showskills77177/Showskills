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

/**
 * "Daily Stories" per-scene prompt — no real-world subject, no press-photo framing.
 * Each scene gets its own illustrated still built straight from that scene's own
 * narration/caption, for fictional / narrative scripts where there is nothing real
 * to photograph.
 * @param {{ sceneText: string, topic?: string, styleHint?: string }} opts
 */
export function buildEofStorySceneImagePrompt(opts = {}) {
  const sceneText = String(opts.sceneText || '').trim()
  const topic = String(opts.topic || '').trim()
  const style =
    String(opts.styleHint || '').trim() ||
    'cinematic digital illustration, warm dramatic lighting, rich color, detailed character art'

  return [
    'Illustrated story scene,',
    style + ',',
    sceneText ? `depicting: ${sceneText}.` : topic ? `depicting: ${topic}.` : '',
    'Vertical 9:16 composition suitable for YouTube Shorts,',
    'no text, no captions, no watermarks, no logos, no UI elements.',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "Daily Stories" per-scene *video* prompt — same illustrated-narrative framing as
 * the still prompt above, with a short motion cue appended so text-to-video models
 * animate the scene instead of rendering a static frame.
 * @param {{ sceneText: string, topic?: string, styleHint?: string }} opts
 */
export function buildEofStorySceneVideoPrompt(opts = {}) {
  const stillPrompt = buildEofStorySceneImagePrompt(opts)
  return `${stillPrompt} Subtle cinematic camera motion, smooth animation, consistent character and setting throughout.`
}
