import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildZapcapTranscriptFromScenes,
  resolveCaptionEngine,
  isZapcapConfigured,
} from '../backend/api/lib/eofZapcapCaptions.mjs'

describe('eofZapcapCaptions', () => {
  it('builds timed BYOT word cues from scenes', () => {
    const cues = buildZapcapTranscriptFromScenes([
      { narration: 'Ronaldo scores again tonight', durationSec: 4 },
      { caption: 'What a finish', durationSec: 2 },
    ])
    assert.ok(cues.length >= 5)
    assert.equal(cues[0].type, 'word')
    assert.equal(cues[0].text, 'Ronaldo')
    assert.ok(cues[0].start_time >= 0)
    assert.ok(cues[cues.length - 1].end_time <= 6.1)
    for (let i = 1; i < cues.length; i += 1) {
      assert.ok(cues[i].start_time >= cues[i - 1].start_time - 0.001)
    }
  })

  it('auto engine is none without ZapCap key', () => {
    const before = process.env.ZAPCAP_API_KEY
    const beforeEof = process.env.EOF_ZAPCAP_API_KEY
    const beforeEngine = process.env.EOF_CAPTION_ENGINE
    delete process.env.ZAPCAP_API_KEY
    delete process.env.EOF_ZAPCAP_API_KEY
    delete process.env.ZAPCAP_KEY
    delete process.env.EOF_CAPTION_ENGINE
    assert.equal(isZapcapConfigured(), false)
    assert.equal(resolveCaptionEngine(), 'none')
    process.env.EOF_CAPTION_ENGINE = 'local'
    assert.equal(resolveCaptionEngine(), 'local')
    if (before == null) delete process.env.ZAPCAP_API_KEY
    else process.env.ZAPCAP_API_KEY = before
    if (beforeEof == null) delete process.env.EOF_ZAPCAP_API_KEY
    else process.env.EOF_ZAPCAP_API_KEY = beforeEof
    if (beforeEngine == null) delete process.env.EOF_CAPTION_ENGINE
    else process.env.EOF_CAPTION_ENGINE = beforeEngine
  })
})
