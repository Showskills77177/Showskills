import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEofRenderProgress,
  buildFallbackRenderProgress,
  estimateEofRenderDurationSec,
  estimateEofVideoRenderDurationSec,
} from './eofProduction.mjs'

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
