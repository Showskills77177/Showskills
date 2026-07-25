/**
 * Hot-take quality bar for EOF Shorts — bite, timeliness, and anti-article paste.
 * Used by writer prompts, local gates, Script Maker, and the second-tier judge.
 */

export const EOF_SHORTS_HOT_TAKE_VOICE = `HOT TAKE BAR (non-negotiable for Script Maker / Auto):
- Write a SCROLL-STOPPING desk take, not a news summary. Fans should want to argue in the comments.
- GOLD shapes (copy the energy, not the facts unless they are in the desk brief):
  1) "Thomas Tuchel's defensive setup cost England — according to Rio Ferdinand, that shape handed Argentina the win. Not a soft take: the midfield never pressed, the back line sat deep, and the game died. Was Rio right, or is that unfair on Tuchel?"
  2) "Jude Bellingham clarified he never said anything bad to Messi after cameras caught their on-pitch exchange. Heat of the moment, not a beef — that's his claim. Buy it, or still smell disrespect?"
  3) "Marc Cucurella hit back at long-hair criticism — he says it is a personal reason tied to his son, not a fashion stunt. Fair response, or still fair game to joke about the hair?"
- Every script needs: (1) WHO + CONFLICT in line 1, (2) ONE concrete stake — tactics / selection / pride / result / quote row OR personal reason / backlash / criticism for human-interest stories, (3) ONE sharp fight CTA (not agree/disagree spam).
- Do NOT paste or lightly rewrite an article. Transform the brief into a spoken argument.
- TIMELY: prefer what just happened / what was just said. Avoid timeless career fluff unless the format is timeline.
- TOPIC LOCK: stay inside the football story from the desk brief — no boxing/F1/unrelated celebrity free-association.
- If the desk brief is thin, still pick the sharpest defensible angle — never fill with "fans are arguing" empty glue, never insult the viewer, and never invent transfers/retirements/comebacks/injuries/sackings.`

const ARTICLE_GLUE =
  /\b(that is the football story fans are arguing about|fans are arguing about right now|ignore the noise|strip (away )?the (tribal )?noise|the result changes the table talk|who comes out of this looking stronger|this is the football story|just another chapter|most fans still miss)\b/i

const TIMELY =
  /\b(just|today|tonight|this week|this morning|after|following|last night|hours ago|now|confirmed|hit back|hits back|responded|slammed|cost (us|them|england)|according to)\b/i

/** Tactics/selection AND human-interest stakes (pride, criticism, personal reason, quote verbs). */
const STAKE =
  /\b(cost|selection|tactics|dropped|benched|heat|pride|respect|disrespect|win|loss|defeat|final|press|shape|midfield|back[\s-]?line|quote|said|says|saying|claim(?:s|ed)?|row|beef|exchange|criticism|critics?|backlash|mock(?:ed|ing)?|joke(?:s|d)?|digs?|hair|locks|personal|family|son|daughter|autis(?:m|tic)|distraction|hit\s+back|hits\s+back|responded|slammed|pile-?on)\b/i

/**
 * Local hot-take + timeliness score (0–10).
 * @param {string} draft
 * @param {{ format?: string, topic?: string }} [opts]
 */
export function scoreDraftHotTake(draft, opts = {}) {
  const text = String(draft || '').trim()
  const topic = String(opts.topic || '')
  const reasons = []
  const rewriteHints = []
  let score = 8

  if (!text || text.split(/\s+/).filter(Boolean).length < 45) {
    return {
      pass: false,
      score: 2,
      bite: 2,
      timely: 2,
      reasons: ['Too short for a hot-take Short'],
      rewriteHints: ['Write 90–130 words with who + conflict + stake + CTA'],
    }
  }

  if (ARTICLE_GLUE.test(text)) {
    score -= 3.5
    reasons.push('Sounds like a canned template / article paste')
    rewriteHints.push('Kill glue lines — open with a named claim and a concrete stake')
  }

  // Near-copy of the headline alone is not a script
  const topicCore = topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const draftLower = text.toLowerCase()
  if (topicCore.length >= 24 && draftLower.includes(topicCore.slice(0, 40)) && !STAKE.test(text)) {
    score -= 2
    reasons.push('Mostly restates the headline without a bite')
    rewriteHints.push(
      'Add the stake: tactics, selection, pride, result, quote fight, or personal/backlash angle',
    )
  }

  const timelyScore = TIMELY.test(text) ? 8 : 4
  if (timelyScore < 6) {
    score -= 1.5
    reasons.push('Weak “now” signal — feels timeless / career fluff')
    rewriteHints.push('Anchor to what just happened or what was just said')
  }

  const biteScore = STAKE.test(text) ? 8 : 3.5
  if (biteScore < 6) {
    score -= 2
    reasons.push(
      'No concrete stake (tactics / selection / pride / result / quote row / personal reason / backlash)',
    )
    rewriteHints.push(
      'Example energy: Tuchel shape cost the win · Bellingham denied Messi beef · Cucurella hair criticism / personal reason',
    )
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length < 4) {
    score -= 1
    reasons.push('Too few spoken beats')
  }

  if (!/[?]/.test(text)) {
    score -= 1
    reasons.push('Missing fight CTA')
    rewriteHints.push('End with one sharp agree/disagree question')
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))
  const hardFail = ARTICLE_GLUE.test(text)
  const pass = !hardFail && score >= 6.5 && biteScore >= 5
  return {
    pass,
    score: hardFail ? Math.min(score, 4) : score,
    bite: biteScore,
    timely: timelyScore,
    reasons: reasons.slice(0, 5),
    rewriteHints: [...new Set(rewriteHints)].slice(0, 4),
  }
}

/**
 * Merge hot-take gate into a judge verdict (after directness merge).
 * @param {object|null} verdict
 * @param {ReturnType<typeof scoreDraftHotTake>} hot
 */
export function mergeHotTakeIntoVerdict(verdict, hot) {
  const base =
    verdict && typeof verdict === 'object'
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

  base.hotTake = Number(hot?.score) || 0
  base.bite = Number(hot?.bite) || 0
  base.timely = Number(hot?.timely) || 0
  base.reasons = [...(base.reasons || []), ...(hot?.reasons || [])].slice(0, 7)
  base.rewriteHints = [...(base.rewriteHints || []), ...(hot?.rewriteHints || [])].slice(0, 6)

  if (hot && !hot.pass) {
    base.pass = false
    if (!base.overall || base.overall > hot.score) base.overall = hot.score
    if (!base.interest || base.interest > hot.score) base.interest = hot.score
  }

  return base
}
