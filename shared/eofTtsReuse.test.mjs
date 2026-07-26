import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_TTS_MAX_SYNTHS_PER_HASH,
  hashEofTtsFingerprint,
  hashEofSceneTtsLine,
  shouldReuseEofDurableMixedAudio,
  shouldReuseEofSceneAudioFile,
  planEofSceneTtsDedupe,
  eofTtsCreditGuardDecision,
} from './eofTtsReuse.mjs'
import {
  isEofRenderStale,
  resolveEofStaleWindows,
  EOF_STALE_RENDER_SEC,
} from '../backend/api/lib/eofProductionJobs.mjs'

describe('eofTtsReuse fingerprint + decisions', () => {
  const script = {
    scenes: [
      { narration: 'Marc Cucurella never cuts his hair.' },
      { narration: 'The left-back keeps the same look.' },
    ],
  }

  it('stable fingerprint changes when narration or voice settings change', () => {
    const a = hashEofTtsFingerprint({
      script,
      voicePreset: 'brian',
      voiceSettings: { speed: 1, stability: 0.45, similarityBoost: 0.75, style: 0.35 },
    })
    const b = hashEofTtsFingerprint({
      script,
      voicePreset: 'brian',
      voiceSettings: { speed: 1, stability: 0.45, similarityBoost: 0.75, style: 0.35 },
    })
    const c = hashEofTtsFingerprint({
      script: { scenes: [{ narration: 'Different line.' }] },
      voicePreset: 'brian',
      voiceSettings: { speed: 1, stability: 0.45, similarityBoost: 0.75, style: 0.35 },
    })
    const d = hashEofTtsFingerprint({
      script,
      voicePreset: 'brian',
      voiceSettings: { speed: 0.9, stability: 0.45, similarityBoost: 0.75, style: 0.35 },
    })
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.notEqual(a, d)
    assert.equal(a.length, 32)
  })

  it('reuses durable mixed audio only when hash matches', () => {
    const fp = hashEofTtsFingerprint({ script, voicePreset: 'brian', voiceSettings: null })
    assert.equal(
      shouldReuseEofDurableMixedAudio({
        hasDurableAudio: true,
        storedFingerprint: fp,
        currentFingerprint: fp,
      }),
      true,
    )
    assert.equal(
      shouldReuseEofDurableMixedAudio({
        hasDurableAudio: true,
        storedFingerprint: fp,
        currentFingerprint: 'other',
      }),
      false,
    )
    assert.equal(
      shouldReuseEofDurableMixedAudio({
        hasDurableAudio: false,
        storedFingerprint: fp,
        currentFingerprint: fp,
      }),
      false,
    )
    assert.equal(
      shouldReuseEofDurableMixedAudio({
        hasDurableAudio: true,
        storedFingerprint: fp,
        currentFingerprint: fp,
        voiceRegenerationMode: true,
      }),
      false,
    )
  })

  it('reuses scene files by line hash and dedupes identical lines', () => {
    const h1 = hashEofSceneTtsLine({ text: 'Same line.', voicePreset: 'brian' })
    const h2 = hashEofSceneTtsLine({ text: 'Same line.', voicePreset: 'brian' })
    assert.equal(h1, h2)
    assert.equal(
      shouldReuseEofSceneAudioFile({
        fileExists: true,
        storedLineHash: h1,
        currentLineHash: h2,
      }),
      true,
    )
    assert.equal(
      shouldReuseEofSceneAudioFile({
        fileExists: true,
        storedLineHash: h1,
        currentLineHash: 'nope',
      }),
      false,
    )

    const plan = planEofSceneTtsDedupe([
      { index: 0, text: 'Same line.', lineHash: h1 },
      { index: 1, text: 'Other.', lineHash: 'x' },
      { index: 2, text: 'Same line.', lineHash: h1 },
    ])
    assert.equal(plan.length, 2)
    assert.deepEqual(plan[0].indexes, [0, 2])
    assert.deepEqual(plan[1].indexes, [1])
  })

  it('hard credit guard blocks after max synths for same hash', () => {
    const fp = 'abc'
    const blocked = eofTtsCreditGuardDecision({
      engine: 'elevenlabs',
      currentFingerprint: fp,
      storedFingerprint: fp,
      synthCount: EOF_TTS_MAX_SYNTHS_PER_HASH,
    })
    assert.equal(blocked.blocked, true)
    assert.match(blocked.reason, /credit guard/i)

    const allowed = eofTtsCreditGuardDecision({
      engine: 'elevenlabs',
      currentFingerprint: fp,
      storedFingerprint: fp,
      synthCount: EOF_TTS_MAX_SYNTHS_PER_HASH,
      voiceRegenerationMode: true,
    })
    assert.equal(allowed.blocked, false)

    const freshHash = eofTtsCreditGuardDecision({
      engine: 'elevenlabs',
      currentFingerprint: 'new',
      storedFingerprint: fp,
      synthCount: 99,
    })
    assert.equal(freshHash.blocked, false)
    assert.equal(freshHash.count, 0)
  })

  it('explicit Build reset (ttsSynthCount → 0) unblocks a job that burned its budget', () => {
    const fp = 'cucurella-narration-hash'
    // The ~40-attempt Cucurella job: same narration hash, already at the 3/3 cap → blocked.
    const blocked = eofTtsCreditGuardDecision({
      engine: 'elevenlabs',
      currentFingerprint: fp,
      storedFingerprint: fp,
      synthCount: EOF_TTS_MAX_SYNTHS_PER_HASH,
    })
    assert.equal(blocked.blocked, true, 'precondition: burned-budget job is blocked')

    // build-short handler resets ttsSynthCount to 0 on an explicit human Build. Same hash,
    // count now 0 → the deliberate build is allowed again (silent auto-retries never reset).
    const afterReset = eofTtsCreditGuardDecision({
      engine: 'elevenlabs',
      currentFingerprint: fp,
      storedFingerprint: fp,
      synthCount: 0,
    })
    assert.equal(afterReset.blocked, false, 'explicit Build reset must unblock the job')
    assert.equal(afterReset.count, 0)
  })
})

