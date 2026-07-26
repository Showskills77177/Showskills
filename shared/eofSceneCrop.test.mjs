import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_SCENE_FRAME_W,
  EOF_SCENE_FRAME_H,
  EOF_SCENE_ASPECT,
  EOF_CROP_Y_BIAS_FACE_SAFE,
  EOF_CROP_Y_BIAS_BALANCED,
  EOF_WIDE_ASPECT_THRESHOLD,
  EOF_LOWRES_MIN_EDGE,
  classifyEofSceneFraming,
  buildEofSceneCropYExpr,
  buildEofSceneScaleCropFilters,
  buildEofSceneKenBurnsFragment,
} from './eofSceneCrop.mjs'

describe('eofSceneCrop', () => {
  it('exports 9:16 frame constants', () => {
    assert.equal(EOF_SCENE_FRAME_W, 1080)
    assert.equal(EOF_SCENE_FRAME_H, 1920)
    assert.ok(Math.abs(EOF_SCENE_ASPECT - 1080 / 1920) < 1e-9)
  })

  it('face-safe Y expr uses escaped commas and upper bias', () => {
    const expr = buildEofSceneCropYExpr(EOF_CROP_Y_BIAS_FACE_SAFE)
    assert.match(expr, /\(ih-oh\)\*0\.12/)
    assert.match(expr, /max\(0\\,min\(/)
    assert.ok(EOF_CROP_Y_BIAS_FACE_SAFE < 0.2, 'must be more conservative than legacy 0.20')
    assert.ok(EOF_CROP_Y_BIAS_FACE_SAFE < EOF_CROP_Y_BIAS_BALANCED)
  })

  it('classifies tall portrait as face-safe cover', () => {
    const f = classifyEofSceneFraming({ width: 800, height: 1600 })
    assert.equal(f.mode, 'cover')
    assert.equal(f.reason, 'tall')
    assert.equal(f.yBias, EOF_CROP_Y_BIAS_FACE_SAFE)
  })

  it('classifies ultra-wide / panoramic as letterbox (not a thin cover slice)', () => {
    const f = classifyEofSceneFraming({ width: 1920, height: 1080 })
    assert.ok(1920 / 1080 >= EOF_WIDE_ASPECT_THRESHOLD)
    assert.equal(f.mode, 'letterbox')
    assert.equal(f.reason, 'wide')
  })

  it('classifies low-res Serp-like thumbs as letterbox', () => {
    const f = classifyEofSceneFraming({ width: 320, height: 240 })
    assert.ok(Math.min(320, 240) < EOF_LOWRES_MIN_EDGE)
    assert.equal(f.mode, 'letterbox')
    assert.equal(f.reason, 'low_res')
  })

  it('unknown dims default to face-safe cover (blind, consistent)', () => {
    const f = classifyEofSceneFraming({})
    assert.equal(f.mode, 'cover')
    assert.equal(f.reason, 'unknown_dims')
    assert.equal(f.yBias, EOF_CROP_Y_BIAS_FACE_SAFE)
  })

  it('cover filter chain is scale=increase + face-safe crop', () => {
    const { framing, filters } = buildEofSceneScaleCropFilters({ width: 800, height: 1600 })
    assert.equal(framing.mode, 'cover')
    const joined = filters.join(',')
    assert.match(joined, /force_original_aspect_ratio=increase/)
    assert.match(joined, /crop=1080:1920:\(iw-ow\)\/2:max\(0\\,min\(\(ih-oh\)\*0\.12/)
    assert.match(joined, /setsar=1/)
    assert.equal(joined.includes('pad='), false)
  })

  it('wide source builds letterbox decrease+pad (subject stays whole)', () => {
    const { framing, filters } = buildEofSceneScaleCropFilters({ width: 1600, height: 900 })
    assert.equal(framing.mode, 'letterbox')
    const joined = filters.join(',')
    assert.match(joined, /force_original_aspect_ratio=decrease/)
    assert.match(joined, /pad=1080:1920:\(ow-iw\)\/2:\(oh-ih\)\/2/)
    assert.equal(joined.includes('crop=1080:1920'), false)
  })

  it('Ken Burns hook (mild) is softer than body zoom', () => {
    const mild = buildEofSceneKenBurnsFragment({ frames: 72, fps: 24, mild: true })
    const body = buildEofSceneKenBurnsFragment({ frames: 72, fps: 24, mild: false })
    assert.match(mild, /1\.06/)
    assert.match(body, /1\.1/)
    assert.match(mild, /zoompan=z=/)
    assert.match(mild, /s=1080x1920/)
  })
})
