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

  it('reads either PINTEREST_ACCESS_TOKEN or EOF_PINTEREST_ACCESS_TOKEN', async () => {
    const { getEofPinterestAccessToken, isEofPinterestApiConfigured } = await import(
      '../backend/api/lib/eofPinterestImages.mjs'
    )
    const prevA = process.env.PINTEREST_ACCESS_TOKEN
    const prevB = process.env.EOF_PINTEREST_ACCESS_TOKEN
    try {
      delete process.env.PINTEREST_ACCESS_TOKEN
      delete process.env.EOF_PINTEREST_ACCESS_TOKEN
      assert.equal(isEofPinterestApiConfigured(), false)
      process.env.EOF_PINTEREST_ACCESS_TOKEN = 'test-token'
      assert.equal(getEofPinterestAccessToken(), 'test-token')
      assert.equal(isEofPinterestApiConfigured(), true)
    } finally {
      if (prevA === undefined) delete process.env.PINTEREST_ACCESS_TOKEN
      else process.env.PINTEREST_ACCESS_TOKEN = prevA
      if (prevB === undefined) delete process.env.EOF_PINTEREST_ACCESS_TOKEN
      else process.env.EOF_PINTEREST_ACCESS_TOKEN = prevB
    }
  })
})
