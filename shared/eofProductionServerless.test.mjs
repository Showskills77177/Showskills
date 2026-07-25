/**
 * Unit tests for Hobby/serverless Short build helpers + import smoke.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_SERVERLESS_MAX_SCENES,
  EOF_SERVERLESS_MAX_DURATION_SEC,
  isEofServerlessEnv,
  capEofScriptScenesForServerless,
  eofServerlessSlimRenderOpts,
} from '../backend/api/lib/eofProductionServerless.mjs'
import { isEofRenderStale, EOF_STALE_RENDER_SEC, EOF_STALE_PROGRESS_SEC } from '../backend/api/lib/eofProductionJobs.mjs'
import { withDeadline } from '../backend/api/lib/eofAsyncPool.mjs'

describe('eofProductionServerless', () => {
  it('caps scenes to ≤4 without mutating the original script', () => {
    assert.equal(EOF_SERVERLESS_MAX_SCENES, 4)
    assert.ok(EOF_SERVERLESS_MAX_DURATION_SEC >= 240)
    const script = {
      format: 'news',
      scenes: [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }],
    }
    const capped = capEofScriptScenesForServerless(script)
    assert.equal(capped.trimmed, true)
    assert.equal(capped.before, 5)
    assert.equal(capped.after, 4)
    assert.equal(capped.script.scenes.length, 4)
    assert.equal(script.scenes.length, 5, 'input must stay intact')
    assert.equal(capEofScriptScenesForServerless({ scenes: [{}, {}, {}] }).trimmed, false)
  })

  it('forces slim encode opts on serverless', () => {
    const prev = process.env.EOF_SERVERLESS_SLIM
    process.env.EOF_SERVERLESS_SLIM = '1'
    try {
      assert.equal(isEofServerlessEnv(), true)
      const slim = eofServerlessSlimRenderOpts({
        transitionStyle: 'dissolve',
        overlayMoments: 'always',
        colorGrade: 'cold',
      })
      assert.equal(slim.transitionStyle, 'cut')
      assert.equal(slim.overlayMoments, 'off')
      assert.equal(slim.kenBurns, false)
      assert.equal(slim.colorGrade, 'cold')
    } finally {
      if (prev === undefined) delete process.env.EOF_SERVERLESS_SLIM
      else process.env.EOF_SERVERLESS_SLIM = prev
    }
  })

  it('default stale windows leave room for a slim Hobby encode', () => {
    assert.ok(EOF_STALE_RENDER_SEC >= 240, `max age ${EOF_STALE_RENDER_SEC} too aggressive`)
    assert.ok(EOF_STALE_PROGRESS_SEC <= 60, `quiet ${EOF_STALE_PROGRESS_SEC} too loose`)
    const now = Date.now()
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 4_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 160_000).toISOString() },
        },
        { now },
      ),
      false,
      '160s heartbeating build must stay alive',
    )
  })
})

describe('eof production render import smoke', () => {
  it('loads render modules without executing ffmpeg', async () => {
    const video = await import('../backend/api/lib/eofProductionRenderVideo.mjs')
    const runner = await import('../backend/api/lib/eofProductionRenderRunner.mjs')
    const ffmpeg = await import('../backend/api/lib/eofFfmpeg.mjs')
    assert.equal(typeof video.renderEofProductionVideoJob, 'function')
    assert.equal(typeof video.assertEofVideoPersisted, 'function')
    assert.equal(typeof runner.renderEofProductionFullBuild, 'function')
    assert.equal(typeof runner.startEofProductionFullBuildBackground, 'function')
    assert.equal(typeof ffmpeg.runFfmpeg, 'function')
    await assert.rejects(() => withDeadline(new Promise(() => {}), 40, 'Smoke'), /Smoke timed out/)
  })
})
