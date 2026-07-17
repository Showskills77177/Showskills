import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_WATERMARK_DEFAULTS,
  resolveEofWatermarkLayout,
  watermarkOverlayXY,
} from '../backend/api/lib/eofWatermark.mjs'

describe('eof watermark anchor', () => {
  it('places top-left with inward inset (not flush on the frame edge)', () => {
    const { markX, markY } = resolveEofWatermarkLayout({})
    assert.equal(markX, EOF_WATERMARK_DEFAULTS.x)
    assert.equal(markY, EOF_WATERMARK_DEFAULTS.y)
    assert.ok(markX > 0 && markY > 0, 'defaults leave padding from left/top edges')
    assert.deepEqual(watermarkOverlayXY('top-left', markX, markY), {
      x: String(markX),
      y: String(markY),
    })
  })

  it('anchors each named corner correctly', () => {
    assert.deepEqual(watermarkOverlayXY('top-right', 0, 0), { x: 'W-w-0', y: '0' })
    assert.deepEqual(watermarkOverlayXY('bottom-left', 0, 0), { x: '0', y: 'H-h-0' })
    assert.deepEqual(watermarkOverlayXY('bottom-right', 0, 0), { x: 'W-w-0', y: 'H-h-0' })
    assert.deepEqual(watermarkOverlayXY('bottom-center', 0, 24), { x: '(W-w)/2+0', y: 'H-h-24' })
    assert.deepEqual(watermarkOverlayXY('center', 0, 0), { x: '(W-w)/2+0', y: '(H-h)/2+0' })
  })

  it('unknown position falls back to bottom-center', () => {
    assert.deepEqual(watermarkOverlayXY('nonsense', 10, 5), { x: '(W-w)/2+10', y: 'H-h-5' })
  })
})

describe('eof watermark layout defaults', () => {
  it('uses a smaller inset badge with full opacity', () => {
    const layout = resolveEofWatermarkLayout({})
    assert.equal(layout.cornerW, 200)
    assert.equal(layout.markX, 28)
    assert.equal(layout.markY, 52)
    assert.equal(layout.opacity, 1)
    assert.equal(layout.position, 'top-left')
  })

  it('honours env overrides for size, inset, and opacity', () => {
    const layout = resolveEofWatermarkLayout({
      EOF_WATERMARK_SIZE: '180',
      EOF_WATERMARK_X: '40',
      EOF_WATERMARK_Y: '60',
      EOF_WATERMARK_OPACITY: '0.9',
      EOF_WATERMARK_POSITION: 'top-right',
    })
    assert.equal(layout.cornerW, 180)
    assert.equal(layout.markX, 40)
    assert.equal(layout.markY, 60)
    assert.equal(layout.opacity, 0.9)
    assert.equal(layout.position, 'top-right')
  })

  it('clamps opacity into 0.05–1', () => {
    assert.equal(resolveEofWatermarkLayout({ EOF_WATERMARK_OPACITY: '2' }).opacity, 1)
    assert.equal(resolveEofWatermarkLayout({ EOF_WATERMARK_OPACITY: '0' }).opacity, 0.05)
  })
})