describe('eof Pro stale windows (quiet must not kill live encodes)', () => {
  it('defaults Hobby max age ≥280s and Pro absolute ≥10min with quiet heartbeat', () => {
    assert.ok(EOF_STALE_RENDER_SEC >= 280)
    const pro = resolveEofStaleWindows({ slim: false })
    assert.ok(pro.maxAgeSec >= 600, `Pro maxAge ${pro.maxAgeSec} must be ≥10min safety`)
    assert.ok(pro.maxQuietSec >= 120, `Pro quiet ${pro.maxQuietSec} too tight`)
    assert.ok(pro.maxQuietSec < pro.maxAgeSec)
    assert.equal(pro.allowQuietKill, true)
    const hobby = resolveEofStaleWindows({ slim: true })
    assert.equal(hobby.allowQuietKill, true)
    assert.ok(hobby.maxAgeSec <= 300)
    assert.ok(hobby.maxQuietSec <= 120)
  })

  it('does not auto-fail a 168s Pro encode that went quiet during ffmpeg', () => {
    const now = Date.now()
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 100_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 168_000).toISOString() },
        },
        { now, ...resolveEofStaleWindows({ slim: false }) },
      ),
      false,
      'Pro mute encode at 168s must stay alive (quiet window is longer)',
    )
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 100_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 168_000).toISOString() },
        },
        { now },
      ),
      false,
      'default (Pro) path must not quiet-kill at 168s',
    )
  })

  it('Pro job at age 281 with recent heartbeat does NOT fail (exact Cucurella timeout)', () => {
    const now = Date.now()
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 5_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 281_000).toISOString() },
        },
        { now, ...resolveEofStaleWindows({ slim: false }) },
      ),
      false,
      'live Pro encode past old 280s ceiling must keep running under waitUntil',
    )
  })

  it('genuinely quiet Pro jobs fail past the Pro quiet window', () => {
    const now = Date.now()
    const pro = resolveEofStaleWindows({ slim: false })
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - (pro.maxQuietSec + 20) * 1000).toISOString(),
          renderProgress: { startedAt: new Date(now - 250_000).toISOString() },
        },
        { now, ...pro },
      ),
      true,
      'dead isolate with no heartbeat must stale',
    )
  })

  it('still fails Pro jobs past absolute safety even with heartbeats', () => {
    const now = Date.now()
    const pro = resolveEofStaleWindows({ slim: false })
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 5_000).toISOString(),
          renderProgress: { startedAt: new Date(now - (pro.maxAgeSec + 30) * 1000).toISOString() },
        },
        { now, ...pro },
      ),
      true,
    )
  })

  it('Hobby slim may still early-fail on quiet', () => {
    const now = Date.now()
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 100_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 168_000).toISOString() },
        },
        { now, ...resolveEofStaleWindows({ slim: true }) },
      ),
      true,
    )
  })
})
