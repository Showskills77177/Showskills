/**
 * Eyes Of Football Shorts voice — direct desk copy, not vague “book chapter” waffle.
 * Used by the writer prompts, local quality gate, and second-model judge.
 */

export const EOF_SHORTS_DIRECT_VOICE = `DIRECT SHORTS VOICE (non-negotiable):
- Speak like a football desk clip, not a novel. Every sentence must push a FACT, NAME, CLAIM, or REACTION.
- Name people and the conflict in the opening line (who said what / who responded / what just happened).
- QUOTE / CLAIM format (gold standard):
    "[Player A] hit back at [Player/Coach B] after [B] said [concrete claim]. [A] said [concrete response — heat, selection, tactics, etc.]. That's the row. Agree with [A] or [B]?"
  Example shape: "Jude Bellingham hit back at Thomas Tuchel after Tuchel questioned his performance. Bellingham said Tuchel doesn't know what it's like to play in that heat. Fair response — or disrespect? Comment."
- HOT TAKE energy: tactics cost a win, selection rows, pride/respect, on-pitch exchanges — not soft news paste.
- Never "tell the story of a career". Never soft framing ("a reminder that…", "raises questions about…", "speaks volumes…") without the actual claim.
- Association football only — the game with the feet. Always "football", never soccer / NFL.`

const BANNED_SOFT =
  /\b(here'?s what we know|the key detail fans need|why it matters|just another chapter|global superstar|raw talent|unforgettable nights|most fans still miss|it is important to note|throughout (his|her|their) career|in conclusion|as we all know|a testament to|indelible|woven into the fabric|cannot be overstated|in today'?s footballing landscape|raises (big )?questions|speaks volumes|a reminder that|the narrative|the story of|once upon|in many ways|at the end of the day|needless to say|when all is said|that is the football story fans are arguing about|fans are arguing about right now|ignore the noise|strip (away )?the (tribal )?noise|who comes out of this looking stronger)\b/i

const DIRECT_VERBS =
  /\b(said|says|told|hit back|responded|responded back|fired back|claimed|claims|accused|slammed|denied|confirmed|revealed|admitted|insisted|warned|blamed|questioned|criticis[ee]d|praised|dropped|recalled|benched|selected)\b/i

/**
 * Local directness score (0–10) — runs even when the second-model judge is offline.
 * @param {string} draft
 * @param {{ format?: string, topic?: string }} [opts]
 */
