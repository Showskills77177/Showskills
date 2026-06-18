import { normalizeSkillAnswer } from './competitionSkillQuestions.mjs'

const NAME_PARTICLES = new Set([
  'van',
  'der',
  'de',
  'di',
  'da',
  'del',
  'la',
  'le',
  'von',
  'dos',
  'das',
  'the',
  'and',
  'fc',
])

/** Words that mean the accepted string is a stat/club phrase, not a person name. */
const NON_NAME_WORDS = new Set([
  'own',
  'goals',
  'goal',
  'titles',
  'title',
  'caps',
  'cap',
  'minutes',
  'minute',
  'mins',
  'seconds',
  'secs',
  'season',
  'seven',
  'six',
  'five',
  'four',
  'three',
  'nil',
  'draw',
  'final',
  'cup',
  'league',
  'champions',
  'european',
  'world',
  'states',
  'kingdom',
  'republic',
  'america',
  'scored',
  'scorer',
  'winner',
  'winning',
  'record',
  'fastest',
  'hat',
  'trick',
])

/**
 * When a club from a group appears in accepted answers, all aliases in that group are allowed.
 * Bare "united" / "city" only apply when that club is the expected answer for the question.
 */
const CLUB_ALIAS_GROUPS = [
  ['manchester united', 'man united', 'man utd', 'manchester', 'united'],
  ['manchester city', 'man city', 'city'],
  ['liverpool', 'lfc', 'liverpool fc'],
  ['real madrid', 'madrid', 'real'],
  ['barcelona', 'fc barcelona', 'barca'],
  ['chelsea', 'cfc'],
  ['leeds united', 'leeds'],
  ['tottenham hotspur', 'tottenham', 'spurs'],
  ['newcastle united', 'newcastle', 'newcastle utd'],
  ['west ham united', 'west ham'],
  ['arsenal', 'afc'],
  ['ac milan', 'milan'],
  ['inter milan', 'inter'],
  ['bayern munich', 'bayern'],
  ['borussia dortmund', 'dortmund', 'bvb'],
  ['atletico madrid', 'atletico'],
  ['juventus', 'juve'],
  ['paris saint germain', 'psg', 'paris'],
  ['wolverhampton wanderers', 'wolves', 'wolverhampton'],
  ['leicester city', 'leicester'],
  ['aston villa', 'villa'],
  ['everton', 'efc'],
  ['nottingham forest', 'forest'],
  ['crystal palace', 'palace'],
  ['brighton', 'brighton and hove albion', 'brighton hove albion'],
  ['bournemouth', 'afc bournemouth'],
  ['fulham', 'ffc'],
  ['burnley', 'bfc'],
  ['sheffield united', 'sheffield utd', 'blades'],
  ['west bromwich albion', 'west brom', 'wba'],
  ['coventry city', 'coventry'],
  ['blackburn rovers', 'blackburn'],
]

function compact(value) {
  return normalizeSkillAnswer(value).replace(/\s+/g, '')
}

function extractDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function significantTokens(value) {
  return normalizeSkillAnswer(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 || /^\d+$/.test(token))
}

function isLikelyPersonNamePhrase(raw) {
  const norm = normalizeSkillAnswer(raw)
  const tokens = significantTokens(raw).filter((token) => !NAME_PARTICLES.has(token))
  if (tokens.length < 2 || tokens.length > 6) return false
  if (tokens.some((token) => NON_NAME_WORDS.has(token) || /^\d+$/.test(token))) return false
  if (norm.endsWith(' states')) return false

  for (const group of CLUB_ALIAS_GROUPS) {
    const normalizedGroup = group.map((entry) => normalizeSkillAnswer(entry))
    if (normalizedGroup.includes(norm)) return false
  }

  return true
}

function isMultiPersonPhrase(raw) {
  return /\sand\s/i.test(String(raw || ''))
}

function isStatOrNumberPhrase(raw) {
  const norm = normalizeSkillAnswer(raw)
  const tokens = significantTokens(raw)
  if (!tokens.length) return true
  if (tokens.length === 1 && /^\d+$/.test(tokens[0])) return true
  if (tokens.some((token) => NON_NAME_WORDS.has(token))) return true
  if (/^\d+\s/.test(norm) || /\d+\s*(goals|titles|caps|secs|seconds|minutes)/.test(norm)) return true
  return false
}

function nameTokensFromPhrase(phrase) {
  return significantTokens(phrase).filter(
    (token) => !NAME_PARTICLES.has(token) && !NON_NAME_WORDS.has(token) && !/^\d+$/.test(token),
  )
}

function profileKey(tokens) {
  return tokens[tokens.length - 1] || tokens.join(' ')
}

