import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  autoTuneDraftSettings,
  isAutoScriptMode,
} from '../backend/api/lib/eofScriptWriter.mjs'

describe('eof auto script quality', () => {
  it('detects auto mode', () => {
    assert.equal(isAutoScriptMode('auto'), true)
    assert.equal(isAutoScriptMode(''), true)
    assert.equal(isAutoScriptMode('groq'), false)
  })

  it('tunes cooler for news and warmer for debate', () => {
    const news = autoTuneDraftSettings({ format: 'news' })
    const debate = autoTuneDraftSettings({ format: 'debate' })
    assert.ok(news.draftTemperature < debate.draftTemperature)
    assert.ok(news.excellentMin >= 6)
  })

  it('raises temperature when directed or regenerating', () => {
    const base = autoTuneDraftSettings({ format: 'news' })
    const regen = autoTuneDraftSettings({ format: 'news', regenerate: true })
    const directed = autoTuneDraftSettings({ format: 'news', directorNote: 'Open angry' })
    assert.ok(regen.draftTemperature > base.draftTemperature)
    assert.ok(directed.draftTemperature > base.draftTemperature)
  })
})
