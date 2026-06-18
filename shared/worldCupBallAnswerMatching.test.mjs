import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { answerMatchesWorldCupBallAnswer } from './worldCupBallAnswerMatching.mjs'

describe('worldCupBallAnswerMatching', () => {
  it('accepts minor spelling mistakes on player names', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('Goerge Weah', ['George Weah', 'Weah']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('ancelotti', ['Carlo Ancelotti', 'Ancelotti']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('solskjaer', ['Ole Gunnar Solskjær', 'Solskjaer']), true)
  })

  it('accepts surname-only answers for full names', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('Giggs', ['Ryan Giggs', 'Giggs']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('kane', ['Harry Kane', 'Kane']), true)
  })

  it('accepts common scoreline variants', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('3 3', ['3-3', '3:3']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('nineteen ninety nine', ['1999', 'nineteen ninety nine']), true)
  })

  it('rejects clearly wrong answers', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('John Terry', ['Richard Dunne', 'Dunne']), false)
    assert.equal(answerMatchesWorldCupBallAnswer('Brazil', ['Liverpool', '6 titles']), false)
  })
})
