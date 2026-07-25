/**
 * Topic-lock / relevance + voice-quality gate for EOF Shorts scripts.
 * Blocks cross-sport free-association (e.g. Fury/Joshua in a Cuccurella hair story)
 * and insult / empty rhetorical waffle that fails the desk voice.
 */

export const EOF_SHORTS_RELEVANCE_VOICE = `TOPIC LOCK / RELEVANCE (non-negotiable):
- Stay INSIDE the football story from the ORDERED TOPIC. One story. One conflict.
- Do NOT pivot to a different player/career retrospective (e.g. Cuccurella hair → Kevin Keegan) even if other headlines appear in research.
- Do NOT drag in unrelated athletes, sports, or celebrities (boxing, UFC, F1, tennis, NBA, NFL, Hollywood, etc.) unless they already appear in the ORDERED TOPIC.
- No free-association analogies ("this reminds me of Fury vs Joshua…") when the topic never mentions them.
- Named people in the script must serve the ordered topic (or the clear same-story cast). If they are not in the topic, drop them.
- Never write "X is not the focus" then narrate someone else.
- Sensitive personal details (disability, family, health): only use what the brief already states; keep it respectful and factual — never sensationalise.

VOICE QUALITY (non-negotiable):
- Never insult the viewer ("you nut job", "you idiot", etc.).
- One sharp CTA at the end is enough — do NOT spam "agree or disagree" / empty strength-or-weakness ping-pong.
- Prefer sharp Eyes of Football desk commentary: who + conflict + stake + one fight question.`

/** Cross-sport / non-football figures commonly hallucinated into football scripts. */
const CROSS_SPORT_FIGURES = [
  { id: 'tyson_fury', label: 'Tyson Fury', patterns: [/\btyson\s+fury\b/i] },
  { id: 'anthony_joshua', label: 'Anthony Joshua', patterns: [/\banthony\s+joshua\b/i, /\baj\b(?=.*\b(joshua|boxing|fury)\b)/i] },
  { id: 'usyk', label: 'Oleksandr Usyk', patterns: [/\b(oleksandr\s+)?usyk\b/i] },
  { id: 'canelo', label: 'Canelo Alvarez', patterns: [/\bcanelo(\s+alvarez)?\b/i] },
  { id: 'floyd_mayweather', label: 'Floyd Mayweather', patterns: [/\b(floyd\s+)?mayweather\b/i] },
  { id: 'mike_tyson', label: 'Mike Tyson', patterns: [/\bmike\s+tyson\b/i] },
  { id: 'conor_mcgregor', label: 'Conor McGregor', patterns: [/\b(conor\s+)?mcgregor\b/i] },
  { id: 'jon_jones', label: 'Jon Jones', patterns: [/\bjon\s+jones\b/i] },
  { id: 'khabib', label: 'Khabib Nurmagomedov', patterns: [/\bkhabib(\s+nurmagomedov)?\b/i] },
  { id: 'lewis_hamilton', label: 'Lewis Hamilton', patterns: [/\blewis\s+hamilton\b/i] },
  { id: 'max_verstappen', label: 'Max Verstappen', patterns: [/\bmax\s+verstappen\b/i] },
  { id: 'charles_leclerc', label: 'Charles Leclerc', patterns: [/\bcharles\s+leclerc\b/i] },
  { id: 'lando_norris', label: 'Lando Norris', patterns: [/\blando\s+norris\b/i] },
  { id: 'novak_djokovic', label: 'Novak Djokovic', patterns: [/\b(novak\s+)?djokovic\b/i] },
  { id: 'serena_williams', label: 'Serena Williams', patterns: [/\bserena\s+williams\b/i] },
  { id: 'roger_federer', label: 'Roger Federer', patterns: [/\b(roger\s+)?federer\b/i] },
  { id: 'rafael_nadal', label: 'Rafael Nadal', patterns: [/\b(rafael\s+|rafa\s+)?nadal\b/i] },
  { id: 'tiger_woods', label: 'Tiger Woods', patterns: [/\btiger\s+woods\b/i] },
  { id: 'lebron_james', label: 'LeBron James', patterns: [/\blebron(\s+james)?\b/i] },
  { id: 'stephen_curry', label: 'Stephen Curry', patterns: [/\b(stephen|steph)\s+curry\b/i] },
  { id: 'tom_brady', label: 'Tom Brady', patterns: [/\btom\s+brady\b/i] },
  { id: 'patrick_mahomes', label: 'Patrick Mahomes', patterns: [/\b(patrick\s+)?mahomes\b/i] },
]

