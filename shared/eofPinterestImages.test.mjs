import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPinterestPinUrl, upscalePinterestImageUrl } from '../backend/api/lib/eofPinterestImages.mjs'

describe('eofPinterestImages', () => {
  it('detects Pinterest pin URLs', () => {
    assert.equal(isPinterestPinUrl('https://www.pinterest.com/pin/123456789/'), true)
    assert.equal(isPinterestPinUrl('https://pin.it/abc123'), true)
    assert.equal(isPinterestPinUrl('Ronaldo football'), false)
  })

  it('upscales pinimg URLs', () => {
    const url = upscalePinterestImageUrl(
      'https://i.pinimg.com/564x/28/75/e9/2875e94f8055227e72d514b837adb271.jpg',
    )
    assert.match(url, /1200x/)
  })
})
