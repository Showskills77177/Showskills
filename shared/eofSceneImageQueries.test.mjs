import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractTopicImageTokens,
  buildSceneImageSearchQueries,
  scoreImageRelevance,
  defaultSceneImageQuery,
  sanitizeTopicForImageSearch,
  resolveImageSubject,
  anchorSceneImageQuery,
  imageAngleFromCaption,
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

  it('does not glue the year onto the name entity (Tuchel 2026)', () => {
    // Regression: "2026" was glued into the proper-noun run → required entity became
    // "Thomas Tuchel 2026", hard-rejecting real current photos titled "Thomas Tuchel England v Ghana 2026".
    const tokens = extractTopicImageTokens('Thomas Tuchel 2026')
    assert.ok(tokens.includes('Thomas Tuchel'), `expected clean name token, got ${JSON.stringify(tokens)}`)
    assert.ok(!tokens.some((t) => /tuchel\s+2026/i.test(t)), `year must not glue to name: ${JSON.stringify(tokens)}`)
    const current = scoreImageRelevance(
      'Thomas Tuchel 2026',
      'Thomas Tuchel England v Ghana 23 June 2026',
      'Thomas Tuchel 2026',
    )
    assert.ok(current > 5, `current on-topic photo must be accepted, got ${current}`)
  })

  it('prefers a current-year photo over an old one (rejects stale)', () => {
    const current = scoreImageRelevance('Thomas Tuchel', 'Thomas Tuchel England v Ghana 23 June 2026')
    const old = scoreImageRelevance('Thomas Tuchel', 'Thomas Tuchel coach Mainz05 at away match in Leverkusen 2014')
    assert.ok(current > old, `current (${current}) should beat old (${old})`)
    assert.ok(old < 6, `old 2014 photo should fall below the accept threshold, got ${old}`)
  })

  it('does not reject photos when topic and imageQuery repeat the same name', () => {
    // Regression: "Thomas Tuchel" + "Thomas Tuchel" glued into required entity
    // "Thomas Tuchel Thomas Tuchel" → hard-rejected every real Commons file.
    const score = scoreImageRelevance(
      'Thomas Tuchel',
      'Thomas Tuchel England v Ghana 23 June 2026-081.jpg',
      'Thomas Tuchel',
    )
    assert.ok(score >= 6, `repeated name must still accept current photo, got ${score}`)
  })

  it('strips quote soundbites so Tuchel headlines still resolve to Thomas Tuchel', () => {
    const topic = 'Thomas Tuchel: "We were sloppy, we were not fast enough"'
    assert.equal(sanitizeTopicForImageSearch(topic), 'Thomas Tuchel')
    assert.equal(resolveImageSubject(topic), 'Thomas Tuchel')
    const tokens = extractTopicImageTokens(topic)
    assert.ok(tokens.includes('Thomas Tuchel'), `tokens=${JSON.stringify(tokens)}`)
    assert.ok(!tokens.some((t) => /\bWe\b/.test(t)), `must not glue We onto name: ${JSON.stringify(tokens)}`)
    const score = scoreImageRelevance(topic, 'Thomas Tuchel England v Ghana 23 June 2026-081.jpg')
    assert.ok(score >= 6, `quoted headline must accept current photo, got ${score}`)
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

  it('anchors tactics/England caption beats to the lead coach', () => {
    const q = anchorSceneImageQuery({
      topic: 'Did Tuchel tactics cost England?',
      imageQuery: 'stadium crowd night lights',
      caption: 'Did his tactics cost England again?',
      sceneIndex: 1,
    })
    assert.match(q, /Tuchel/i)
    assert.match(q, /tactic|England/i)
    assert.equal(
      imageAngleFromCaption('Did his tactics cost England again?', 'Thomas Tuchel', true),
      'Thomas Tuchel tactics board',
    )
  })

  it('resolves Rooney topics to Wayne Rooney and keeps career match photos', () => {
    assert.equal(resolveImageSubject('Rooney returns to Old Trafford'), 'Wayne Rooney')
    assert.equal(resolveImageSubject('Wayne Rooney Everton legend'), 'Wayne Rooney')
    // Lead speaker wins over a secondary star named later in the headline.
    assert.equal(resolveImageSubject('Rooney on Ronaldo service'), 'Wayne Rooney')
    assert.equal(resolveImageSubject('Wayne Rooney says Ronaldo is the problem'), 'Wayne Rooney')
    const career = scoreImageRelevance(
      'Wayne Rooney',
      'Wayne Rooney Manchester United Champions League final 2008',
    )
    assert.ok(career >= 6, `career Rooney photo must stay usable, got ${career}`)
  })
})
