/**
 * Unit tests for Pro/Hobby Short build helpers + import smoke.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EOF_SERVERLESS_MAX_SCENES,
  EOF_SERVERLESS_MAX_DURATION_SEC,
  isEofForceSlim,
  isEofServerlessEnv,
  capEofScriptScenesForServerless,
  eofServerlessSlimRenderOpts,
  resolveEofProEncodeCaps,
  scheduleEofBuildContinue,
} from '../backend/api/lib/eofProductionServerless.mjs'
import {
  normalizeEofBuildMode,
  listEofBuildModeOptions,
  eofBuildModeNote,
} from '../backend/api/lib/eofBuildModeSettings.mjs'
import { isEofRenderStale, EOF_STALE_RENDER_SEC, EOF_STALE_PROGRESS_SEC } from '../backend/api/lib/eofProductionJobs.mjs'
import { withDeadline } from '../backend/api/lib/eofAsyncPool.mjs'
import { eofImageVisionTimeoutMs } from '../backend/api/lib/eofImageVision.mjs'

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

  it('does not slim by default (Pro path) even when VERCEL is set', () => {
    const prevVercel = process.env.VERCEL
    const prevForce = process.env.EOF_FORCE_SLIM
    const prevLegacy = process.env.EOF_SERVERLESS_SLIM
    process.env.VERCEL = '1'
    delete process.env.EOF_FORCE_SLIM
    delete process.env.EOF_SERVERLESS_SLIM
    try {
      assert.equal(isEofForceSlim(), false)
      assert.equal(isEofServerlessEnv(), false)
      const untouched = eofServerlessSlimRenderOpts({
        transitionStyle: 'dissolve',
        overlayMoments: 'always',
      })
      assert.equal(untouched.transitionStyle, 'dissolve')
      assert.equal(untouched.overlayMoments, 'always')
      assert.equal(untouched.kenBurns, undefined)
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL
      else process.env.VERCEL = prevVercel
      if (prevForce === undefined) delete process.env.EOF_FORCE_SLIM
      else process.env.EOF_FORCE_SLIM = prevForce
      if (prevLegacy === undefined) delete process.env.EOF_SERVERLESS_SLIM
      else process.env.EOF_SERVERLESS_SLIM = prevLegacy
    }
  })

  it('forces slim encode opts when EOF_FORCE_SLIM=1', () => {
    const prev = process.env.EOF_FORCE_SLIM
    const prevLegacy = process.env.EOF_SERVERLESS_SLIM
    process.env.EOF_FORCE_SLIM = '1'
    delete process.env.EOF_SERVERLESS_SLIM
    try {
      assert.equal(isEofForceSlim(), true)
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
      if (prev === undefined) delete process.env.EOF_FORCE_SLIM
      else process.env.EOF_FORCE_SLIM = prev
      if (prevLegacy === undefined) delete process.env.EOF_SERVERLESS_SLIM
      else process.env.EOF_SERVERLESS_SLIM = prevLegacy
    }
  })

  it('applies slim when explicit slim flag is passed (UI Hobby mode)', () => {
    const slim = eofServerlessSlimRenderOpts({ transitionStyle: 'dissolve' }, true)
    assert.equal(slim.transitionStyle, 'cut')
    assert.equal(slim.overlayMoments, 'off')
    const full = eofServerlessSlimRenderOpts({ transitionStyle: 'dissolve' }, false)
    assert.equal(full.transitionStyle, 'dissolve')
  })

  it('default stale windows leave room for a long Pro encode under maxDuration', () => {
    assert.ok(EOF_STALE_RENDER_SEC >= 280, `Hobby max age ${EOF_STALE_RENDER_SEC} too aggressive`)
    assert.ok(EOF_STALE_PROGRESS_SEC >= 60, `quiet ${EOF_STALE_PROGRESS_SEC} too tight for Hobby`)
    assert.ok(EOF_STALE_PROGRESS_SEC <= 120, `quiet ${EOF_STALE_PROGRESS_SEC} too loose`)
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
      '168s encode with quiet under Pro window must NOT auto-fail',
    )
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 5_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 281_000).toISOString() },
        },
        { now },
      ),
      false,
      '281s heartbeating Pro must NOT auto-fail under maxAge 300',
    )
  })

  it('Vercel Pro caps blur/KB always; overlays/xfade only when scene count threatens budget', () => {
    const local = resolveEofProEncodeCaps({ vercel: false, slim: false, sceneCount: 4 })
    assert.equal(local.profile, 'full')
    assert.equal(local.skipXfade, false)
    assert.equal(local.skipOverlays, false)

    const vercelLight = resolveEofProEncodeCaps({ vercel: true, slim: false, sceneCount: 3 })
    assert.equal(vercelLight.profile, 'pro-reliable')
    assert.equal(vercelLight.skipKenBurns, true)
    assert.equal(vercelLight.skipLogoBlur, true)
    assert.equal(vercelLight.skipXfade, false, '≤3 scenes keep transitions')
    assert.equal(vercelLight.skipOverlays, false, '≤3 scenes keep overlays')
    assert.equal(vercelLight.threatenBudget, true)

    const vercelFour = resolveEofProEncodeCaps({ vercel: true, slim: false, sceneCount: 4 })
    assert.equal(vercelFour.profile, 'pro-budget')
    assert.equal(vercelFour.skipXfade, true, '4-scene Shorts use hard cuts on Vercel')
    assert.equal(vercelFour.skipOverlays, true)

    const vercelHeavy = resolveEofProEncodeCaps({ vercel: true, slim: false, sceneCount: 5 })
    assert.equal(vercelHeavy.profile, 'pro-budget')
    assert.equal(vercelHeavy.skipXfade, true)
    assert.equal(vercelHeavy.skipOverlays, true)

    const hobby = resolveEofProEncodeCaps({ vercel: true, slim: true, sceneCount: 4 })
    assert.equal(hobby.profile, 'hobby-slim')
    assert.equal(hobby.skipXfade, true)
  })

  it('forwards forceFreshImages across the continue-build hop', async () => {
    const prevSite = process.env.SITE_URL
    const prevSecret = process.env.CRON_SECRET
    const prevFetch = globalThis.fetch
    process.env.SITE_URL = 'https://staging.example.com'
    process.env.CRON_SECRET = 'test-secret'
    /** @type {any} */
    let sent = null
    globalThis.fetch = async (_url, init) => {
      sent = JSON.parse(init.body)
      return { ok: true, status: 202 }
    }
    try {
      await scheduleEofBuildContinue('job-1', 'video', { forceFreshImages: true })
      assert.equal(sent.step, 'video')
      assert.equal(
        sent.forceFreshImages,
        true,
        'video isolate must know Build Short asked for fresh stills',
      )

      await scheduleEofBuildContinue('job-1', 'video', {})
      assert.equal(sent.forceFreshImages, undefined, 'plain continue keeps reuse allowed')
    } finally {
      globalThis.fetch = prevFetch
      if (prevSite === undefined) delete process.env.SITE_URL
      else process.env.SITE_URL = prevSite
      if (prevSecret === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = prevSecret
    }
  })

  it('vision timeout defaults to ≤10s on Vercel so Grok cannot burn the isolate', () => {
    const prevVercel = process.env.VERCEL
    const prevTimeout = process.env.EOF_IMAGE_VISION_TIMEOUT_MS
    delete process.env.EOF_IMAGE_VISION_TIMEOUT_MS
    process.env.VERCEL = '1'
    try {
      assert.ok(eofImageVisionTimeoutMs() <= 10_000)
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL
      else process.env.VERCEL = prevVercel
      if (prevTimeout === undefined) delete process.env.EOF_IMAGE_VISION_TIMEOUT_MS
      else process.env.EOF_IMAGE_VISION_TIMEOUT_MS = prevTimeout
    }
  })
})

