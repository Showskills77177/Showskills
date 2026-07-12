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

  it('Messi World Cup topics search Messi first, not generic World Cup stock', () => {
    const topic = 'Messi shines at World Cup 2026'
    const tokens = extractTopicImageTokens(topic)
    assert.ok(tokens[0] && /messi/i.test(tokens[0]), `expected Messi-first tokens, got ${tokens}`)
    const qs = buildSceneImageSearchQueries({ topic, sceneIndex: 0 })
    assert.ok(qs[0] && /messi/i.test(qs[0]), `first query should include Messi: ${qs[0]}`)
    assert.ok(!/^world cup/i.test(qs[0]))
    const good = scoreImageRelevance(topic, 'Lionel Messi Argentina World Cup celebration')
    const bad = scoreImageRelevance(topic, 'World Cup stadium crowd Mexico 2026')
    assert.ok(good > 5)
    assert.ok(bad < 0, `generic World Cup stock must be rejected, got ${bad}`)
  })
})
