import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_DEFAULT_VOICE_PRESET,
  EOF_VOICE_PRESETS,
  buildEofRenderProgress,
  buildFallbackRenderProgress,
  estimateEofRenderDurationSec,
  estimateEofVideoRenderDurationSec,
  isEofFreeVoicePreset,
  listEofFreeVoicePresets,
} from './eofProduction.mjs'

describe('eofProduction voice presets', () => {
  it('defaults to a free Edge voice', () => {
    assert.equal(EOF_DEFAULT_VOICE_PRESET, 'british')
    assert.equal(EOF_VOICE_PRESETS.british.engine, 'edge')
    assert.ok(isEofFreeVoicePreset(EOF_DEFAULT_VOICE_PRESET))
  })

  it('exposes one to three free Edge voices plus optional ElevenLabs Brian', () => {
    const free = listEofFreeVoicePresets()
    assert.ok(free.length >= 1 && free.length <= 3)
    assert.deepEqual(
      free.map((v) => v.id).sort(),
      ['american', 'british', 'british_calm'].sort(),
    )
    for (const preset of free) {
      assert.equal(preset.engine, 'edge')
      assert.ok(String(preset.voice || '').includes('Neural'))
      assert.match(String(preset.label), /free/i)
    }
    assert.equal(EOF_VOICE_PRESETS.brian.engine, 'elevenlabs')
    assert.equal(isEofFreeVoicePreset('brian'), false)
  })
})

describe('eofProduction render estimates', () => {
  it('audio estimate stays under 3 minutes for a 5-scene script', () => {
    const script = {
      scenes: Array.from({ length: 5 }, () => ({
        narration: 'Lionel Messi is one of the most discussed names in modern football.',
      })),
    }
    const sec = estimateEofRenderDurationSec(script)
    assert.ok(sec >= 45)
    assert.ok(sec <= 150)
  })

  it('video estimate stays reasonable for five scenes', () => {
    const sec = estimateEofVideoRenderDurationSec(5)
    assert.equal(sec, 25)
  })

  it('maps 5-scene video stage sceneIndex 0 to 42% (scene clip encode)', () => {
    const progress = buildEofRenderProgress({
      stage: 'video',
      sceneIndex: 0,
      sceneCount: 5,
      startedAt: new Date().toISOString(),
      pipeline: 'video',
    })
    assert.equal(progress.percent, 42)
    assert.match(progress.message, /scene clip 1 of 5/i)
  })

  it('accepts heartbeat message overrides without changing percent', () => {
    const progress = buildEofRenderProgress({
      stage: 'video',
      sceneIndex: 0,
      sceneCount: 5,
      startedAt: new Date().toISOString(),
      pipeline: 'video',
      message: 'Encoding scene clip 1 of 5 (ffmpeg)…',
    })
    assert.equal(progress.percent, 42)
    assert.match(progress.message, /ffmpeg/i)
  })

  it('does not show 25 minute ETA at 6% progress after one minute', () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString()
    const progress = buildEofRenderProgress({
      stage: 'tts',
      sceneIndex: 0,
      sceneCount: 5,
      startedAt,
      estimatedTotalSec: 70,
      pipeline: 'audio',
    })
    assert.ok(progress.percent <= 12)
    assert.ok(progress.etaSeconds < 180, `eta was ${progress.etaSeconds}s`)
    assert.equal(progress.estimatedTotalSec, 70)
  })

  it('fallback progress does not use stale job updatedAt as start time', () => {
    const progress = buildFallbackRenderProgress(
      {
        status: 'rendering',
        updatedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
        renderProgress: null,
      },
      { scenes: Array.from({ length: 5 }, () => ({ narration: 'Test line.' })) },
      'audio',
    )
    assert.equal(progress.elapsedSeconds, 0)
    assert.ok(progress.etaSeconds < 180)
  })
})
