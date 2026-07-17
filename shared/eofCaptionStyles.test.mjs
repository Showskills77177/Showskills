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
  isBottomBarCaptionStyle,
  captionBottomPlateMode,
  resolveFreeLocalBurnStyle,
  normalizeZapcapTemplateId,
  listEofCaptionStyles,
} from './eofCaptionStyles.mjs'
import { buildWordBeats } from './eofCaptionBeats.mjs'
import {
  buildCaptionDrawtextFilters,
  escapeDrawtext,
} from '../backend/api/lib/eofTikTokCaptions.mjs'
import { normalizeZapcapTemplateList } from '../backend/api/lib/eofZapcapCaptions.mjs'

describe('eofCaptionStyles', () => {
  it('exposes free local + CapCut shortcuts + ZapCap catalog + Off', () => {
    assert.ok(EOF_CAPTION_STYLES.length >= 11)
    assert.deepEqual(
      EOF_CAPTION_STYLES.map((s) => s.id).sort(),
      [
        'beast',
        'broadcast',
        'classic',
        'desk',
        'elegant',
        'karaoke',
        'live',
        'off',
        'pop',
        'punch',
        'softbar',
        'zapcap',
      ],
    )
    assert.equal(EOF_DEFAULT_CAPTION_STYLE, 'live')
    assert.equal(resolveEofCaptionStyle('off'), 'off')
    assert.equal(resolveEofCaptionStyle('none'), 'off')
    assert.equal(resolveEofCaptionStyle('subs'), 'live')
    assert.equal(resolveEofCaptionStyle('netflix'), 'classic')
    assert.equal(resolveEofCaptionStyle('pill'), 'softbar')
    assert.equal(resolveEofCaptionStyle('commentary'), 'desk')
    assert.equal(resolveEofCaptionStyle('gold'), 'elegant')
    assert.equal(resolveEofCaptionStyle('match'), 'punch')
    assert.equal(resolveEofCaptionStyle('ticker'), 'punch')
    assert.equal(resolveEofCaptionStyle('zapcap'), 'zapcap')
    assert.equal(
      resolveEofCaptionStyle('ca050348-e2d0-49a7-9c75-7a5e8335c67d'),
      'zapcap',
    )
    assert.equal(isLocalCaptionStyle('live'), true)
    assert.equal(isLocalCaptionStyle('classic'), true)
    assert.equal(isLocalCaptionStyle('softbar'), true)
    assert.equal(isLocalCaptionStyle('punch'), true)
    assert.equal(isZapcapCaptionStyle('zapcap'), true)
    assert.equal(isZapcapCaptionStyle('pop'), true)
    assert.equal(isLocalCaptionStyle('pop'), false)
    assert.equal(isBottomBarCaptionStyle('live'), true)
    assert.equal(isBottomBarCaptionStyle('classic'), true)
    assert.equal(isBottomBarCaptionStyle('desk'), true)
    assert.equal(isBottomBarCaptionStyle('punch'), true)
    assert.equal(isBottomBarCaptionStyle('pop'), false)
    assert.equal(captionBottomPlateMode('live'), 'full')
    assert.equal(captionBottomPlateMode('punch'), 'punch')
    assert.equal(captionBottomPlateMode('desk'), 'soft')
    assert.equal(captionBottomPlateMode('classic'), 'none')
    assert.equal(captionBottomPlateMode('softbar'), 'none')
    assert.equal(resolveFreeLocalBurnStyle('zapcap'), 'pop')
    assert.equal(resolveFreeLocalBurnStyle('karaoke'), 'karaoke')
    assert.equal(resolveFreeLocalBurnStyle('punch'), 'punch')
    assert.equal(resolveFreeLocalBurnStyle('classic'), 'classic')
    assert.equal(resolveFreeLocalBurnStyle('elegant'), 'elegant')
    assert.equal(
      normalizeZapcapTemplateId('ca050348-e2d0-49a7-9c75-7a5e8335c67d'),
      'ca050348-e2d0-49a7-9c75-7a5e8335c67d',
    )
    assert.equal(normalizeZapcapTemplateId('nope'), '')
    const listed = listEofCaptionStyles()
    assert.ok(listed.every((s) => typeof s.free === 'boolean'))
    assert.ok(listed.filter((s) => s.free).length >= 10)
  })

  it('resolves unknown styles to default', () => {
    assert.equal(resolveEofCaptionStyle('nope'), 'live')
    assert.equal(getEofCaptionStyle('beast').label.toLowerCase().includes('beast'), true)
    assert.equal(getEofCaptionStyle('punch').free, true)
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

  it('emits drawtext for each free style', () => {
    for (const id of [
      'live',
      'classic',
      'softbar',
      'broadcast',
      'desk',
      'elegant',
      'punch',
      'pop',
      'karaoke',
      'beast',
    ]) {
      const filters = buildCaptionDrawtextFilters({
        caption: 'Rooney is right about Ronaldo',
        durationSec: 4,
        captionFont: '/tmp/font.ttf',
        style: id,
      })
      assert.ok(filters.length >= 1, `${id} should emit filters`)
      assert.ok(filters.every((f) => f.startsWith('drawtext=')), `${id} filters must be drawtext`)
    }
    // Phrase / single-word styles center with safe-x expr; karaoke lays out word windows.
    for (const id of ['live', 'classic', 'softbar', 'broadcast', 'desk', 'elegant', 'punch', 'pop', 'beast']) {
      const filters = buildCaptionDrawtextFilters({
        caption: 'Rooney is right about Ronaldo',
        durationSec: 4,
        captionFont: '/tmp/font.ttf',
        style: id,
      })
      assert.ok(filters.every((f) => f.includes('x=max(w*0.10')), `${id} must use horizontal safe x`)
    }
  })

  it('places live / punch near the bottom safe zone', () => {
    const live = buildCaptionDrawtextFilters({
      caption: 'Spain beat Belgium last night in a thriller',
      durationSec: 5,
      captionFont: '/tmp/font.ttf',
      style: 'live',
    })
    assert.ok(live.some((f) => f.includes('y=h*0.76')))
    assert.ok(live.every((f) => f.includes('x=max(w*0.10')), 'live must use horizontal safe x')

    const punch = buildCaptionDrawtextFilters({
      caption: 'Spain beat Belgium last night in a thriller',
      durationSec: 5,
      captionFont: '/tmp/font.ttf',
      style: 'punch',
    })
    assert.ok(punch.some((f) => f.includes('y=h*0.73')))
    assert.ok(punch.some((f) => f.includes('0xFFE566')), 'match bar uses stadium yellow')
    assert.ok(punch.every((f) => f.includes('x=max(w*0.10')), 'punch must use horizontal safe x')
  })

  it('builds readable subtitle looks with distinct traits', () => {
    const classic = buildCaptionDrawtextFilters({
      caption: 'He is still running the show tonight',
      durationSec: 4,
      captionFont: '/tmp/font.ttf',
      style: 'classic',
    })
    assert.ok(classic.some((f) => f.includes('y=h*0.78')))
    assert.ok(classic.some((f) => f.includes('borderw=4')))

    const softbar = buildCaptionDrawtextFilters({
      caption: 'He is still running the show tonight',
      durationSec: 4,
      captionFont: '/tmp/font.ttf',
      style: 'softbar',
    })
    assert.ok(softbar.every((f) => f.includes('box=1')))
    assert.ok(softbar.some((f) => f.includes('boxcolor=black@0.62')))

    const broadcast = buildCaptionDrawtextFilters({
      caption: 'He is still running the show tonight',
      durationSec: 4,
      captionFont: '/tmp/font.ttf',
      style: 'broadcast',
    })
    assert.ok(broadcast.some((f) => f.includes('borderw=3')))

    const desk = buildCaptionDrawtextFilters({
      caption: 'He is still running the show tonight',
      durationSec: 4,
      captionFont: '/tmp/font.ttf',
      style: 'desk',
    })
    assert.ok(desk.some((f) => f.includes('y=h*0.74')))
    // Larger base + default fontScale 1.05 → fitted size above classic 50
    assert.ok(desk.some((f) => /fontsize=6\d/.test(f)))

    const elegant = buildCaptionDrawtextFilters({
      caption: 'He is still running the show tonight',
      durationSec: 4,
      captionFont: '/tmp/font.ttf',
      style: 'elegant',
    })
    assert.ok(elegant.some((f) => f.includes('0xF5E6C8')))
  })

  it('keeps long live phrases inside the safe band via wrap/fit', () => {
    const filters = buildCaptionDrawtextFilters({
      caption:
        'At thirty eight he is still running the show dictating tempo finding space and making every midfielder look ordinary',
      durationSec: 8,
      captionFont: '/tmp/font.ttf',
      style: 'live',
      layout: { yNorm: 0.76, fontScale: 1.5 },
    })
    assert.ok(filters.length >= 2, 'long caption should wrap into multiple phrases')
    assert.ok(filters.every((f) => f.includes('x=max(w*0.10')))
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
      const bodies = filters.map((_, i) => readFileSync(join(textDir, `live-${i}.txt`), 'utf8')).join(' ')
      assert.ok(bodies.includes('Fans are divided'), 'caption chunk written to file')
      assert.ok(bodies.includes('Tuchel') && bodies.includes('\u2019'), 'apostrophe sanitized across chunks')
    } finally {
      rmSync(textDir, { recursive: true, force: true })
    }
  })
})
