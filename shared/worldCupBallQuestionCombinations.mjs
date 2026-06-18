/** Target number of unique question sets served across quiz attempts. */
export const WORLD_CUP_BALL_COMBINATION_TARGET = 300

function hashSeed(seed) {
  let h = 2166136261
  const text = String(seed)
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededShuffle(items, seed) {
  const arr = [...items]
  let state = hashSeed(seed)
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Binomial coefficient n choose k (exact for small football-quiz pool sizes). */
export function combinationCount(n, k) {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  const r = Math.min(k, n - k)
  let result = 1
  for (let i = 1; i <= r; i += 1) {
    result = (result * (n - r + i)) / i
  }
  return Math.round(result)
}

/** @param {string[]} questionKeys @param {Map<string, string>} [exclusionGroupByKey] */
export function combinationHasExclusionConflict(questionKeys, exclusionGroupByKey) {
  if (!exclusionGroupByKey?.size) return false
  const seenGroups = new Set()
  for (const key of questionKeys) {
    const group = exclusionGroupByKey.get(key)
    if (!group) continue
    if (seenGroups.has(group)) return true
    seenGroups.add(group)
  }
  return false
}

/** @param {string[]} questionKeys */
export function combinationHasDuplicateKeys(questionKeys) {
  return new Set(questionKeys).size !== questionKeys.length
}

function keyConflictsWithPicked(picked, key, exclusionGroupByKey) {
  if (picked.includes(key)) return true
  const group = exclusionGroupByKey?.get(key)
  if (!group) return false
  return picked.some((pickedKey) => exclusionGroupByKey.get(pickedKey) === group)
}

/**
 * @param {string[]} poolKeys
 * @param {number} pickCount
 * @param {number|string} seed
 * @param {{ exclusionGroupByKey?: Map<string, string>, choiceKeys?: Set<string>, minChoiceCount?: number }} options
 * @returns {string[] | null}
 */
export function buildOneWorldCupBallCombination(poolKeys, pickCount, seed, options = {}) {
  const { exclusionGroupByKey, choiceKeys, minChoiceCount = 0 } = options
  const picked = []
  const minChoices = Math.max(0, minChoiceCount)

  if (minChoices > 0 && choiceKeys?.size) {
    const mcPool = seededShuffle(
      poolKeys.filter((key) => choiceKeys.has(key)),
      `wc-ball-mc-${seed}`,
    )
    for (const key of mcPool) {
      if (picked.length >= minChoices) break
      if (keyConflictsWithPicked(picked, key, exclusionGroupByKey)) continue
      picked.push(key)
    }
    if (picked.length < minChoices) return null
  }

  const restPool = seededShuffle(
    poolKeys.filter((key) => !picked.includes(key)),
    `wc-ball-rest-${seed}`,
  )
  for (const key of restPool) {
    if (picked.length >= pickCount) break
    if (keyConflictsWithPicked(picked, key, exclusionGroupByKey)) continue
    picked.push(key)
  }

  return picked.length === pickCount ? picked : null
}

/**
 * Build up to `targetCount` unique question-key combinations of length `pickCount`.
 * @param {string[]} poolKeys
 * @param {number} pickCount
 * @param {number} targetCount
 * @param {{ exclusionGroupByKey?: Map<string, string>, choiceKeys?: Set<string>, minChoiceCount?: number }} [options]
 */
export function buildWorldCupBallCombinations(poolKeys, pickCount, targetCount, options = {}) {
  const { exclusionGroupByKey } = options
  const keys = [...new Set(poolKeys)]
  if (keys.length < pickCount) {
    throw new Error(`World Cup Ball question pool (${keys.length}) is smaller than quiz length (${pickCount})`)
  }
  if (keys.length === pickCount) {
    if (combinationHasDuplicateKeys(keys)) {
      throw new Error('World Cup Ball question pool contains duplicate keys')
    }
    if (combinationHasExclusionConflict(keys, exclusionGroupByKey)) {
      throw new Error('World Cup Ball question pool cannot form a valid quiz without repeating subjects')
    }
    return [keys]
  }

  const maxPossible = combinationCount(keys.length, pickCount)
  const goal = Math.min(targetCount, maxPossible)
  const combos = []
  const seen = new Set()
  let seed = 0
  const maxAttempts = Math.max(goal * 15000, 10000)

  while (combos.length < goal && seed < maxAttempts) {
    const picked = buildOneWorldCupBallCombination(keys, pickCount, seed, options)
    if (!picked) {
      seed += 1
      continue
    }
    const signature = [...picked].sort().join('|')
    if (!seen.has(signature)) {
      seen.add(signature)
      combos.push(picked)
    }
    seed += 1
  }

  return combos
}