/** Distinct people referenced across accepted answers (surnames / short names). */
function extractPersonProfiles(acceptedList) {
  const profiles = new Map()

  for (const raw of acceptedList || []) {
    if (typeof raw !== 'string' || !raw.trim() || isStatOrNumberPhrase(raw)) continue

    const chunks = isMultiPersonPhrase(raw) ? raw.split(/\s+and\s+/i) : [raw]

    for (const chunk of chunks) {
      const trimmed = chunk.trim()
      if (!trimmed || isStatOrNumberPhrase(trimmed)) continue

      const tokens = nameTokensFromPhrase(trimmed)
      if (!tokens.length || tokens.length > 5) continue

      const key = profileKey(tokens)
      const existing = profiles.get(key)
      if (existing) {
        for (const token of tokens) existing.tokens.add(token)
      } else {
        profiles.set(key, { key, tokens: new Set(tokens) })
      }
    }
  }

  return [...profiles.values()].map((profile) => ({
    key: profile.key,
    tokens: [...profile.tokens],
  }))
}

/** User gave two or more names (with typos) that map to different expected people. */
function matchAtLeastTwoPeople(userAnswer, profiles) {
  if (profiles.length < 2) return false

  const userTokens = nameTokensFromPhrase(userAnswer)
  if (userTokens.length < 2) return false

  const matched = new Set()
  for (const profile of profiles) {
    const hit = profile.tokens.some((profileToken) =>
      userTokens.some((userToken) => fuzzyTokenMatch(userToken, profileToken)),
    )
    if (hit) matched.add(profile.key)
  }

  return matched.size >= 2
}

function allowsTokenSplitMatch(raw) {
  if (isMultiPersonPhrase(raw)) return true
  if (isLikelyPersonNamePhrase(raw)) return true
  return significantTokens(raw).length === 1
}

function nameTokensFromAccepted(raw) {
  if (!isLikelyPersonNamePhrase(raw)) return []
  return significantTokens(raw).filter((token) => !NAME_PARTICLES.has(token) && !/^\d+$/.test(token))
}

function expandAcceptedWithNameParts(acceptedList) {
  const extras = new Set()
  for (const raw of acceptedList || []) {
    const tokens = nameTokensFromAccepted(raw)
    for (const token of tokens) {
      extras.add(token)
    }
  }
  return [...extras]
}

function expandAcceptedWithClubAliases(acceptedList) {
  const normalizedAccepted = new Set((acceptedList || []).map((raw) => normalizeSkillAnswer(raw)))
  const extras = new Set()

  for (const group of CLUB_ALIAS_GROUPS) {
    const normalizedGroup = group.map((entry) => normalizeSkillAnswer(entry))
    const active = normalizedGroup.some((entry) => normalizedAccepted.has(entry))
    if (!active) continue
    for (const alias of group) {
      extras.add(alias)
    }
  }

  return [...extras]
}

/** @param {string[]} acceptedList */
export function expandWorldCupBallAcceptedAnswers(acceptedList) {
  const base = Array.isArray(acceptedList) ? acceptedList : []
  const seen = new Set()
  const out = []

  for (const raw of [...base, ...expandAcceptedWithClubAliases(base), ...expandAcceptedWithNameParts(base)]) {
    const key = normalizeSkillAnswer(raw)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(typeof raw === 'string' ? raw : String(raw))
  }

  return out
}

function editDistance(a, b) {
  const x = compact(a)
  const y = compact(b)
  if (!x || !y) return Math.max(x.length, y.length)
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i)
  const curr = Array.from({ length: y.length + 1 }, () => 0)

  for (let i = 1; i <= x.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= y.length; j += 1) prev[j] = curr[j]
  }
  return prev[y.length]
}

function maxEditDistance(len) {
  if (len <= 3) return 1
  if (len <= 4) return 2
  if (len <= 8) return 3
  return Math.min(5, Math.floor(len / 3))
}

function fuzzyTokenMatch(userToken, acceptedToken) {
  if (!userToken || !acceptedToken) return false
  if (userToken === acceptedToken) return true

  const shorterLen = Math.min(userToken.length, acceptedToken.length)
  if (shorterLen <= 4 && userToken[0] !== acceptedToken[0]) return false

  const limit = maxEditDistance(Math.max(userToken.length, acceptedToken.length))
  if (editDistance(userToken, acceptedToken) <= limit) return true

  if (userToken.length >= 4 && acceptedToken.length >= 4) {
    if (acceptedToken.startsWith(userToken) || userToken.startsWith(acceptedToken)) return true
  }

  return false
}

