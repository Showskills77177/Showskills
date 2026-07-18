import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import {
  detectEofNewsAgencyStill,
  stillNeedsNewsAgencyLogoBlur,
  extractUrlFromEofImageKey,
  buildNewsAgencyLogoBlurFilterFragment,
  resolveNewsAgencyLogoBlurRegions,
  clampNewsAgencyLogoBlurRadius,
} from './eofNewsAgencyLogoBlur.mjs'

describe('eofNewsAgencyLogoBlur detection', () => {
  it('extracts http(s) URLs from image keys', () => {
    assert.equal(
      extractUrlFromEofImageKey('oxylabs:https://e0.365dm.com/2024/rooney.jpg'),
      'https://e0.365dm.com/2024/rooney.jpg',
    )
    assert.equal(extractUrlFromEofImageKey('wiki:Wayne_Rooney'), '')
  })

  it('matches Fox / Sky / Getty / Reuters / AP hosts and titles', () => {
    assert.equal(
      detectEofNewsAgencyStill({
        imageUrl: 'https://a57.foxnews.com/static.foxnews.com/foxnews.com/content/uploads/x.jpg',
      }).match,
      true,
    )
    assert.equal(
      detectEofNewsAgencyStill({
        imageKey: 'serpapi:https://e0.365dm.com/2024/sky-rooney.jpg',
      }).match,
      true,
    )
    assert.equal(
      detectEofNewsAgencyStill({
        imageTitle: 'Wayne Rooney — Getty Images',
        imageUrl: 'https://cdn.example.com/opaque.jpg',
      }).match,
      true,
    )
    assert.equal(
      detectEofNewsAgencyStill({
        sourcePage: 'https://www.reuters.com/sports/soccer/rooney',
      }).match,
      true,
    )
    assert.equal(detectEofNewsAgencyStill({ imageSource: 'ap' }).match, true)
  })

  it('does not match clean stock / wiki / AI gen plates', () => {
    assert.equal(
      detectEofNewsAgencyStill({
        imageUrl: 'https://images.pexels.com/photos/123/x.jpg',
        imageTitle: 'Football training',
        imageSource: 'pexels',
      }).match,
      false,
    )
    assert.equal(
      detectEofNewsAgencyStill({
        imageKey: 'wiki:Wayne_Rooney',
        imageTitle: 'Wayne Rooney',
        imageSource: 'wikimedia',
      }).match,
      false,
    )
    assert.equal(
      detectEofNewsAgencyStill({
        imageSource: 'grok-imagine',
        imageTitle: 'Generated portrait',
      }).match,
      false,
    )
  })
})

describe('eofNewsAgencyLogoBlur filter fragment', () => {
  const prev = { ...process.env }

  before(() => {
    process.env.EOF_NEWS_LOGO_BLUR = '1'
    delete process.env.EOF_NEWS_LOGO_BLUR_LR
    delete process.env.EOF_NEWS_LOGO_BLUR_CORNER_W
    delete process.env.EOF_NEWS_LOGO_BLUR_CORNER_H
  })

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k]
    }
    Object.assign(process.env, prev)
  })

  it('stillNeedsNewsAgencyLogoBlur follows detection when enabled', () => {
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({
        imageUrl: 'https://static.foxnews.com/foxnews.com/content/uploads/x.jpg',
      }),
      true,
    )
    assert.equal(stillNeedsNewsAgencyLogoBlur({ imageSource: 'pexels' }), false)
  })

  it('builds corner boxblur overlays for 9:16 frame', () => {
    const regions = resolveNewsAgencyLogoBlurRegions({ frameW: 1080, frameH: 1920 })
    assert.equal(regions.length, 4)
    assert.ok(regions.every((r) => r.w > 40 && r.h > 30))
    assert.equal(regions.find((r) => r.id === 'br')?.x, 1080 - regions[0].w)

    const frag = buildNewsAgencyLogoBlurFilterFragment({
      frameW: 1080,
      frameH: 1920,
      labelPrefix: 'mlb',
    })
    assert.match(frag, /split=5/)
    assert.match(frag, /boxblur=\d+:\d+/)
    assert.match(frag, /\[mlb_br\]crop=/)
    assert.match(frag, /overlay=/)
    // All four corners present
    for (const id of ['tl', 'tr', 'bl', 'br']) {
      assert.match(frag, new RegExp(`\\[mlb_${id}\\]`))
    }
  })

  it('clamps boxblur radius so pop-inset corner crops stay chroma-safe', () => {
    // Regression: pop cards (~842×488) yield ~37px-tall corners; lr=10 fails ffmpeg
    // ("Invalid chroma_param radius value 10, must be >= 0 and <= 9") and drops the pop.
    assert.ok(clampNewsAgencyLogoBlurRadius(185, 37, 10) <= 9)
    assert.equal(clampNewsAgencyLogoBlurRadius(238, 144, 10), 10)

    const popW = Math.round(1080 * 0.78)
    const popH = Math.max(120, Math.round(popW * 0.58))
    const frag = buildNewsAgencyLogoBlurFilterFragment({
      frameW: popW,
      frameH: popH,
      labelPrefix: 'plb',
      blurLr: 10,
    })
    const radii = [...frag.matchAll(/boxblur=(\d+):(\d+)/g)].map((m) => Number(m[1]))
    assert.ok(radii.length >= 4, 'expected per-corner boxblur')
    assert.ok(
      radii.every((r) => r >= 1 && r <= 9),
      `pop corner boxblur radii must be ≤9 for yuv420 chroma, got ${radii.join(',')}`,
    )
  })

  it('returns empty fragment when blur disabled via env', () => {
    process.env.EOF_NEWS_LOGO_BLUR = 'off'
    assert.equal(buildNewsAgencyLogoBlurFilterFragment({ frameW: 1080, frameH: 1920 }), '')
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({ imageUrl: 'https://a57.foxnews.com/x.jpg' }),
      false,
    )
    process.env.EOF_NEWS_LOGO_BLUR = '1'
  })
})
