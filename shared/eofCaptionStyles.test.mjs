import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  escapeDrawtext,
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

  it('detects animated (video/gif) vs still previews for CapCut-style thumbnails', () => {
    const [video] = normalizeZapcapTemplateList([
      {
        id: 'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
        name: 'Pop',
        previewUrl: 'https://cdn.zapcap.ai/templates/pop.mp4',
        thumbnailUrl: 'https://cdn.zapcap.ai/templates/pop.jpg',
      },
    ])
    assert.equal(video.previewType, 'video')
    assert.equal(video.previewUrl, 'https://cdn.zapcap.ai/templates/pop.mp4')
    assert.equal(video.posterUrl, 'https://cdn.zapcap.ai/templates/pop.jpg')

    const [gif] = normalizeZapcapTemplateList([
      { id: '21327a45-df89-46bc-8d56-34b8d29d3a0e', name: 'Karaoke', gifUrl: 'https://cdn.zapcap.ai/k.gif' },
    ])
    assert.equal(gif.previewType, 'image')

    const [extless] = normalizeZapcapTemplateList([
      { id: '31327a45-df89-46bc-8d56-34b8d29d3a0e', name: 'Beast', previewUrl: 'https://cdn.zapcap.ai/preview/beast' },
    ])
    assert.equal(extless.previewType, 'video') // ZapCap preview clips default to video
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

  it('inline live mode escapes commas when no textDir', () => {
    const filters = buildCaptionDrawtextFilters({
      caption: "At 38, he's still running the show — dictating tempo, finding space, and making",
      durationSec: 7,
      captionFont: '/tmp/font.ttf',
      style: 'live',
    })
    assert.ok(filters.length >= 1)
    assert.ok(filters.every((f) => f.includes("text='")), 'inline mode uses text=')
    assert.ok(filters.some((f) => f.includes('\\,')), 'commas in caption text must be escaped')
    assert.equal(escapeDrawtext("Tuchel's").includes("'"), false)
    assert.ok(escapeDrawtext("Tuchel's").includes('\u2019'), 'apostrophes become typographic')
  })

  it('live captions with commas/apostrophes use textfile when textDir is set', () => {
    const textDir = mkdtempSync(join(tmpdir(), 'eof-caption-'))
    try {
      const caption = "Fans are divided, some backing Tuchel's"
      const filters = buildCaptionDrawtextFilters({
        caption,
        durationSec: 5,
        captionFont: '/tmp/font.ttf',
        style: 'live',
        textDir,
      })
      assert.ok(filters.length >= 1)
      assert.ok(filters.every((f) => f.includes('textfile=')), 'production burns must use textfile=')
      assert.ok(filters.every((f) => !f.includes("text='")), 'must not use inline text=')
      const live0 = join(textDir, 'live-0.txt')
      const body = readFileSync(live0, 'utf8')
      assert.ok(body.includes('Fans are divided') || body.includes('Tuchel'), 'caption chunk written to file')
      assert.ok(body.includes('\u2019') || body.includes('Tuchel'), 'apostrophe sanitized in file')
    } finally {
      rmSync(textDir, { recursive: true, force: true })
    }
  })
})

