import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_CAPTION_STYLES,
  EOF_DEFAULT_CAPTION_STYLE,
  resolveEofCaptionStyle,
  getEofCaptionStyle,
} from './eofCaptionStyles.mjs'
import {
  buildWordBeats,
  buildCaptionDrawtextFilters,
} from '../backend/api/lib/eofTikTokCaptions.mjs'

describe('eofCaptionStyles', () => {
  it('exposes CapCut styles plus Off', () => {
    assert.ok(EOF_CAPTION_STYLES.length >= 3)
    assert.deepEqual(
      EOF_CAPTION_STYLES.map((s) => s.id).sort(),
      ['beast', 'karaoke', 'off', 'pop'],
    )
    assert.equal(EOF_DEFAULT_CAPTION_STYLE, 'pop')
    assert.equal(resolveEofCaptionStyle('off'), 'off')
    assert.equal(resolveEofCaptionStyle('none'), 'off')
  })

  it('resolves unknown styles to default', () => {
    assert.equal(resolveEofCaptionStyle('nope'), 'pop')
    assert.equal(getEofCaptionStyle('beast').label.includes('Beast'), true)
  })
})

describe('caption drawtext builders', () => {
  it('builds timed word beats', () => {
    const beats = buildWordBeats('Spain beat Belgium last night', 5)
    assert.ok(beats.length >= 4)
    assert.ok(beats[0].start < beats[beats.length - 1].end)
  })

  it('emits drawtext for each style', () => {
    for (const id of ['pop', 'karaoke', 'beast']) {
      const filters = buildCaptionDrawtextFilters({
        caption: 'Rooney is right about Ronaldo',
        durationSec: 4,
        captionFont: '/tmp/font.ttf',
        style: id,
      })
      assert.ok(filters.length >= 2, `${id} should emit filters`)
      assert.ok(filters.every((f) => f.startsWith('drawtext=')), `${id} filters must be drawtext`)
    }
  })
})
