export const PAID_SKILL_QUESTIONS = [
  {
    id: 'q1',
    prompt:
      'Against which team did Cristiano Ronaldo make his Manchester United debut, and what was the final score?',
  },
  {
    id: 'q2',
    prompt: 'Which player did Cristiano Ronaldo replace when he came on during his Manchester United debut?',
  },
  {
    id: 'q3',
    prompt:
      'In which minute did Cristiano Ronaldo score his first goal in his second debut vs Newcastle United in 2021?',
  },
]

function normalizeAnswer(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compact(value) {
  return normalizeAnswer(value).replace(/\s+/g, '')
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
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      )
    }
    for (let j = 0; j <= y.length; j += 1) prev[j] = curr[j]
  }
  return prev[y.length]
}

function closeTo(value, target, maxDistance = 2) {
  return editDistance(value, target) <= maxDistance
}

function hasCloseWord(answer, target, maxDistance = 2) {
  const words = normalizeAnswer(answer).split(/\s+/).filter(Boolean)
  return words.some((word) => closeTo(word, target, maxDistance))
}

function hasFourNilScore(answer) {
  const n = normalizeAnswer(answer)
  const c = compact(answer)
  return (
    /\b4\s*[-:]\s*0\b/.test(n) ||
    /\b4\s*0\b/.test(n) ||
    /\b4\s*(nil|nill|nell|zero|nothing)\b/.test(n) ||
    /\b(four|for)\s*[-:]?\s*(nil|nill|nell|zero|nothing)\b/.test(n) ||
    /\b4\s*to\s*0\b/.test(n) ||
    c.includes('4nil') ||
    c.includes('4nill') ||
    c.includes('4nell') ||
    c.includes('fournil') ||
    c.includes('fournill') ||
    c.includes('40') ||
    c.includes('4to0')
  )
}

function isBoltonAnswer(answer) {
  const n = normalizeAnswer(answer)
  return (
    n.includes('bolton') ||
    hasCloseWord(answer, 'bolton', 2) ||
    closeTo(n, 'bolton wanderers', 4) ||
    closeTo(compact(answer), 'boltonwanderers', 4)
  )
}

function isManchesterUnitedDebutContext(answer) {
  const n = normalizeAnswer(answer)
  const c = compact(answer)
  return (
    n.includes('manchester united') ||
    n.includes('man utd') ||
    n.includes('manu') ||
    c.includes('manchesterunited') ||
    c.includes('manutd')
  )
}

/** Q1: Bolton and/or 4–0 — either part alone is accepted. */
function isDebutMatchAnswer(answer) {
  const hasBolton = isBoltonAnswer(answer)
  const hasScore = hasFourNilScore(answer)
  if (hasBolton || hasScore) return true
  if (isManchesterUnitedDebutContext(answer) && (hasBolton || hasScore)) return true
  return false
}

function isNickyButtAnswer(answer) {
  const n = normalizeAnswer(answer)
  const c = compact(answer)
  const hasFirst =
    n.includes('nicky') ||
    n.includes('nicki') ||
    n.includes('nikki') ||
    n.includes('nick') ||
    n.includes('nicholas') ||
    n.includes('nicolas') ||
    hasCloseWord(answer, 'nicky', 2) ||
    hasCloseWord(answer, 'nick', 1) ||
    hasCloseWord(answer, 'nicholas', 3)
  const hasLast =
    n.includes('butt') ||
    /\bbut\b/.test(n) ||
    hasCloseWord(answer, 'butt', 1)

  if ((hasFirst && hasLast) || closeTo(c, 'nickybutt', 3) || closeTo(c, 'nickbutt', 2) || closeTo(c, 'nicholasbutt', 3)) {
    return true
  }
  if (hasLast && !n.includes('ronaldo') && !n.includes('cristiano')) {
    const words = n.split(/\s+/).filter(Boolean)
    if (words.length <= 4) return true
  }
  return false
}

/**
 * Q3: minute 47 only is enough (no need to mention Newcastle).
 * Accepts 47, 47th, forty-seven, 047, etc.
 */
function isFortySeventhMinuteAnswer(answer) {
  const raw = String(answer || '').trim()
  if (!raw) return false

  const digitsOnly = raw.replace(/\D/g, '')
  if (digitsOnly === '47' || digitsOnly === '047' || Number.parseInt(digitsOnly, 10) === 47) {
    return true
  }

  const n = normalizeAnswer(answer)
  const c = compact(answer)

  if (
    /\b0*47\b/.test(n) ||
    c === '47' ||
    c.startsWith('47th') ||
    c.includes('47th') ||
    c.includes('47min') ||
    c.includes('47mins') ||
    c.includes('47minute') ||
    c.includes('47minutes') ||
    n.includes('forty seven') ||
    n.includes('fortyseven') ||
    n.includes('forty seventh') ||
    n.includes('fortyseventh') ||
    closeTo(c, '47thminute', 3) ||
    closeTo(c, 'fortyseventh', 3) ||
    closeTo(c, 'fortyseven', 2)
  ) {
    return true
  }

  if (n.includes('newcastle') && /\b0*47\b/.test(n)) return true

  return false
}

export function validatePaidSkillAnswers(a1, a2, a3) {
  const q1 = isDebutMatchAnswer(a1)
  const q2 = isNickyButtAnswer(a2)
  const q3 = isFortySeventhMinuteAnswer(a3)

  return { allCorrect: q1 && q2 && q3, q1, q2, q3 }
}