export function scoreDraftDirectness(draft, opts = {}) {
  const text = String(draft || '').trim()
  const format = String(opts.format || '').toLowerCase()
  const topic = String(opts.topic || '')
  const reasons = []
  const rewriteHints = []
  let score = 8

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 45) {
    return {
      pass: false,
      score: 2,
      reasons: ['Draft too short for a Shorts VO'],
      rewriteHints: ['Write 90–130 spoken words with names + the concrete claim'],
    }
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const first = sentences[0] || ''
  const avgWords =
    sentences.length > 0
      ? words.length / sentences.length
      : words.length

  if (avgWords > 22) {
    score -= 2.5
    reasons.push('Sentences too long / essay-like')
    rewriteHints.push('Cut to short spoken beats under ~16 words')
  } else if (avgWords > 18) {
    score -= 1
    reasons.push('Average sentence length is soft for Shorts')
  }

  if (BANNED_SOFT.test(text)) {
    score -= 3
    reasons.push('Banned soft / bookish phrasing')
    rewriteHints.push('Delete waffle openers — open with who + claim')
  }

  if (/\bsoccer\b/i.test(text) || /\b(NFL|NBA|MLB|NHL)\b/.test(text)) {
    score -= 4
    reasons.push('Wrong sport language')
    rewriteHints.push('Association football only — say football')
  }

  // First line should carry a proper name (capitalized token ≥3 letters) or topic surname
  const firstHasName = /(?:^|[.!?]\s+)[A-Z][\p{L}'-]{2,}(?:\s+[A-Z][\p{L}'-]{2,})?/.test(first) ||
    (() => {
      const toks = topic.split(/\s+/).filter((w) => w.length >= 4)
      return toks.some((w) => first.toLowerCase().includes(w.toLowerCase()))
    })()
  if (!firstHasName) {
    score -= 2
    reasons.push('Opening line does not name the person/event')
    rewriteHints.push('First sentence: Name + what they said or what happened')
  }

  const quoteLike =
    format === 'quote' ||
    /["“”]/.test(topic) ||
    /\b(said|says|claim|quoted|responded|hit back)\b/i.test(topic)

  if (quoteLike) {
    if (!DIRECT_VERBS.test(text)) {
      score -= 2.5
      reasons.push('Quote Short missing direct said/responded/claimed verbs')
      rewriteHints.push(
        'Use: X hit back at Y after Y said [claim]. X said [response]. Then the CTA.',
      )
    }
    // Prefer two named parties for claim/response rows
    const proper = text.match(/\b[A-Z][\p{L}'-]{2,}(?:\s+[A-Z][\p{L}'-]{2,})?\b/gu) || []
    const uniq = new Set(proper.map((p) => p.toLowerCase()))
    if (uniq.size < 2) {
      score -= 1.5
      reasons.push('Quote row needs two named people (speaker + target)')
      rewriteHints.push('Name both sides: Bellingham vs Tuchel, not vague “the manager”')
    }
  }

  if (!/[?]/.test(text)) {
    score -= 1
    reasons.push('Missing comment CTA question')
    rewriteHints.push('End with one sharp agree/disagree question')
  }

  // Vague abstraction density
  const vagueHits = (text.match(/\b(situation|narrative|journey|chapter|legacy|mindset|vibe|energy|statement|optics)\b/gi) || [])
    .length
  if (vagueHits >= 3) {
    score -= 2
    reasons.push('Too many abstract filler nouns')
    rewriteHints.push('Replace journey/narrative/vibe with the actual claim or match fact')
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))
  const pass = score >= 6.5 && reasons.every((r) => !/Wrong sport|Banned soft|too short/i.test(r))
  // Hard fail on banned soft / wrong sport even if score math is soft
  const hardFail = BANNED_SOFT.test(text) || /\bsoccer\b/i.test(text) || /\b(NFL|NBA)\b/.test(text)
  return {
    pass: hardFail ? false : pass,
    score: hardFail ? Math.min(score, 4.5) : score,
    reasons: reasons.slice(0, 5),
    rewriteHints: [...new Set(rewriteHints)].slice(0, 4),
  }
}

/**
 * Merge local directness into a model judge verdict (or stand in when judge skipped).
 * @param {object|null} verdict
 * @param {ReturnType<typeof scoreDraftDirectness>} direct
 */
export function mergeDirectnessIntoVerdict(verdict, direct) {
  const base = verdict && typeof verdict === 'object'
    ? { ...verdict }
    : {
        pass: true,
        overall: 0,
        merit: 0,
        interest: 0,
        value: 0,
        reasons: [],
        rewriteHints: [],
        skipped: true,
        judgeProvider: null,
        threshold: 6.5,
      }

  const directness = Number(direct?.score) || 0
  base.directness = directness
  base.reasons = [...(base.reasons || []), ...(direct?.reasons || [])].slice(0, 6)
  base.rewriteHints = [...(base.rewriteHints || []), ...(direct?.rewriteHints || [])].slice(0, 5)

  if (direct && !direct.pass) {
    base.pass = false
    if (!base.overall || base.overall > directness) base.overall = directness
  } else if (base.skipped && direct?.pass) {
    // No second model — local gate alone can soft-pass with directness as overall
    base.overall = base.overall || directness
    base.merit = base.merit || directness
    base.interest = base.interest || directness
    base.value = base.value || directness
    base.pass = direct.pass
    base.skipped = false
    base.judgeProvider = base.judgeProvider || 'local-directness'
  }

  return base
}
