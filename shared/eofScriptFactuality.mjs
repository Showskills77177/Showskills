/**
 * Grounding / anti-invention gate for EOF Shorts scripts.
 * Blocks fabricated career-status and breaking claims that are not in the
 * topic / desk brief (e.g. inventing a retirement comeback).
 */

export const EOF_SHORTS_FACTUALITY_VOICE = `FACTUALITY / GROUNDING (non-negotiable):
- Do NOT invent news events. If unsure, do not claim it happened.
- Stay grounded in the selected topic, desk brief, and sourced headlines ONLY.
- Never invent transfers, retirements, comebacks, injuries, sackings, appointments, bans, or "breaking" claims that are not in the source material.
- Prefer commentary / analysis / opinion framing over fabricating events.
  OK: "Was Bale the best Wales ever produced?" / "Does his Real Madrid peak still set the bar?"
  NOT OK: "Gareth Bale is coming back from retirement" when the brief never says that.
- If the brief is thin: argue about reputation, tactics, pride, or a known public claim already in the brief — do not fill gaps with fake news.
- FACT LOCK: names, clubs, scores, fees, quotes, and career-status changes must appear in the DESK BRIEF / topic (or be clearly marked as opinion/question, not asserted fact).
- Do not invent sensitive personal details (family, disability, health) beyond the brief; if the brief includes them, keep the framing respectful and factual.`

/**
 * Breaking career / status claim families.
 * If the draft asserts one of these and the source text lacks matching needles → fail.
 */
const CAREER_EVENT_CHECKS = [
  {
    id: 'retirement_comeback',
    label: 'comeback from retirement',
    draftPatterns: [
      /\b(coming|comes|come|came)\s+back\s+from\s+(retirement|retiring)\b/i,
      /\breturn(ing|s|ed)?\s+from\s+retirement\b/i,
      /\bout\s+of\s+retirement\b/i,
      /\bunretir(e|ed|es|ing)\b/i,
      /\bcomeback\s+from\s+retirement\b/i,
      /\b(ending|ends|ended)\s+(his|her|their)\s+retirement\b/i,
      /\brevers(e|es|ed|ing)\s+(his|her|their)\s+retirement\b/i,
    ],
    sourceNeedles: [
      /retir/i,
      /comeback/i,
      /come\s+back/i,
      /out\s+of\s+retirement/i,
      /unretir/i,
      /return(ing|s|ed)?\s+from\s+retirement/i,
    ],
  },
  {
    id: 'new_retirement',
    label: 'new retirement announcement',
    draftPatterns: [
      /\b(has\s+)?(just\s+)?announc(ed|es|ing)\s+(his|her|their)\s+retirement\b/i,
      /\b(is|are)\s+retir(ing|ed)\s+(from\s+)?(football|the\s+game|international)\b/i,
      /\bhang(ing|s|ed)?\s+up\s+(his|her|their)\s+boots\b/i,
      /\bcall(ed|s|ing)?\s+it\s+a\s+career\b/i,
    ],
    sourceNeedles: [/retir/i, /hang(ing|s|ed)?\s+up/i, /boots/i, /call(ed|s|ing)?\s+it\s+a\s+career/i],
  },
  {
    id: 'transfer_signing',
    label: 'transfer / signing presented as fact',
    draftPatterns: [
      /\b(has\s+)?(just\s+)?sign(ed|s|ing)\s+(for|with)\b/i,
      /\b(has\s+)?(just\s+)?join(ed|s|ing)\s+[A-Z]/,
      /\bcomplet(ed|es|ing)\s+(a\s+)?(€|£|\$)?[\d.]+\s*(m|million)?\s*(move|deal|transfer)\b/i,
      /\b(deal|move|transfer)\s+(is\s+)?(done|complete|completed|sealed)\b/i,
      /\bmedical\s+(is|has\s+been)\s+(done|completed|passed)\b/i,
    ],
    sourceNeedles: [
      /sign(ed|s|ing)?/i,
      /join(ed|s|ing)?/i,
      /transfer/i,
      /deal/i,
      /move\s+to/i,
      /medical/i,
      /loan/i,
    ],
  },
  {
    id: 'sacking_firing',
    label: 'sacking / firing',
    draftPatterns: [
      /\b(has\s+been\s+)?(sack(ed|s|ing)|fir(ed|es|ing)|dismiss(ed|es|ing)|axed)\b/i,
      /\b(has\s+)?parted\s+company\b/i,
      /\b(has\s+been\s+)?reliev(ed|es|ing)\s+of\s+(his|her|their)\s+duties\b/i,
    ],
    sourceNeedles: [
      /sack/i,
      /\bfir(ed|es|ing)\b/i,
      /dismiss/i,
      /\baxed\b/i,
      /parted\s+company/i,
      /reliev(ed|es|ing)\s+of/i,
      /gone\s+from\s+the\s+club/i,
      /manager\s+(has\s+been\s+)?(sacked|fired|axed)/i,
    ],
  },
  {
    id: 'appointment',
    label: 'new managerial appointment',
    draftPatterns: [
      /\b(has\s+been\s+)?appoint(ed|s|ing)\s+(as\s+)?(manager|head\s+coach|boss)\b/i,
      /\b(is|are)\s+the\s+new\s+(manager|head\s+coach|boss)\b/i,
      /\btaken\s+(the|over\s+as)\s+(manager|managerial)\b/i,
    ],
    sourceNeedles: [
      /appoint/i,
      /new\s+(manager|head\s+coach|boss)/i,
      /tak(en|es|ing)\s+(over|charge)/i,
      /named\s+(as\s+)?(manager|head\s+coach|boss)/i,
    ],
  },
  {
    id: 'breaking_injury',
    label: 'breaking injury claim',
    draftPatterns: [
      /\b(has\s+)?suffer(ed|s|ing)\s+(a\s+)?(torn\s+)?(acl|mcl|achilles|hamstring|cruciate)\b/i,
      /\b(is|are)\s+ruled\s+out\s+(for\s+)?(the\s+)?(season|rest\s+of|months|weeks)\b/i,
      /\bout\s+for\s+(the\s+)?(season|rest\s+of\s+the\s+season)\b/i,
    ],
    sourceNeedles: [
      /injur/i,
      /ruled\s+out/i,
      /\bacl\b/i,
      /\bmcl\b/i,
      /achilles/i,
      /hamstring/i,
      /cruciate/i,
      /out\s+for/i,
      /scan/i,
    ],
  },
]