/** Sport / combat lexemes that must appear in the brief if used as a parallel. */
const CROSS_SPORT_LEXEMES = [
  {
    id: 'boxing',
    label: 'boxing',
    pattern: /\b(boxing|boxer|heavyweight\s+bout|prize\s*fight)\b/i,
    // Named boxers in the brief also unlock the sport word.
    sourceAlso: [/\bfury\b/i, /\bjoshua\b/i, /\busyk\b/i, /\bmayweather\b/i, /\bcanelo\b/i],
  },
  {
    id: 'ufc_mma',
    label: 'UFC / MMA',
    pattern: /\b(ufc|mma|mixed\s+martial\s+arts)\b/i,
    sourceAlso: [/\bmcgregor\b/i, /\bkhabib\b/i, /\bjon\s+jones\b/i],
  },
  {
    id: 'formula1',
    label: 'Formula 1',
    pattern: /\b(formula\s*1|\bf1\b|grand\s+prix)\b/i,
    sourceAlso: [/\bhamilton\b/i, /\bverstappen\b/i, /\bleclerc\b/i, /\bnorris\b/i],
  },
  { id: 'nba', label: 'NBA', pattern: /\b\bnba\b/i, sourceAlso: [/\blebron\b/i, /\bcurry\b/i] },
  { id: 'nfl_sport', label: 'NFL', pattern: /\b\bnfl\b/i, sourceAlso: [/\bbrady\b/i, /\bmahomes\b/i] },
  { id: 'mlb', label: 'MLB', pattern: /\b\bmlb\b/i },
  { id: 'nhl', label: 'NHL', pattern: /\b\bnhl\b/i },
  { id: 'wwe', label: 'WWE / wrestling', pattern: /\b(wwe|wwf|pro\s+wrestling)\b/i },
]

const VIEWER_INSULT =
  /\b(you\s+nut\s*jobs?|you\s+(idiot|moron|fool|muppet|clown|doughnut|donut|plonker|bellend|wanker|tosser|twat|dickhead)s?|shut\s+up(\s+you)?|are\s+you\s+(stupid|thick|dense|blind)|listen\s+up\s+you)\b/i

const AGREE_DISAGREE_CTA =
  /\b(agree\s+or\s+disagree|agree\s+with|disagree\s+with|buy\s+it,?\s+or|fair\s+response\s*[—–-]?\s*or)\b/i

const EMPTY_PINGPONG =
  /\b(strength or (a )?weakness|edge or .{0,40}(issue|problem|distract)|right or wrong|hero or villain|genius or mad(man|ness))\b/i

/** Tokens that look like proper-name starts but are sentence openers / common words. */
const NAME_STOP_FIRST = new Set(
  [
    'the',
    'this',
    'that',
    'these',
    'those',
    'does',
    'did',
    'is',
    'was',
    'are',
    'were',
    'his',
    'her',
    'their',
    'after',
    'when',
    'what',
    'why',
    'how',
    'and',
    'but',
    'for',
    'with',
    'from',
    'into',
    'about',
    'according',
    'fans',
    'comment',
    'buy',
    'put',
    'was',
    'has',
    'had',
    'have',
    'not',
    'now',
    'just',
    'still',
    'even',
    'only',
    'also',
    'then',
    'than',
    'some',
    'most',
    'many',
    'every',
    'each',
    'both',
    'either',
    'neither',
    'yes',
    'no',
    'ok',
    'okay',
    'fair',
    'true',
    'false',
    'real',
    'premier',
    'champions',
    'europa',
    'world',
    'la',
    'el',
    'los',
    'las',
    'fc',
    'afc',
    'cf',
    'sc',
    'united',
    'city',
    'town',
    'athletic',
    'sporting',
    'real',
    'inter',
    'bayern',
    'paris',
    'manchester',
    'liverpool',
    'chelsea',
    'arsenal',
    'tottenham',
    'newcastle',
    'brighton',
    'wolves',
    'everton',
    'west',
    'east',
    'north',
    'south',
    'new',
    'old',
    'great',
    'big',
    'long',
    'short',
    'white',
    'black',
    'red',
    'blue',
    'green',
    'gold',
    'silver',
  ].map((s) => s.toLowerCase()),
)

