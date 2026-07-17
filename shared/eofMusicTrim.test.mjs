import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatEofMusicTrimLabel, normalizeEofMusicTrim } from './eofMusicTrim.mjs'

describe('eofMusicTrim', () => {
  it('normalizes start/end within track', () => {
    const t = normalizeEofMusicTrim({
      musicStartSec: 12,
      musicEndSec: 40,
      trackDurationSec: 90,
    })
    assert.equal(t.startSec, 12)
    assert.equal(t.endSec, 40)
  })

  it('clears end when too close to start', () => {
    const t = normalizeEofMusicTrim({ musicStartSec: 10, musicEndSec: 10.1 })
    assert.equal(t.startSec, 10)
    assert.equal(t.endSec, null)
  })

  it('formats labels', () => {
    assert.match(formatEofMusicTrimLabel({ startSec: 0, endSec: null }), /Full track/)
    assert.match(formatEofMusicTrimLabel({ startSec: 5, endSec: 25 }), /0:05/)
  })
})
