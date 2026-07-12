import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractTopicImageTokens,
  buildSceneImageSearchQueries,
  scoreImageRelevance,
  defaultSceneImageQuery,
} from './eofSceneImageQueries.mjs'

describe('eofSceneImageQueries', () => {
  it('extracts topic tokens from headlines', () => {
    const tokens = extractTopicImageTokens('Cristiano Ronaldo scores for Al Nassr')
    assert.ok(tokens.some((t) => /ronaldo/i.test(t)))
    assert.ok(tokens.some((t) => /nassr/i.test(t)))
  })

  it('puts topic-specific queries before generics', () => {
    const qs = buildSceneImageSearchQueries({
      topic: 'Vinicius Jr Real Madrid',
      imageQuery: 'Vinicius Jr celebrating goal football',
      sceneIndex: 0,
    })
    assert.equal(qs[0], 'Vinicius Jr celebrating goal football')
    assert.ok(qs.some((q) => /Vinicius|Real Madrid/i.test(q) && /\d{4}|latest/i.test(q)))
    assert.ok(!qs[0].includes('stadium crowd'))
  })

  it('scores relevance and penalises NFL', () => {
    assert.ok(scoreImageRelevance('Ronaldo', 'Cristiano Ronaldo celebrating football') > 5)
    assert.ok(scoreImageRelevance('Ronaldo', 'NFL american football draft') < 0)
  })

  it('treats Tuchel as a coach, not a player', () => {
    const qs = buildSceneImageSearchQueries({ topic: 'Thomas Tuchel', sceneIndex: 0 })
    assert.ok(qs.some((q) => /manager|coach/i.test(q)))
    assert.ok(!qs.some((q) => /football player/i.test(q)))
    const angle = defaultSceneImageQuery('Thomas Tuchel', 0)
    assert.match(angle, /manager|coach|sideline|press|training/i)
  })

  it('boosts current-year + name hits for coaches', () => {
    const year = new Date().getFullYear()
    const good = scoreImageRelevance(
      'Thomas Tuchel',
      `Thomas Tuchel England manager press conference ${year}`,
    )
    const old = scoreImageRelevance('Thomas Tuchel', 'Dortmund throwback 2013 archive')
    assert.ok(good > old)
  })

  it('defaultSceneImageQuery stays on-topic', () => {
    const q = defaultSceneImageQuery('Erling Haaland', 0)
    assert.match(q, /Haaland/i)
    assert.match(q, /football|match|celebrating|press|training/i)
  })
})