describe('eofBuildModeSettings', () => {
  it('normalizes build mode ids and defaults to pro', () => {
    assert.equal(normalizeEofBuildMode('pro'), 'pro')
    assert.equal(normalizeEofBuildMode('hobby'), 'hobby')
    assert.equal(normalizeEofBuildMode('slim'), 'hobby')
    assert.equal(normalizeEofBuildMode(''), 'pro')
    assert.equal(listEofBuildModeOptions().length, 2)
    assert.match(eofBuildModeNote('hobby'), /first 4 scenes/i)
    assert.match(eofBuildModeNote('pro', { envForced: true }), /EOF_FORCE_SLIM/i)
  })
})

describe('eof production render import smoke', () => {
  it('loads render modules without executing ffmpeg', async () => {
    const video = await import('../backend/api/lib/eofProductionRenderVideo.mjs')
    const runner = await import('../backend/api/lib/eofProductionRenderRunner.mjs')
    const ffmpeg = await import('../backend/api/lib/eofFfmpeg.mjs')
    const handler = await import('../backend/api/admin/eof-production.js')
    assert.equal(typeof video.renderEofProductionVideoJob, 'function')
    assert.equal(typeof video.assertEofVideoPersisted, 'function')
    assert.equal(typeof runner.renderEofProductionFullBuild, 'function')
    assert.equal(typeof runner.continueEofProductionBuild, 'function')
    assert.equal(typeof runner.startEofProductionContinueBackground, 'function')
    assert.equal(typeof runner.startEofProductionFullBuildBackground, 'function')
    assert.equal(typeof ffmpeg.runFfmpeg, 'function')
    assert.equal(typeof handler.default, 'function')
    await assert.rejects(() => withDeadline(new Promise(() => {}), 40, 'Smoke'), /Smoke timed out/)
  })
})
