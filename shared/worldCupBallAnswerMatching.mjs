import { answerMatchesAccepted, normalizeSkillAnswer } from './competitionSkillQuestions.mjs'

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
  if (len <= 4) return 2
  if (len <= 8) return 3
  return Math.min(5, Math.floor(len / 3))
}

function tokensMatch(userTokens, acceptedTokens) {
  return acceptedTokens.every((acceptedToken) =>
    userTokens.some((userToken) => {
      if (userToken === acceptedToken) return true
      const limit = maxEditDistance(Math.max(userToken.length, acceptedToken.length))
      return editDistance(userToken, acceptedToken) <= limit
    }),
  )
}

/**
 * Lenient skill matching for the World Cup Ball quiz — minor spelling and grammar differences allowed.
 */
export function answerMatchesWorldCupBallAnswer(userAnswer, acceptedList) {
  if (answerMatchesAccepted(userAnswer, acceptedList)) return true

  const userNorm = normalizeSkillAnswer(userAnswer)
  const userCompact = compact(userAnswer)
  const userDigits = extractDigits(userAnswer)
  if (!userNorm) return false

  const userTokens = significantTokens(userAnswer)

  for (const raw of acceptedList || []) {
    const accepted = normalizeSkillAnswer(raw)
    if (!accepted) continue
    const acceptedCompact = compact(raw)
    const acceptedDigits = extractDigits(raw)
    const limit = maxEditDistance(Math.max(acceptedCompact.length, userCompact.length))

    if (acceptedDigits.length >= 2 && userDigits === acceptedDigits) return true
    if (acceptedDigits.length >= 3 && userDigits.endsWith(acceptedDigits)) return true

    if (editDistance(userNorm, accepted) <= limit) return true
    if (editDistance(userCompact, acceptedCompact) <= limit) return true

    const acceptedTokens = significantTokens(raw)
    if (acceptedTokens.length > 0 && tokensMatch(userTokens, acceptedTokens)) return true

    if (acceptedTokens.length >= 1 && userTokens.length >= 1) {
      const surname = acceptedTokens[acceptedTokens.length - 1]
      const userSurname = userTokens[userTokens.length - 1]
      if (surname.length >= 4 && editDistance(userSurname, surname) <= maxEditDistance(surname.length)) {
        return true
      }
    }

    if (accepted.length >= 4 && (userNorm.includes(accepted) || accepted.includes(userNorm))) return true
  }

  return false
}
