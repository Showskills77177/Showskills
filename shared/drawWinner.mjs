import { randomInt } from 'node:crypto'

/**
 * Pick one draw slot uniformly at random (each ticket number = one slot).
 * More tickets for an entrant means more slots → higher win probability.
 *
 * @param {readonly T[]} pool
 * @param {(max: number) => number} [rng] max is exclusive upper bound
 * @returns {T | null}
 */
export function pickDrawWinner(pool, rng = randomInt) {
  if (!Array.isArray(pool) || pool.length === 0) return null
  const index = rng(pool.length)
  return pool[index] ?? null
}
