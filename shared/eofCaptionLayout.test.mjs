import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultEofCaptionLayout,
  normalizeEofCaptionLayout,
  captionLayoutYExpr,
  captionLayoutFontSize,
} from './eofCaptionLayout.mjs'

describe('eofCaptionLayout', () => {
  it('defaults bottom styles lower than CapCut mid-frame', () => {
    const live = defaultEofCaptionLayout('live')
    const pop = defaultEofCaptionLayout('pop')
    assert.ok(live.yNorm > pop.yNorm)
  })

  it('clamps y and scale', () => {
    const n = normalizeEofCaptionLayout({ yNorm: 0.01, fontScale: 9 }, 'live')
    assert.ok(n.yNorm >= 0.35)
    assert.ok(n.fontScale <= 1.6)
  })

  it('builds ffmpeg y expr and scaled font size', () => {
    const lay = normalizeEofCaptionLayout({ yNorm: 0.7, fontScale: 1.2 }, 'live')
    assert.match(captionLayoutYExpr(lay), /h\*0\.700/)
    assert.equal(captionLayoutFontSize(50, lay), 60)
  })
})
