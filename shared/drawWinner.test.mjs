import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickDrawWinner } from './drawWinner.mjs'

test('pickDrawWinner returns null for empty pool', () => {
  assert.equal(pickDrawWinner([]), null)
})

test('pickDrawWinner returns the only slot', () => {
  const slot = { ticketNumber: 'SS-0001' }
  assert.deepEqual(pickDrawWinner([slot], () => 0), slot)
})

test('pickDrawWinner uses rng index', () => {
  const pool = [{ n: 'a' }, { n: 'b' }, { n: 'c' }]
  assert.equal(pickDrawWinner(pool, () => 2)?.n, 'c')
})
