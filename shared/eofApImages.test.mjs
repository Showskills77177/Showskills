import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildApPictureSearchQuery, isEofApImagesConfigured } from '../backend/api/lib/eofApImages.mjs'

describe('eofApImages', () => {
  it('builds a picture-scoped AP search query', () => {
    const q = buildApPictureSearchQuery('Cristiano Ronaldo celebrate')
    assert.match(q, /^type:picture/)
    assert.match(q, /Cristiano Ronaldo celebrate/)
    assert.match(q, /football/)
  })

  it('falls back when query is empty', () => {
    assert.match(buildApPictureSearchQuery(''), /type:picture/)
  })

  it('reports configured from env', () => {
    const before = process.env.AP_MEDIA_API_KEY
    delete process.env.AP_MEDIA_API_KEY
    delete process.env.EOF_AP_MEDIA_API_KEY
    delete process.env.AP_API_KEY
    assert.equal(isEofApImagesConfigured(), false)
    process.env.AP_MEDIA_API_KEY = 'test-key'
    assert.equal(isEofApImagesConfigured(), true)
    if (before == null) delete process.env.AP_MEDIA_API_KEY
    else process.env.AP_MEDIA_API_KEY = before
  })
})
