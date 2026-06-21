/** Questions about events in 1980 or earlier use six-option multiple choice. */
export const WORLD_CUP_BALL_HISTORICAL_MAX_YEAR = 1980
export const WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT = 6

export function extractFourDigitYears(text) {
  const m = String(text || '').match(/\b(19[0-9]{2})\b/g)
  return m ? m.map(Number) : []
}

/** True when the question is anchored to 1980 or earlier (prompt or year-only answers). */
export function isWorldCupBallHistoricalQuestion(question) {
  if (!question?.prompt) return false
  const promptYears = extractFourDigitYears(question.prompt)
  const answerYears = (question.acceptedAnswers || []).flatMap(extractFourDigitYears)

  if (promptYears.length && Math.min(...promptYears) <= WORLD_CUP_BALL_HISTORICAL_MAX_YEAR) {
    return true
  }
  if (
    /which year|what year|in what year/i.test(question.prompt) &&
    answerYears.length &&
    Math.max(...answerYears) <= WORLD_CUP_BALL_HISTORICAL_MAX_YEAR
  ) {
    return true
  }
  if (
    !promptYears.some((y) => y > WORLD_CUP_BALL_HISTORICAL_MAX_YEAR) &&
    answerYears.length &&
    !answerYears.some((y) => y > WORLD_CUP_BALL_HISTORICAL_MAX_YEAR)
  ) {
    return true
  }
  return false
}

function primaryChoiceLabel(question) {
  const list = (question.acceptedAnswers || []).filter(
    (entry) => typeof entry === 'string' && entry.trim(),
  )
  const named = list.find((entry) => !/^\d+$/.test(entry.trim()) && entry.length > 2)
  if (named) return named.trim()
  return list[0]?.trim() || ''
}

function padToSix(existing, correct) {
  const out = []
  const seen = new Set()
  for (const entry of [correct, ...(existing || [])]) {
    const v = String(entry || '').trim()
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
  }
  return out.slice(0, WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT)
}

