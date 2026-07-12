import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_CAPTION_STYLES,
  EOF_DEFAULT_CAPTION_STYLE,
  resolveEofCaptionStyle,
  getEofCaptionStyle,
  isLocalCaptionStyle,
  isZapcapCaptionStyle,
  normalizeZapcapTemplateId,
} from './eofCaptionStyles.mjs'
import {
  buildWordBeats,
  buildCaptionDrawtextFilters,
} from '../backend/api/lib/eofTikTokCaptions.mjs'
import { normalizeZapcapTemplateList } from '../backend/api/lib/eofZapcapCaptions.mjs'

describe('eofCaptionStyles', () => {
  it('exposes free live + ZapCap + CapCut shortcuts + Off', () => {
    assert.ok(EOF_CAPTION_STYLES.length >= 5)
    assert.deepEqual(
      EOF_CAPTION_STYLES.map((s) => s.id).sort(),
      ['beast', 'karaoke', 'live', 'off', 'pop', 'zapcap'],
    )
    assert.equal(EOF_DEFAULT_CAPTION_STYLE, 'live')
    assert.equal(resolveEofCaptionStyle('off'), 'off')
    assert.equal(resolveEofCaptionStyle('none'), 'off')
    assert.equal(resolveEofCaptionStyle('subs'), 'live')
    assert.equal(resolveEofCaptionStyle('zapcap'), 'zapcap')
    assert.equal(
      resolveEofCaptionStyle('ca050348-e2d0-49a7-9c75-7a5e8335c67d'),
      'zapcap',
    )
    assert.equal(isLocalCaptionStyle('live'), true)
    assert.equal(isZapcapCaptionStyle('zapcap'), true)
    assert.equal(isZapcapCaptionStyle('pop'), true)
    assert.equal(isLocalCaptionStyle('pop'), false)
    assert.equal(
      normalizeZapcapTemplateId('ca050348-e2d0-49a7-9c75-7a5e8335c67d'),
      'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
    )
    assert.equal(normalizeZapcapTemplateId('nope'), '')
  })

  it('resolves unknown styles to default', () => {
    assert.equal(resolveEofCaptionStyle('nope'), 'live')
    assert.equal(getEofCaptionStyle('beast').label.includes('Beast'), true)
  })
})

describe('zapcap template catalog normalize', () => {
  it('maps ZapCap API rows', () => {
    const list = normalizeZapcapTemplateList([
      { id: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d', name: 'Hormozi', category: 'Classic' },
      { templateId: 'not-a-uuid', name: 'Bad' },
      { id: '21327a45-df89-46bc-8d56-34b8d29d3a0e', title: 'Tracy' },
    ])
    assert.equal(list.length, 2)
    assert.ok(list.some((t) => t.name === 'Hormozi'))
    assert.ok(list.some((t) => t.name === 'Tracy'))
  })
})

describe('caption drawtext builders', () => {
  it('builds timed word beats', () => {
    const beats = buildWordBeats('Spain beat Belgium last night', 5)
    assert.ok(beats.length >= 4)
    assert.ok(beats[0].start < beats[beats.length - 1].end)
  })

  it('emits drawtext for each style', () => {
    for (const id of ['live', 'pop', 'karaoke', 'beast']) {
      const filters = buildCaptionDrawtextFilters({
        caption: 'Rooney is right about Ronaldo',
        durationSec: 4,
        captionFont: '/tmp/font.ttf',
        style: id,
      })
      assert.ok(filters.length >= 1, `${id} should emit filters`)
      assert.ok(filters.every((f) => f.startsWith('drawtext=')), `${id} filters must be drawtext`)
    }
  })

  it('places live subs near the bottom', () => {
    const filters = buildCaptionDrawtextFilters({
      caption: 'Spain beat Belgium last night in a thriller',
      durationSec: 5,
      captionFont: '/tmp/font.ttf',
      style: 'live',
    })
    assert.ok(filters.some((f) => f.includes('y=h*0.78')))
  })

  it('escapes commas and apostrophes in live captions', () => {
    const filters = buildCaptionDrawtextFilters({
      caption: "At 38, he's still running the show — dictating tempo, finding space, and making",
      durationSec: 7,
      captionFont: '/tmp/font.ttf',
      style: 'live',
    })
    assert.ok(filters.length >= 1)
    assert.ok(filters.some((f) => f.includes('\\,')), 'commas in caption text must be escaped')
    assert.ok(filters.some((f) => f.includes("\\'")), 'apostrophes must be escaped')
  })
})
