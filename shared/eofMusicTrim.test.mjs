import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatEofMusicTrimLabel, normalizeEofMusicTrim } from './eofMusicTrim.mjs'
import {
  EOF_AUTO_MUSIC_TRACK_ID,
  eofMusicSelectionMode,
  pickEofMusicTrackForTopic,
  resolveEofMusicTrackIdForSelection,
} from '../backend/api/lib/eofMusicTracks.mjs'
import {
  shouldEofAllowNoMusic,
  shouldEofReuseDurableMix,
} from '../backend/api/lib/eofProductionRender.mjs'

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

describe('EOF music selection', () => {
  it('keeps an empty or cleared selection VO-only without consulting the catalog', async () => {
    assert.equal(eofMusicSelectionMode(null), 'none')
    assert.equal(eofMusicSelectionMode(''), 'none')
    assert.equal(await pickEofMusicTrackForTopic('dramatic final', null), null)
    assert.equal(await resolveEofMusicTrackIdForSelection('dramatic final', null), null)
  })

  it('only enables mood/default picking through the explicit Auto selection', () => {
    assert.equal(eofMusicSelectionMode(EOF_AUTO_MUSIC_TRACK_ID), 'auto')
    assert.equal(eofMusicSelectionMode('chosen-bed-id'), 'explicit')
  })
})

describe('EOF remove-song remix', () => {
  it('allows VO-only when Remove song cleared the persisted track', () => {
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: null }), true)
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: '' }), true)
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: 'chosen-bed-id' }), false)
  })

  it('does not restore the stale durable mix during a cached-VO music remix', () => {
    const reusableOldMix = {
      hasDurableAudio: true,
      storedFingerprint: 'same-tts',
      currentFingerprint: 'same-tts',
    }
    assert.equal(shouldEofReuseDurableMix({}, reusableOldMix), true)
    assert.equal(
      shouldEofReuseDurableMix(
        { reuseSceneAudio: true, allowNoMusic: true },
        reusableOldMix,
      ),
      false,
    )
  })
})
