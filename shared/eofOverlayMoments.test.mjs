import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  resolveEofOverlayMoments,
  planEofOverlayMoments,
  overlayTimingWithinScene,
  sceneTimelineOffsetSec,
  buildOverlayPopFilterFragments,
  EOF_DEFAULT_OVERLAY_MOMENTS,
} from './eofOverlayMoments.mjs'

describe('eofOverlayMoments', () => {
  it('defaults and resolves mode', () => {
    assert.equal(resolveEofOverlayMoments(undefined), EOF_DEFAULT_OVERLAY_MOMENTS)
    assert.equal(resolveEofOverlayMoments('ALWAYS'), 'always')
    assert.equal(resolveEofOverlayMoments('nope'), 'auto')
  })

  it('off returns no moments', () => {
    const plan = planEofOverlayMoments({
      mode: 'off',
      scenes: [
        { index: 0, durationSec: 3, imagePath: '/a.jpg', imageKey: 'a' },
        { index: 1, durationSec: 3, imagePath: '/b.jpg', imageKey: 'b' },
        { index: 2, durationSec: 3, imagePath: '/c.jpg', imageKey: 'c' },
      ],
      hasSecondarySubject: true,
      secondarySceneIndex: 1,
    })
    assert.deepEqual(plan, [])
  })

  it('auto picks one middle moment with secondary still', () => {
    const plan = planEofOverlayMoments({
      mode: 'auto',
      scenes: [
        { index: 0, durationSec: 3, imagePath: '/rooney1.jpg', imageKey: 'r1', imageSource: 'oxylabs' },
        { index: 1, durationSec: 3.5, imagePath: '/tuchel.jpg', imageKey: 't1', imageSource: 'oxylabs' },
        { index: 2, durationSec: 3, imagePath: '/rooney2.jpg', imageKey: 'r2', imageSource: 'oxylabs' },
        { index: 3, durationSec: 3, imagePath: '/rooney3.jpg', imageKey: 'r3', imageSource: 'oxylabs' },
      ],
      hasSecondarySubject: true,
      secondarySceneIndex: 1,
    })
    assert.equal(plan.length, 1)
    assert.equal(plan[0].overlaySceneIndex, 1, 'inset should be the secondary still')
    assert.notEqual(plan[0].sceneIndex, 1, 'base beat should be a lead scene')
    assert.ok(plan[0].absoluteStartSec >= plan[0].startSec)
    assert.ok(plan[0].endSec > plan[0].startSec)
    assert.equal(plan[0].sfxAtSec, plan[0].absoluteStartSec)
  })

  it('auto skips when stills are not distinct', () => {
    const plan = planEofOverlayMoments({
      mode: 'auto',
      scenes: [
        { index: 0, durationSec: 3, imagePath: '/same.jpg', imageKey: 'x', imageSource: 'oxylabs' },
        { index: 1, durationSec: 3, imagePath: '/same.jpg', imageKey: 'x', imageSource: 'oxylabs' },
        { index: 2, durationSec: 3, imagePath: '/same.jpg', imageKey: 'x', imageSource: 'oxylabs' },
      ],
      hasSecondarySubject: true,
      secondarySceneIndex: 1,
    })
    assert.deepEqual(plan, [])
  })

  it('always works on two-scene Shorts with distinct stills', () => {
    const plan = planEofOverlayMoments({
      mode: 'always',
      scenes: [
        { index: 0, durationSec: 4, imagePath: '/a.jpg', imageKey: 'a', imageSource: 'wiki' },
        { index: 1, durationSec: 4, imagePath: '/b.jpg', imageKey: 'b', imageSource: 'wiki' },
      ],
      hasSecondarySubject: false,
    })
    assert.equal(plan.length, 1)
    assert.ok(plan[0].overlaySceneIndex !== plan[0].sceneIndex)
  })

  it('skips placeholder stills', () => {
    const plan = planEofOverlayMoments({
      mode: 'always',
      scenes: [
        { index: 0, durationSec: 3, imagePath: '/a.jpg', imageKey: 'a', imageSource: 'oxylabs' },
        { index: 1, durationSec: 3, imagePath: '/p.jpg', imageKey: 'p', imageSource: 'placeholder' },
      ],
    })
    assert.deepEqual(plan, [])
  })

  it('computes within-scene timing and timeline offsets', () => {
    const t = overlayTimingWithinScene(4)
    assert.ok(t.startSec >= 0.35)
    assert.ok(t.endSec > t.startSec)
    assert.equal(sceneTimelineOffsetSec([3, 4, 3], 2), 7)
  })

  it('builds pop filter fragments with safe caption clearance', () => {
    const f = buildOverlayPopFilterFragments({ startSec: 0.4, endSec: 2.8 })
    assert.ok(f.yFrac < 0.35, 'overlay stays in upper half above bottom captions')
    assert.ok(f.overlayPrep.includes('fade=t=in'))
    assert.ok(f.enableExpr.includes('between(t'))
    assert.ok(f.overlayXy.includes('y=H*'))
  })

  it('pop card uses soft rounded mask instead of a hard white border', () => {
    const f = buildOverlayPopFilterFragments({ startSec: 0.4, endSec: 2.8 })
    assert.equal(f.overlayPrep.includes('color=white'), false, 'no white pad frame')
    assert.equal(f.overlayPrep.includes('pad='), false, 'no hard pad border')
    assert.ok(f.overlayPrep.includes('force_original_aspect_ratio=increase'), 'cover-crop into card')
    assert.ok(f.overlayPrep.includes('geq='), 'soft alpha mask via geq')
    assert.ok(f.overlayPrep.includes('format=rgba'), 'rgba before soft mask')
    assert.ok(f.maxH > 100 && f.maxH < f.maxW, 'landscape-leaning photo card')
  })
})