function tokensMatch(userTokens, acceptedTokens) {
  return acceptedTokens.every((acceptedToken) =>
    userTokens.some((userToken) => fuzzyTokenMatch(userToken, acceptedToken)),
  )
}

function anyDistinctTokenMatches(userTokens, acceptedTokens) {
  if (!userTokens.length || !acceptedTokens.length) return false
  return userTokens.some((userToken) =>
    acceptedTokens.some((acceptedToken) => fuzzyTokenMatch(userToken, acceptedToken)),
  )
}

function shouldRequireTwoPeople(userAnswer, acceptedList) {
  const nameUserTokens = nameTokensFromPhrase(userAnswer)
  const profiles = extractPersonProfiles(acceptedList)
  return nameUserTokens.length >= 2 && profiles.length >= 2
}

function answerMatchesExpandedExact(userAnswer, expandedAccepted) {
  const normalized = normalizeSkillAnswer(userAnswer)
  const normalizedCompact = compact(userAnswer)
  if (!normalized) return false

  for (const raw of expandedAccepted) {
    const accepted = normalizeSkillAnswer(raw)
    if (!accepted) continue
    const acceptedCompact = compact(raw)
    if (normalized === accepted) return true

    const userIsDigits = /^\d+$/.test(normalizedCompact)
    const acceptedIsDigits = /^\d+$/.test(acceptedCompact)
    if (userIsDigits && acceptedIsDigits && normalizedCompact === acceptedCompact) return true

    const limit = maxEditDistance(Math.max(normalizedCompact.length, acceptedCompact.length))
    if (editDistance(normalized, accepted) <= limit) return true
    if (editDistance(normalizedCompact, acceptedCompact) <= limit) return true

    if (accepted.length >= 4 && normalized.includes(accepted)) return true
  }

  return false
}

/**
 * Lenient skill matching for the World Cup Ball quiz — minor spelling, first/last names,
 * and common club abbreviations allowed when they match the question's accepted answers.
 */
export function answerMatchesWorldCupBallAnswer(userAnswer, acceptedList) {
  const expandedAccepted = expandWorldCupBallAcceptedAnswers(acceptedList)
  if (answerMatchesExpandedExact(userAnswer, expandedAccepted)) return true

  const userNorm = normalizeSkillAnswer(userAnswer)
  const userCompact = compact(userAnswer)
  const userDigits = extractDigits(userAnswer)
  if (!userNorm) return false

  const userTokens = significantTokens(userAnswer)

  for (const raw of expandedAccepted) {
    const accepted = normalizeSkillAnswer(raw)
    if (!accepted) continue
    const acceptedCompact = compact(raw)
    const acceptedDigits = extractDigits(raw)
    const limit = maxEditDistance(Math.max(acceptedCompact.length, userCompact.length))

    if (acceptedDigits.length >= 2 && userDigits === acceptedDigits) return true
    if (acceptedDigits.length >= 3 && userDigits.endsWith(acceptedDigits)) return true

    if (editDistance(userNorm, accepted) <= limit) return true
    if (editDistance(userCompact, acceptedCompact) <= limit) return true

    const acceptedTokens = significantTokens(raw).filter((token) => !NAME_PARTICLES.has(token))
    if (allowsTokenSplitMatch(raw) && acceptedTokens.length > 0 && tokensMatch(userTokens, acceptedTokens)) {
      if (
        shouldRequireTwoPeople(userAnswer, acceptedList) &&
        !isMultiPersonPhrase(raw) &&
        acceptedTokens.length < 2
      ) {
        continue
      }
      return true
    }

    if (accepted.length >= 4 && userNorm.includes(accepted)) return true
  }

  const nameUserTokens = nameTokensFromPhrase(userAnswer)

  if (nameUserTokens.length === 1) {
    const solo = nameUserTokens[0]
    const exactPool = new Set(expandedAccepted.map((entry) => normalizeSkillAnswer(entry)))
    if (exactPool.has(solo)) return true

    const pool = [...expandAcceptedWithNameParts(acceptedList)]
    for (const raw of expandedAccepted) {
      if (!isLikelyPersonNamePhrase(raw)) continue
      for (const token of significantTokens(raw)) {
        if (!NAME_PARTICLES.has(token)) pool.push(token)
      }
    }
    const uniquePool = [...new Set(pool)]
    if (anyDistinctTokenMatches(nameUserTokens, uniquePool)) return true
  }

  const personProfiles = extractPersonProfiles(acceptedList)
  if (nameUserTokens.length >= 2 && personProfiles.length >= 2) {
    if (matchAtLeastTwoPeople(userAnswer, personProfiles)) return true
  }

  return false
}
