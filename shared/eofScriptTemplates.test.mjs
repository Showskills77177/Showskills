import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildFactsShortScript, inferMusicMoodFromTopic } from './eofScriptTemplates.mjs'

describe('eofScriptTemplates', () => {
  it('builds five scenes for a player topic', () => {
    const script = buildFactsShortScript('Cristiano Ronaldo')
    assert.equal(script.scenes.length, 5)
    assert.match(script.title, /Ronaldo/)
    assert.ok(script.scenes.every((s) => s.narration && s.caption && s.imageQuery))
  })

  it('infers mood from topic keywords', () => {
    assert.equal(inferMusicMoodFromTopic('greatest goals'), 'dramatic')
    assert.equal(inferMusicMoodFromTopic('career history'), 'calm')
  })
})