/** Six options per historical question key (correct answer must appear in acceptedAnswers). */
export const WORLD_CUP_BALL_HISTORICAL_CHOICES_BY_KEY = {
  q4: ['Lev Yashin', 'Gianluigi Buffon', 'Manuel Neuer', 'Iker Casillas', 'Dino Zoff', 'Peter Schmeichel'],
  q23: ['Pierino Prati', 'Ferenc Puskás', 'Alfredo Di Stéfano', 'Héctor Rial', 'Paco Gento', 'Raymond Kopa'],
  q24: ['1977', '1978', '1984', '1981', '1973', '1986'],
  q30: ['1966', '1962', '1970', '1958', '1954', '1964'],
  q36: ['Real Madrid', 'Bayern Munich', 'Ajax', 'Liverpool', 'AC Milan', 'Benfica'],
  q51: ['Uruguay', 'Brazil', 'Italy', 'Argentina', 'France', 'England'],
  q53: ['Chile', 'Brazil', 'Argentina', 'Mexico', 'Uruguay', 'Colombia'],
  q64: ['Argentina', 'Brazil', 'Mexico', 'Spain', 'West Germany', 'Italy'],
  q77: ['Lev Yashin', 'Gianluigi Buffon', 'Manuel Neuer', 'Iker Casillas', 'Dino Zoff', 'Peter Schmeichel'],
  q78: ['Wembley Stadium', 'Azteca Stadium', 'Maracanã', 'Olympiastadion', 'Santiago Bernabéu', 'San Siro'],
  q79: ['Geoff Hurst', 'Bobby Charlton', 'Martin Peters', 'Roger Hunt', 'Pelé', 'Eusébio'],
  q85: ['Soviet Union', 'Spain', 'France', 'Yugoslavia', 'Czechoslovakia', 'Italy'],
  q96: ['Hungary', 'West Germany', 'Brazil', 'Uruguay', 'Austria', 'Argentina'],
  q99: ['West Germany', 'Netherlands', 'Brazil', 'Poland', 'Sweden', 'Italy'],
  q101: ['Uruguay', 'Brazil', 'Italy', 'England', 'Hungary', 'Sweden'],
  q135: ['Gerd Müller', 'Johan Cruyff', 'Paul Breitner', 'Franz Beckenbauer', 'Johan Neeskens', 'Rob Rensenbrink'],
  q147: ['Johnny Rep', 'Ruud Geels', 'Johan Cruyff', 'Piet Keizer', 'Willem van Hanegem', 'Arie Haan'],
  q151: ['Brazil', 'Sweden', 'France', 'West Germany', 'Italy', 'Argentina'],
  q155: ['Mexico', 'Brazil', 'Argentina', 'Italy', 'West Germany', 'Spain'],
  q157: ['Soviet Union', 'France', 'Spain', 'Yugoslavia', 'Czechoslovakia', 'Portugal'],
  q160: ['Czechoslovakia', 'West Germany', 'Netherlands', 'France', 'Yugoslavia', 'Belgium'],
  q164: ['Sweden', 'Brazil', 'France', 'West Germany', 'Soviet Union', 'Argentina'],
  q171: ['Argentina', 'Netherlands', 'Brazil', 'Italy', 'West Germany', 'Poland'],
  q172: ['Mario Kempes', 'Rob Rensenbrink', 'Teófilo Cubillas', 'Leopoldo Luque', 'Dirceu', 'Hans Klinkhammer'],
  q181: ['West Germany', 'Belgium', 'Netherlands', 'Italy', 'Czechoslovakia', 'France'],
  q185: ['Antonín Panenka', 'Uli Hoeneß', 'Franz Beckenbauer', 'Sepp Maier', 'Jaroslav Pollák', 'Zdeněk Nehoda'],
  q186: ['England', 'West Germany', 'France', 'Spain', 'Italy', 'Mexico'],
  q192: ['England', 'West Germany', 'Portugal', 'Soviet Union', 'Argentina', 'France'],
  q197: ['Liverpool', 'Borussia Mönchengladbach', 'Bayern Munich', 'Ajax', 'Juventus', 'Celtic'],
  q198: ['Tommy Smith', 'Phil Neal', 'Terry McDermott', 'Kenny Dalglish', 'Ray Kennedy', 'Jimmy Case'],
  q203: ['Tottenham Hotspur', 'Wolverhampton Wanderers', 'Liverpool', 'Arsenal', 'Manchester United', 'Feyenoord'],
  q205: ['Spain', 'Soviet Union', 'Hungary', 'Denmark', 'France', 'Italy'],
  q207: ['Horst Hrubesch', 'Klaus Allofs', 'Karl-Heinz Rummenigge', 'Bernd Schuster', 'Hans Müller', 'Felix Magath'],
  q208: ['West Germany', 'Netherlands', 'Argentina', 'Brazil', 'Spain', 'Italy'],
  q209: ['Manchester United', 'Benfica', 'Real Madrid', 'Ajax', 'AC Milan', 'Celtic'],
  q210: ['George Best', 'Bobby Charlton', 'Brian Kidd', 'Jaime Graça', 'John Aston', 'Bill Foulkes'],
  q211: ['Italy', 'Brazil', 'Hungary', 'France', 'Czechoslovakia', 'Argentina'],
  q212: ['Mario Kempes', 'Rob Rensenbrink', 'Teófilo Cubillas', 'Leopoldo Luque', 'Dirceu', 'Hans Klinkhammer'],
  q216: ['Eintracht Frankfurt', 'Borussia Mönchengladbach', 'Ipswich Town', 'Arsenal', 'FC Köln', 'Hamburg'],
  q217: ['West Germany', 'Soviet Union', 'Belgium', 'Hungary', 'Italy', 'Netherlands'],
  q218: ['Gerd Müller', 'Franz Beckenbauer', 'Uli Hoeneß', 'Paul Breitner', 'Jürgen Grabowski', 'Horst Hrubesch'],
  q221: ['Sweden', 'Switzerland', 'Brazil', 'France', 'West Germany', 'Chile'],
  q229: ['Yugoslavia', 'France', 'Italy', 'Czechoslovakia', 'Belgium', 'West Germany'],
  q231: ['Italy', 'Czechoslovakia', 'Austria', 'Germany', 'Hungary', 'Netherlands'],
  q240: ['West Germany', 'Hungary', 'Austria', 'Uruguay', 'Brazil', 'England'],
  q241: ['Hungary', 'Austria', 'Brazil', 'Uruguay', 'Sweden', 'Yugoslavia'],
  q244: ['Italy', 'France', 'Switzerland', 'Germany', 'Austria', 'Brazil'],
  q248: ['Italy', 'Yugoslavia', 'England', 'Soviet Union', 'West Germany', 'Belgium'],
  q251: ['Feyenoord', 'Celtic', 'Ajax', 'Benfica', 'AC Milan', 'Panathinaikos'],
  q263: ['Geoff Hurst', 'Bobby Charlton', 'Martin Peters', 'Roger Hunt', 'Pelé', 'Franz Beckenbauer'],
}

export function worldCupBallChoiceOptionLabel(count) {
  if (count === 6) return 'six options'
  if (count === 4) return 'four options'
  if (count === 1) return 'one option'
  return `${count} options`
}

/**
 * Apply six-option multiple choice to historical (≤1980) questions.
 * @param {Array<{ questionKey: string, prompt: string, acceptedAnswers: string[], choices?: string[] }>} bank
 */
export function enrichWorldCupBallHistoricalChoices(bank) {
  return bank.map((question) => {
    if (!isWorldCupBallHistoricalQuestion(question)) return question

    const mapped = WORLD_CUP_BALL_HISTORICAL_CHOICES_BY_KEY[question.questionKey]
    const correct = primaryChoiceLabel(question)
    let choices = mapped ? padToSix(mapped, correct) : padToSix(question.choices, correct)

    if (choices.length < WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT && question.choices?.length) {
      choices = padToSix(question.choices, correct)
    }

    while (choices.length < WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT) {
      choices.push(`Option ${choices.length + 1}`)
    }

    return { ...question, choices: choices.slice(0, WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT) }
  })
}
