import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultEofCaptionLayout,
  normalizeEofCaptionLayout,
  captionLayoutYExpr,
  captionLayoutXExpr,
  captionLayoutFontSize,
  captionFitFontSize,
  captionSafeMaxWidthPx,
  chunkWordsToSafeWidth,
  EOF_CAPTION_SAFE_X,
} from './eofCaptionLayout.mjs'

describe('eofCaptionLayout', () => {
  it('defaults bottom styles lower than CapCut mid-frame', () => {
    const live = defaultEofCaptionLayout('live')
    const pop = defaultEofCaptionLayout('pop')
    assert.ok(live.yNorm > pop.yNorm)
    const classic = defaultEofCaptionLayout('classic')
    const desk = defaultEofCaptionLayout('desk')
    assert.ok(classic.yNorm >= live.yNorm)
    assert.ok(desk.yNorm < live.yNorm)
    assert.ok(desk.fontScale >= 1)
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

  it('centers x inside horizontal safe margins', () => {
    const x = captionLayoutXExpr()
    assert.match(x, /max\(w\*0\.10/)
    assert.match(x, /w\*\(0\.90\)-text_w/)
    assert.equal(captionSafeMaxWidthPx(1080), Math.round(1080 * (1 - 2 * EOF_CAPTION_SAFE_X)))
  })

  it('shrinks fontsize for overlong phrases', () => {
    const lay = normalizeEofCaptionLayout({ yNorm: 0.7, fontScale: 1.4 }, 'live')
    const long =
      'THIS IS AN EXTREMELY LONG MATCHDAY PHRASE THAT MUST NOT CLIP THE SIDES OF THE FRAME'
    const fitted = captionFitFontSize(56, long, lay)
    assert.ok(fitted < captionLayoutFontSize(56, lay))
    assert.ok(fitted >= 28)
  })

  it('chunks words so each phrase fits the safe width', () => {
    const words = [
      'Spain',
      'beat',
      'Belgium',
      'last',
      'night',
      'in',
      'a',
      'thriller',
      'under',
      'the',
      'lights',
    ]
    const fs = 54
    const chunks = chunkWordsToSafeWidth(words, fs, { maxWords: 7 })
    assert.ok(chunks.length >= 2)
    const maxW = captionSafeMaxWidthPx()
    const gap = fs * 0.35
    for (const phrase of chunks) {
      const parts = phrase.split(/\s+/).filter(Boolean)
      let width = 0
      for (let i = 0; i < parts.length; i += 1) {
        width += Math.max(1, parts[i].length) * fs * 0.58
        if (i > 0) width += gap
      }
      assert.ok(width <= maxW + 1, `phrase too wide (${width.toFixed(0)}>${maxW}): ${phrase}`)
    }
  })
})
