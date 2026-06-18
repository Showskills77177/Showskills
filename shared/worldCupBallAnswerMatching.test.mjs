import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  answerMatchesWorldCupBallAnswer,
  expandWorldCupBallAcceptedAnswers,
} from './worldCupBallAnswerMatching.mjs'

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

  it('accepts first-name-only answers for full names', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('Ryan', ['Ryan Giggs', 'Giggs']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('harry', ['Harry Kane', 'Kane']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('george', ['George Weah', 'Weah']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('Ole', ['Ole Gunnar Solskjær', 'Solskjaer']), true)
  })

  it('accepts common club abbreviations when that club is the answer', () => {
    const manUtd = ['Manchester United', 'Man United', 'Man Utd']
    assert.equal(answerMatchesWorldCupBallAnswer('united', manUtd), true)
    assert.equal(answerMatchesWorldCupBallAnswer('man united', manUtd), true)
    assert.equal(answerMatchesWorldCupBallAnswer('manchester', manUtd), true)

    const manCity = ['Manchester City', 'Man City']
    assert.equal(answerMatchesWorldCupBallAnswer('city', manCity), true)
    assert.equal(answerMatchesWorldCupBallAnswer('man city', manCity), true)

    const liverpool = ['Liverpool', 'Liverpool 6', '6 titles']
    assert.equal(answerMatchesWorldCupBallAnswer('LFC', liverpool), true)
    assert.equal(answerMatchesWorldCupBallAnswer('liverpool', liverpool), true)
  })

  it('accepts common scoreline variants', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('3 3', ['3-3', '3:3']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('nineteen ninety nine', ['1999', 'nineteen ninety nine']), true)
  })

  it('accepts two misspelled names when both people are correct', () => {
    const salahHaaland = [
      '32 goals',
      '32',
      'Mohamed Salah',
      'Erling Haaland',
      'Salah',
      'Haaland',
      'Salah and Haaland',
      'Haaland and Salah',
    ]
    assert.equal(answerMatchesWorldCupBallAnswer('Salsh and Haland', salahHaaland), true)
    assert.equal(answerMatchesWorldCupBallAnswer('mohamed salsh erling haland', salahHaaland), true)
    assert.equal(answerMatchesWorldCupBallAnswer('salsh haland', salahHaaland), true)

    const kluivertMilo = [
      'Patrick Kluivert and Savo Milošević',
      'Kluivert and Milošević',
      'Patrick Kluivert and Savo Milosevic',
      'Kluivert and Milosevic',
      'Patrick Kluivert',
      'Kluivert',
    ]
    assert.equal(answerMatchesWorldCupBallAnswer('Patrik Kluivert and Savo Milosevic', kluivertMilo), true)
    assert.equal(answerMatchesWorldCupBallAnswer('kluivert milosevic', kluivertMilo), true)

    assert.equal(answerMatchesWorldCupBallAnswer('Salsh and Terry', salahHaaland), false)
  })

  it('accepts answers regardless of capital letters', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('HARRY KANE', ['Harry Kane', 'Kane']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('mAn ChItY', ['Manchester City', 'Man City']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('lfc', ['Liverpool', 'LFC']), true)
    assert.equal(answerMatchesWorldCupBallAnswer('GEORGE WEAH', ['George Weah', 'Weah']), true)
  })

  it('rejects clearly wrong answers', () => {
    assert.equal(answerMatchesWorldCupBallAnswer('John Terry', ['Richard Dunne', 'Dunne']), false)
    assert.equal(answerMatchesWorldCupBallAnswer('Brazil', ['Liverpool', '6 titles']), false)
    assert.equal(answerMatchesWorldCupBallAnswer('city', ['Sevilla', 'Sevilla 7']), false)
    assert.equal(answerMatchesWorldCupBallAnswer('united', ['United States', 'USA']), false)
    assert.equal(answerMatchesWorldCupBallAnswer('Ryan', ['Harry Kane', 'Kane']), false)
  })

  it('expands club aliases only for matching clubs', () => {
    const expanded = expandWorldCupBallAcceptedAnswers(['Manchester United', 'Man Utd'])
    assert.ok(expanded.some((entry) => normalize(entry) === 'united'))
    assert.ok(expanded.some((entry) => normalize(entry) === 'manchester'))

    const usa = expandWorldCupBallAcceptedAnswers(['United States', 'USA'])
    assert.equal(usa.some((entry) => normalize(entry) === 'united'), false)
  })
})

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
