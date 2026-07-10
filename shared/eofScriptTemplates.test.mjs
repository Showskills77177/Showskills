import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildFactsShortScript,
  estimateCaptionDurationSec,
  inferMusicMoodFromTopic,
  normalizeEofScript,
  EOF_SCRIPT_FORMATS,
} from './eofScriptTemplates.mjs'

describe('eofScriptTemplates', () => {
  it('builds five scenes for a player topic', () => {
    const script = buildFactsShortScript('Cristiano Ronaldo')
    assert.equal(script.scenes.length, 5)
    assert.match(script.title, /Ronaldo/)
    assert.ok(script.scenes.every((s) => s.caption && s.imageQuery && s.durationSec > 0))
    assert.equal(script.format, 'news')
  })

  it('supports multiple formats', () => {
    for (const f of EOF_SCRIPT_FORMATS) {
      const script = buildFactsShortScript('Messi', { format: f.id })
      assert.equal(script.format, f.id)
      assert.equal(script.scenes.length, 5)
      assert.ok(script.scenes[0].role)
    }
  })

  it('estimates caption duration from reading time', () => {
    assert.ok(estimateCaptionDurationSec('Hi') >= 2.4)
    assert.ok(estimateCaptionDurationSec('one two three four five six seven eight') > 3)
  })

  it('normalizes loose AI-shaped scripts', () => {
    const n = normalizeEofScript({
      topic: 'Haaland',
      title: 'Haaland Short',
      scenes: [{ text: 'Machine in the box', image_query: 'Haaland goal' }, { caption: 'Premier League striker' }],
    })
    assert.equal(n.scenes.length, 2)
    assert.ok(n.scenes[0].imageQuery.includes('Haaland'))
  })

  it('infers mood from topic keywords', () => {
    assert.equal(inferMusicMoodFromTopic('greatest goals'), 'dramatic')
    assert.equal(inferMusicMoodFromTopic('career history'), 'calm')
  })
})
