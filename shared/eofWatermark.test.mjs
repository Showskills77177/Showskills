import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { watermarkOverlayXY } from '../backend/api/lib/eofWatermark.mjs'

describe('eof watermark anchor', () => {
  it('defaults to bottom-center (over ZapCap mark)', () => {
    const { x, y } = watermarkOverlayXY('bottom-center', 0, 24)
    assert.equal(x, '(W-w)/2+0')
    assert.equal(y, 'H-h-24')
  })

  it('anchors each named corner correctly', () => {
    assert.deepEqual(watermarkOverlayXY('top-left', 0, 0), { x: '0', y: '0' })
    assert.deepEqual(watermarkOverlayXY('top-right', 0, 0), { x: 'W-w-0', y: '0' })
    assert.deepEqual(watermarkOverlayXY('bottom-left', 0, 0), { x: '0', y: 'H-h-0' })
    assert.deepEqual(watermarkOverlayXY('bottom-right', 0, 0), { x: 'W-w-0', y: 'H-h-0' })
    assert.deepEqual(watermarkOverlayXY('center', 0, 0), { x: '(W-w)/2+0', y: '(H-h)/2+0' })
  })

  it('unknown position falls back to bottom-center', () => {
    assert.deepEqual(watermarkOverlayXY('nonsense', 10, 5), { x: '(W-w)/2+10', y: 'H-h-5' })
  })
})