function normalizeHay(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'’.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sourceMentions(sourceText, needles) {
  const hay = normalizeHay(sourceText)
  if (!hay) return false
  // Strip common negations so "no comeback news" does not count as support.
  const positiveHay = hay
    .replace(
      /\b(no|not|without|isn't|isnt|aren't|arent|never)\b[\s\w'-]{0,40}/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!positiveHay) return false
  return needles.some((re) => re.test(positiveHay))
}

/**
 * Soft opinion / question framing — not treated as asserted fake news.
 * e.g. "Should Bale come back from retirement?" / "Fans want a comeback…"
 */
function isOpinionFramedClaim(sentence) {
  const s = String(sentence || '')
  if (/[?]/.test(s)) return true
  if (
    /\b(should|would|could|might|may|want(s|ed)?|wish(es|ed)?|hope(s|d)?|rumour(s|ed)?|rumor(s|ed)?|speculat|fantasy|hypothetical|imagine|what\s+if)\b/i.test(
      s,
    )
  ) {
    return true
  }
  return false
}

function sentencesOf(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Local factuality score (0–10). Hard-fails unsupported career-status inventions.
 * @param {string} draft
 * @param {{ topic?: string, deskBrief?: string, format?: string }} [opts]
 */
export function scoreDraftFactuality(draft, opts = {}) {
  const text = String(draft || '').trim()
  const topic = String(opts.topic || '')
  const deskBrief = String(opts.deskBrief || opts.context || '')
  const sourceText = `${topic}\n${deskBrief}`
  const reasons = []
  const rewriteHints = []
  const fabricated = []
  let score = 9

  if (!text || text.split(/\s+/).filter(Boolean).length < 12) {
    return {
      pass: true,
      score: 7,
      fabricated: [],
      reasons: [],
      rewriteHints: [],
    }
  }

  const sentences = sentencesOf(text)

  for (const check of CAREER_EVENT_CHECKS) {
    for (const re of check.draftPatterns) {
      const hitSentence = sentences.find((s) => re.test(s))
      if (!hitSentence) continue
      if (isOpinionFramedClaim(hitSentence)) continue
      if (sourceMentions(sourceText, check.sourceNeedles)) continue

      fabricated.push({
        id: check.id,
        label: check.label,
        excerpt: hitSentence.slice(0, 160),
      })
      break
    }
  }

  if (fabricated.length) {
    score = Math.min(score, 2.5)
    for (const f of fabricated.slice(0, 3)) {
      reasons.push(`Invented ${f.label} not in topic/desk brief`)
    }
    rewriteHints.push(
      'Drop fabricated career/news events — only assert what the desk brief supports',
    )
    rewriteHints.push(
      'Reframe as commentary/opinion on known facts, or ask a question instead of inventing news',
    )
  }

  // Soft: "breaking" / "just confirmed" energy with no desk brief at all
  if (
    !deskBrief.trim() &&
    /\b(breaking|just\s+confirmed|exclusive|medical\s+done|deal\s+done)\b/i.test(text) &&
    !/\b(breaking|just\s+confirmed|exclusive|medical|deal\s+done)\b/i.test(topic)
  ) {
    score -= 1.5
    reasons.push('Breaking/confirmed language without a desk brief')
    rewriteHints.push('Without sourced notes, avoid “breaking/confirmed” claims')
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))
  const pass = fabricated.length === 0 && score >= 6

  return {
    pass,
    score: fabricated.length ? Math.min(score, 3) : score,
    fabricated,
    reasons: reasons.slice(0, 5),
    rewriteHints: [...new Set(rewriteHints)].slice(0, 4),
  }
}

/**
 * Merge factuality gate into a judge verdict (after hot-take merge).
 * @param {object|null} verdict
 * @param {ReturnType<typeof scoreDraftFactuality>} fact
 */
export function mergeFactualityIntoVerdict(verdict, fact) {
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

  base.factuality = Number(fact?.score) || 0
  base.fabricated = Array.isArray(fact?.fabricated) ? fact.fabricated : []
  base.reasons = [...(base.reasons || []), ...(fact?.reasons || [])].slice(0, 8)
  base.rewriteHints = [...(base.rewriteHints || []), ...(fact?.rewriteHints || [])].slice(0, 7)

  if (fact && !fact.pass) {
    base.pass = false
    if (!base.overall || base.overall > fact.score) base.overall = fact.score
    if (!base.merit || base.merit > fact.score) base.merit = fact.score
  }

  return base
}
