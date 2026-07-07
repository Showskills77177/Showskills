import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isEofGoogleCseConfigured } from '../backend/api/lib/eofGoogleImages.mjs'

describe('eofGoogleImages', () => {
  it('detects when Google CSE credentials are set', () => {
    const prevKey = process.env.GOOGLE_CSE_API_KEY
    const prevCx = process.env.GOOGLE_CSE_ID
    delete process.env.GOOGLE_CSE_API_KEY
    delete process.env.GOOGLE_CSE_ID
    assert.equal(isEofGoogleCseConfigured(), false)
    process.env.GOOGLE_CSE_API_KEY = 'test-key'
    process.env.GOOGLE_CSE_ID = 'test-cx'
    assert.equal(isEofGoogleCseConfigured(), true)
    if (prevKey) process.env.GOOGLE_CSE_API_KEY = prevKey
    else delete process.env.GOOGLE_CSE_API_KEY
    if (prevCx) process.env.GOOGLE_CSE_ID = prevCx
    else delete process.env.GOOGLE_CSE_ID
  })
})
