import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isBlockedStockImageUrl,
  isCaptionContaminatedStill,
  filterBlockedStockImages,
} from './eofStockImageFilter.mjs'

describe('eofStockImageFilter', () => {
  it('blocks Getty / Shutterstock hosts and titles', () => {
    assert.equal(isBlockedStockImageUrl('https://media.gettyimages.com/id/123/photo.jpg'), true)
    assert.equal(isBlockedStockImageUrl('https://www.shutterstock.com/image-photo/foo-123.jpg'), true)
    assert.equal(
      isBlockedStockImageUrl('https://cdn.example.com/a.jpg', 'Wayne Rooney — Getty Images'),
      true,
    )
  })

  it('allows normal news / CDN stills', () => {
    assert.equal(isBlockedStockImageUrl('https://i.guim.co.uk/img/media/abc.jpg'), false)
    assert.equal(isBlockedStockImageUrl('https://e0.365dm.com/rooney.jpg', 'Rooney on Sky Sports'), false)
  })

  it('blocks meme hosts and caption-contaminated quote cards (Rooney double-caption cause)', () => {
    assert.equal(isCaptionContaminatedStill('https://i.imgflip.com/abc.jpg', 'Rooney meme'), true)
    assert.equal(
      isCaptionContaminatedStill(
        'https://cdn.example.com/rooney.jpg',
        'Rooney has very strong sperm Louis van Gaal quote',
      ),
      true,
    )
    assert.equal(
      isBlockedStockImageUrl(
        'https://cdn.example.com/x.jpg',
        'Viral quote card — Rooney has very strong sperm',
      ),
      true,
    )
    assert.equal(
      isBlockedStockImageUrl('https://e0.365dm.com/rooney-studio.jpg', 'Wayne Rooney Sky Sports'),
      false,
    )
  })

  it('filters arrays', () => {
    const kept = filterBlockedStockImages([
      { url: 'https://media.gettyimages.com/x.jpg', title: 'x' },
      { url: 'https://cdn.bbc.co.uk/y.jpg', title: 'Rooney' },
      { url: 'https://cdn.example.com/z.jpg', title: 'Football meme quote card' },
    ])
    assert.equal(kept.length, 1)
    assert.match(kept[0].url, /bbc/)
  })
})