/** Club / competition / org / brand phrases — not treated as off-topic people. */
const FOOTBALL_ORG =
  /\b(premier\s+league|la\s+liga|serie\s+a|bundesliga|ligue\s+1|champions\s+league|europa\s+league|conference\s+league|world\s+cup|euros?|nations\s+league|fa\s+cup|carabao|efl|uefa|fifa|fifa\s+club\s+world\s+cup|eyes\s+of\s+football|sky\s+sports(\s+news)?|bbc\s+sport|tnt\s+sports|espn)\b/i

function normalizeHay(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sourceHas(sourceText, patternOrNeedle) {
  const hay = normalizeHay(sourceText)
  if (!hay) return false
  if (patternOrNeedle instanceof RegExp) return patternOrNeedle.test(hay)
  return hay.includes(normalizeHay(patternOrNeedle))
}

/**
 * Extract likely person-style multi-word proper names from draft text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractPersonLikeNames(text) {
  const raw = String(text || '')
  const out = []
  const re = /\b([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)+)\b/gu
  let m
  while ((m = re.exec(raw))) {
    const name = m[1].replace(/\s+/g, ' ').trim()
    const parts = name.split(' ')
    const first = (parts[0] || '').toLowerCase()
    if (NAME_STOP_FIRST.has(first)) continue
    if (FOOTBALL_ORG.test(name)) continue
    if (parts.every((p) => p.length <= 2)) continue
    out.push(name)
  }
  return [...new Set(out)]
}

/**
 * @param {string} name
 * @param {string} sourceText
 * @param {string[]} [topicAnchors] ordered-topic person tokens — always count as grounded (typo-tolerant)
 */
function nameGroundedInSource(name, sourceText, topicAnchors = []) {
  const hay = normalizeHay(sourceText)
  const full = cleanNameToken(name)
  const parts = full.split(/\s+/).filter((p) => p.length >= 4)
  // Primary topic entities (ordered topic/title) always ground the hero — even with Marc/Mark or Cuc* typos.
  if (
    parts.length &&
    Array.isArray(topicAnchors) &&
    topicAnchors.some((a) => parts.some((p) => tokensLooselyEqual(p, a)))
  ) {
    return true
  }
  if (!hay) return false
  if (full && hay.includes(full)) return true
  // Surname (last token ≥4) or any distinctive token in the brief is enough.
  if (parts.length && parts.some((p) => hay.includes(p))) return true
  // Fuzzy: Cuccorea ≈ Cuccurella / Cucurella / Cuccorella (common AI misspells)
  const hayToks = hay.split(/\s+/).filter((p) => p.length >= 4)
  if (parts.some((p) => hayToks.some((h) => tokensLooselyEqual(p, h)))) return true
  return false
}

/** Strip possessive / punctuation from a name token for fuzzy match. */
function cleanNameToken(s) {
  return normalizeHay(s).replace(/['’]s\b/g, '').replace(/['’]/g, '')
}

/** Collapse consecutive duplicate letters (Cuccurella → Cucurela) for typo-tolerant surname match. */
function collapseLetterRepeats(s) {
  return String(s || '').replace(/(.)\1+/g, '$1')
}

/** Small Levenshtein for name-token fuzzy match (surnames / Marc↔Mark). */
function editDistance(a, b) {
  const x = String(a || '')
  const y = String(b || '')
  if (x === y) return 0
  const n = x.length
  const m = y.length
  if (!n) return m
  if (!m) return n
  const prev = new Array(m + 1)
  const cur = new Array(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j
  for (let i = 1; i <= n; i++) {
    cur[0] = i
    const ca = x.charCodeAt(i - 1)
    for (let j = 1; j <= m; j++) {
      const cost = ca === y.charCodeAt(j - 1) ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= m; j++) prev[j] = cur[j]
  }
  return prev[m]
}

/**
 * Loose surname / given-name match (Cuccorea ≈ Cuccurella / Cucurella / Cuccorella; Marc ≈ Mark).
 * @param {string} a
 * @param {string} b
 */
export function tokensLooselyEqual(a, b) {
  const x = cleanNameToken(a)
  const y = cleanNameToken(b)
  if (!x || !y) return false
  if (x === y) return true
  if (x.includes(y) || y.includes(x)) return true

  const cx = collapseLetterRepeats(x)
  const cy = collapseLetterRepeats(y)
  if (cx && cy && (cx === cy || cx.includes(cy) || cy.includes(cx))) return true

  const maxLen = Math.max(x.length, y.length)
  const minLen = Math.min(x.length, y.length)
  if (minLen >= 4 && Math.abs(x.length - y.length) <= 3) {
    const dist = editDistance(x, y)
    const distCollapsed = cx && cy ? editDistance(cx, cy) : dist
    // Marc↔Mark (1), Cucurella↔Cuccorea / Cuccurella (2–3 after collapse)
    if (dist <= 1 || distCollapsed <= 1) return true
    if (maxLen >= 7 && (dist <= 3 || distCollapsed <= 2)) return true
  }

  if (x.length >= 5 && y.length >= 5 && x.slice(0, 4) === y.slice(0, 4) && Math.abs(x.length - y.length) <= 3) {
    return true
  }
  // Shared 3-letter prefix + similar length covers Cuc* surname family when 4-letter prefix drifts (cucu vs cucc)
  if (
    minLen >= 6 &&
    Math.abs(x.length - y.length) <= 3 &&
    x.slice(0, 3) === y.slice(0, 3) &&
    (editDistance(x, y) <= 3 || editDistance(cx, cy) <= 2)
  ) {
    return true
  }
  return false
}

/**
 * Distinctive person-anchor tokens from the ordered topic (surnames / full names).
 * Desk brief must NOT expand this — otherwise unrelated RSS unlocks a full pivot.
 * @param {string} topic
 * @returns {string[]}
 */
export function extractTopicAnchorTokens(topic) {
  const names = extractPersonLikeNames(topic)
  const out = []
  for (const name of names) {
    const parts = cleanNameToken(name)
      .split(/\s+/)
      .filter((p) => p.length >= 4)
    out.push(...parts)
  }
  // Fallback: distinctive capitalized tokens in topic when extractPersonLikeNames misses
  if (!out.length) {
    const re = /\b([A-Z][\p{L}'’-]{3,})\b/gu
    let m
    const raw = String(topic || '')
    while ((m = re.exec(raw))) {
      const tok = cleanNameToken(m[1])
      if (!tok || NAME_STOP_FIRST.has(tok)) continue
      if (FOOTBALL_ORG.test(m[1])) continue
      out.push(tok)
    }
  }
  return [...new Set(out)]
}

function countTokenMentions(text, tokens) {
  const hay = normalizeHay(text)
  if (!hay || !tokens?.length) return 0
  let n = 0
  for (const tok of tokens) {
    const t = cleanNameToken(tok)
    if (!t || t.length < 4) continue
    if (hay.includes(t)) {
      n += 1
      continue
    }
    // Fuzzy: any hay word loosely equals token
    for (const w of hay.split(/\s+/)) {
      if (tokensLooselyEqual(w, t)) {
        n += 1
        break
      }
    }
  }
  return n
}

const TOPIC_DISMISS_RE =
  /\b(not the focus|isn'?t the (real )?focus|not (really )?about|isn'?t about|different story|unrelated to|instead,? (we|let'?s)|moving on (to|from)|forget (about )?(him|her|them|that))\b/i

/**
 * True when the draft abandons the ordered-topic person/story for a different main subject
 * (e.g. Cuccurella hair → Kevin Keegan career retrospective).
 * Uses TOPIC anchors only — desk headlines must not unlock a pivot.
 * @param {string} draft
 * @param {string} topic
 */
export function detectTopicDrift(draft, topic) {
  const text = String(draft || '').trim()
  const ordered = String(topic || '').trim()
  const anchors = extractTopicAnchorTokens(ordered)
  if (!text || anchors.length === 0) {
    return { drift: false, foreign: [], anchors, dismiss: false, anchorMentions: 0, foreignMentions: 0 }
  }

  const draftNames = extractPersonLikeNames(text)
  const foreign = []
  for (const name of draftNames) {
    const parts = cleanNameToken(name)
      .split(/\s+/)
      .filter((p) => p.length >= 4)
    const matchesAnchor = parts.some((p) => anchors.some((a) => tokensLooselyEqual(p, a)))
    if (matchesAnchor) continue
    // Same-story cast still in the ordered topic string (club etc. already filtered by extract)
    if (nameGroundedInSource(name, ordered, anchors)) continue
    foreign.push(name)
  }

  const dismiss = TOPIC_DISMISS_RE.test(text)
  const anchorMentions = countTokenMentions(text, anchors)
  const foreignTokens = foreign.flatMap((n) =>
    cleanNameToken(n)
      .split(/\s+/)
      .filter((p) => p.length >= 4),
  )
  const foreignMentions = countTokenMentions(text, foreignTokens)

  // Pivot: dismiss topic, or a foreign person dominates the VO vs topic anchors.
  const drift =
    foreign.length > 0 &&
    (dismiss ||
      (foreignMentions >= 2 && anchorMentions <= 1) ||
      (foreignMentions > anchorMentions && foreignMentions >= 2))

  return { drift, foreign, anchors, dismiss, anchorMentions, foreignMentions }
}

/**
 * Local relevance + voice score (0–10).
 * Hard-fails cross-sport injections and viewer insults.
 * @param {string} draft
 * @param {{ topic?: string, deskBrief?: string, format?: string, context?: string }} [opts]
 */
export function scoreDraftRelevance(draft, opts = {}) {
  const text = String(draft || '').trim()
  const topic = String(opts.orderedTopic || opts.topic || '')
  const deskBrief = String(opts.deskBrief || opts.context || '')
  const sourceText = `${topic}\n${deskBrief}`
  const reasons = []
  const rewriteHints = []
  const offTopic = []
  let score = 9

  if (!text || text.split(/\s+/).filter(Boolean).length < 12) {
    return {
      pass: true,
      score: 7,
      offTopic: [],
      reasons: [],
      rewriteHints: [],
      topicDrift: false,
    }
  }

  // A0) Topic drift — ordered topic only (desk RSS must not unlock a Keegan pivot)
  const topicAnchors = extractTopicAnchorTokens(topic)
  const drift = detectTopicDrift(text, topic)
  if (drift.drift) {
    score = Math.min(score, 1.5)
    const foreignLabel = drift.foreign[0] || 'another person'
    offTopic.push({
      id: `topic_drift:${normalizeHay(foreignLabel).replace(/\s+/g, '_')}`,
      label: foreignLabel,
      kind: 'topic_drift',
    })
    reasons.push(
      drift.dismiss
        ? `Topic drift — dismisses ordered story and pivots to ${foreignLabel}`
        : `Topic drift — main narrative shifts to ${foreignLabel} instead of the ordered topic`,
    )
    rewriteHints.push('Stay on the ordered topic’s people and conflict — do not pivot to a different career/story')
  }

  // A) Cross-sport figures
  for (const fig of CROSS_SPORT_FIGURES) {
    const hit = fig.patterns.some((re) => re.test(text))
    if (!hit) continue
    if (fig.patterns.some((re) => sourceHas(sourceText, re)) || sourceHas(sourceText, fig.label)) {
      continue
    }
    offTopic.push({ id: fig.id, label: fig.label, kind: 'cross_sport_person' })
  }

  // A) Cross-sport lexemes
  for (const lex of CROSS_SPORT_LEXEMES) {
    if (!lex.pattern.test(text)) continue
    if (sourceHas(sourceText, lex.pattern) || sourceHas(sourceText, lex.label)) continue
    if (Array.isArray(lex.sourceAlso) && lex.sourceAlso.some((re) => sourceHas(sourceText, re))) {
      continue
    }
    offTopic.push({ id: lex.id, label: lex.label, kind: 'cross_sport' })
  }

  // A) Ungrounded person-like names (soft→hard when several, or when also cross-sport)
  const names = extractPersonLikeNames(text)
  const ungrounded = []
  for (const name of names) {
    if (nameGroundedInSource(name, sourceText, topicAnchors)) continue
    // Skip if already captured as a known cross-sport figure
    if (
      CROSS_SPORT_FIGURES.some((fig) =>
        fig.patterns.some((re) => re.test(name)),
      )
    ) {
      continue
    }
    ungrounded.push(name)
  }
  // Hard-fail ungrounded names that look like celebrity parallels (2+ tokens, none in source)
  for (const name of ungrounded.slice(0, 4)) {
    offTopic.push({
      id: `ungrounded:${normalizeHay(name).replace(/\s+/g, '_')}`,
      label: name,
      kind: 'ungrounded_name',
    })
  }

  if (offTopic.length) {
    score = Math.min(score, 2.5)
    for (const o of offTopic.slice(0, 4)) {
      if (o.kind === 'topic_drift') continue // reason already added
      if (o.kind === 'cross_sport_person' || o.kind === 'cross_sport') {
        reasons.push(`Off-topic ${o.label} not in topic/desk brief`)
      } else {
        reasons.push(`Named “${o.label}” not grounded in topic/desk brief`)
      }
    }
    if (offTopic.some((o) => o.kind !== 'topic_drift')) {
      rewriteHints.push(
        'Stay inside the football story — drop unrelated athletes/sports/celebrities not in the brief',
      )
      rewriteHints.push(
        'Only name people who appear in the topic or desk brief (same-story cast)',
      )
    }
  }

  // B) Viewer insults — hard fail
  if (VIEWER_INSULT.test(text)) {
    score = Math.min(score, 2)
    reasons.push('Insults the viewer / abusive desk tone')
    rewriteHints.push('Drop insults — sharp desk take, never abuse the audience')
  }

  // B) Agree/disagree spam + empty rhetorical ping-pong
  const ctaHits = (text.match(new RegExp(AGREE_DISAGREE_CTA.source, 'gi')) || []).length
  const emptyPingPong = EMPTY_PINGPONG.test(text)
  const agreeDisagree = AGREE_DISAGREE_CTA.test(text)
  if (ctaHits >= 2) {
    score -= 2.5
    reasons.push('Agree/disagree CTA spam')
    rewriteHints.push('One fight question at the end — not repeated agree/disagree loops')
  }
  if (emptyPingPong && agreeDisagree) {
    score = Math.min(score, 3)
    reasons.push('Empty strength/weakness rhetorical ping-pong')
    rewriteHints.push('Replace waffle questions with one concrete stake + one CTA')
  }

  // Soft: sensational disability framing without brief support
  if (
    /\b(autis(m|tic)|disabled|disability|special\s+needs)\b/i.test(text) &&
    !/\b(autis(m|tic)|disabled|disability|special\s+needs|son|daughter|child)\b/i.test(
      normalizeHay(sourceText),
    )
  ) {
    score -= 3
    reasons.push('Sensitive personal/disability detail not in desk brief')
    rewriteHints.push('Do not invent or sensationalise family/disability angles absent from the brief')
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))
  const hardFail =
    offTopic.some(
      (o) =>
        o.kind === 'cross_sport_person' ||
        o.kind === 'cross_sport' ||
        o.kind === 'topic_drift',
    ) ||
    VIEWER_INSULT.test(text) ||
    offTopic.filter((o) => o.kind === 'ungrounded_name').length >= 1 ||
    ctaHits >= 2 ||
    (emptyPingPong && agreeDisagree)

  const pass = !hardFail && score >= 6

  return {
    pass,
    score: hardFail ? Math.min(score, 3) : score,
    offTopic,
    topicDrift: Boolean(drift.drift),
    reasons: reasons.slice(0, 6),
    rewriteHints: [...new Set(rewriteHints)].slice(0, 5),
  }
}

/**
 * Merge relevance gate into a judge verdict (after factuality merge).
 * @param {object|null} verdict
 * @param {ReturnType<typeof scoreDraftRelevance>} rel
 */
export function mergeRelevanceIntoVerdict(verdict, rel) {
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

  base.relevance = Number(rel?.score) || 0
  base.offTopic = Array.isArray(rel?.offTopic) ? rel.offTopic : []
  base.reasons = [...(base.reasons || []), ...(rel?.reasons || [])].slice(0, 9)
  base.rewriteHints = [...(base.rewriteHints || []), ...(rel?.rewriteHints || [])].slice(0, 8)

  if (rel && !rel.pass) {
    base.pass = false
    if (!base.overall || base.overall > rel.score) base.overall = rel.score
    if (!base.merit || base.merit > rel.score) base.merit = rel.score
    if (!base.value || base.value > rel.score) base.value = rel.score
  }

  return base
}
