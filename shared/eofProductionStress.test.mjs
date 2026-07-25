/**
 * EOF Production stress / scenario suite — many edge paths, no ffmpeg / no Wikimedia.
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import {
  collectEofShortQualityPlanChecks,
  collectEofShortQualityStillsChecks,
  collectEofShortQualityHeuristicChecks,
  runEofShortQualityPreflight,
  runEofShortQualityStillsPreflight,
  runEofShortQualityGate,
  finalizeEofQualityGate,
  parseEofQualityGate,
  parseEofQualityGateHistory,
  appendEofQualityGateHistory,
  notifyEofQualityGateBlocked,
  captionMismatchSeverity,
  formatEofQualityGateBlockMessage,
  maxPlaceholderFraction,
  EOF_QUALITY_GATE_HISTORY_LIMIT,
} from '../backend/api/lib/eofShortQualityGate.mjs'
import {
  shouldSkipEofStillsPreflight,
  shouldSkipEofPlanPreflight,
  eofRemuxVideoJobOpts,
} from '../backend/api/lib/eofProductionRenderVideo.mjs'
import { shouldEofAllowNoMusic } from '../backend/api/lib/eofProductionRender.mjs'
import {
  EOF_OVERLAY_LAYOUT,
  eofOverlayCoversFaceZone,
  eofOverlayLayoutIsFaceSafe,
  eofOverlayCardRect,
  isBadEofOverlayStill,
  planEofOverlayMoments,
} from './eofOverlayMoments.mjs'
import {
  detectEofNewsAgencyStill,
  stillNeedsNewsAgencyLogoBlur,
  clampNewsAgencyLogoBlurRadius,
} from './eofNewsAgencyLogoBlur.mjs'
import { buildWordBeats, sanitizeCaptionPunctuation } from './eofCaptionBeats.mjs'
import { normalizeEofMusicTrim, formatEofMusicTrimLabel } from './eofMusicTrim.mjs'
import { resolveEofWatermarkLayout } from '../backend/api/lib/eofWatermark.mjs'
import { formatOxylabsSearchHealthNote } from '../backend/api/lib/eofOxylabsImages.mjs'

function healthyScenes(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    narration: `Beat ${i + 1}: England face pressure after a tough result tonight.`,
    caption: `England face pressure ${i + 1}`,
    durationSec: 4,
  }))
}

function healthyJob(overrides = {}) {
  const scenes = overrides.script?.scenes ?? healthyScenes(3)
  const base = {
    topic: 'England pressure',
    captionStyle: 'live',
    captionLayout: { yNorm: 0.76, fontScale: 1 },
    musicTrackId: 'bed-drive',
    musicVolume: 0.22,
    musicStartSec: 0,
    musicEndSec: null,
    overlayMoments: 'auto',
    script: { scenes, format: 'hot_take', plainTextDraft: 'England face pressure tonight.' },
    narrationManifest: scenes.map((s, i) => ({
      index: i,
      durationSec: s.durationSec,
      caption: s.caption,
      imageSource: 'oxylabs',
      imageKey: `oxylabs:https://cdn.example.com/still-${i}.jpg`,
      imageTitle: `England match still ${i}`,
    })),
  }
  return {
    ...base,
    ...overrides,
    script: overrides.script || base.script,
    narrationManifest: overrides.narrationManifest || base.narrationManifest,
  }
}

function byId(checks, id) {
  return checks.find((c) => c.id === id)
}

describe('EOF stress — quality gate / preflight scenarios', () => {
  const prevGate = process.env.EOF_SHORT_QUALITY_GATE
  const prevVision = process.env.EOF_SHORT_QUALITY_VISION
  const prevPlaceholder = process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER

  beforeEach(() => {
    process.env.EOF_SHORT_QUALITY_GATE = 'auto'
    process.env.EOF_SHORT_QUALITY_VISION = 'off'
  })

  afterEach(() => {
    if (prevGate == null) delete process.env.EOF_SHORT_QUALITY_GATE
    else process.env.EOF_SHORT_QUALITY_GATE = prevGate
    if (prevVision == null) delete process.env.EOF_SHORT_QUALITY_VISION
    else process.env.EOF_SHORT_QUALITY_VISION = prevVision
    if (prevPlaceholder == null) delete process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER
    else process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = prevPlaceholder
  })

  it('healthy plan passes preflight (auto does not block)', () => {
    const gate = runEofShortQualityPreflight(healthyJob(), { mode: 'auto' })
    assert.equal(gate.phase, 'preflight')
    assert.equal(gate.pass, true)
    assert.equal(gate.blocked, false)
  })

  it('empty captions fail while captions are on', () => {
    const job = healthyJob({
      script: {
        scenes: [
          { narration: 'England need a reset tonight after the result.', caption: '', durationSec: 4 },
          {
            narration: 'The manager faces the media tomorrow morning.',
            caption: 'Manager faces media',
            durationSec: 4,
          },
        ],
      },
      narrationManifest: [],
    })
    const checks = collectEofShortQualityPlanChecks(job)
    assert.ok(byId(checks, 'captions_empty_0'))
    assert.equal(byId(checks, 'captions_empty_0').severity, 'fail')
    const gate = runEofShortQualityPreflight(job, { mode: 'manual' })
    assert.equal(gate.pass, false)
    assert.equal(gate.blocked, true)
  })

  it('paraphrase caption≠VO is warn not fail (regression)', () => {
    assert.equal(
      captionMismatchSeverity(
        'The England boss is under fire',
        'Thomas Tuchel faces mounting pressure as England manager tonight after another tough result.',
      ),
      'warn',
    )
    const job = healthyJob({
      script: {
        scenes: [
          {
            caption: 'The England boss is under fire',
            narration:
              'Thomas Tuchel faces mounting pressure as England manager tonight after another tough result.',
            durationSec: 5,
          },
        ],
      },
    })
    const checks = collectEofShortQualityPlanChecks(job)
    const mm = byId(checks, 'captions_mismatch_0')
    assert.ok(mm)
    assert.equal(mm.severity, 'warn')
    const gate = finalizeEofQualityGate(checks, { mode: 'auto', phase: 'preflight' })
    assert.equal(gate.pass, true)
    assert.equal(gate.blocked, false)
    assert.ok(gate.warnings.length >= 1)
  })

  it('severe named-entity conflict fails on plan checks', () => {
    const caption = 'Messi hits back after the presser night'
    const narration = 'Cristiano Ronaldo slammed the critics after the match'
    assert.equal(captionMismatchSeverity(caption, narration), 'fail')
    const job = healthyJob({
      overlayMoments: 'off',
      script: {
        scenes: [{ caption, narration, durationSec: 5 }],
      },
      narrationManifest: [],
    })
    const checks = collectEofShortQualityPlanChecks(job)
    assert.equal(byId(checks, 'captions_mismatch_0')?.severity, 'fail')
    const gate = runEofShortQualityPreflight(job, { mode: 'auto' })
    assert.equal(gate.pass, false)
    assert.equal(gate.blocked, true)
  })

  it('music missing (null track / VO-only) warns not fails', () => {
    const job = healthyJob({ musicTrackId: null })
    const checks = collectEofShortQualityPlanChecks(job)
    assert.equal(byId(checks, 'music_missing_track')?.severity, 'warn')
    assert.equal(byId(checks, 'music_volume_silent'), undefined)
    const gate = runEofShortQualityPreflight(job, { mode: 'auto' })
    assert.equal(gate.pass, true)
    assert.equal(gate.blocked, false)
  })

  it('music muted while bed selected fails', () => {
    const job = healthyJob({ musicTrackId: 'bed-1', musicVolume: 0 })
    const checks = collectEofShortQualityPlanChecks(job)
    assert.equal(byId(checks, 'music_volume_silent')?.severity, 'fail')
    const gate = runEofShortQualityPreflight(job, { mode: 'manual' })
    assert.equal(gate.blocked, true)
  })

  it('music volume hot warns; bad trim window fails', () => {
    const hot = collectEofShortQualityPlanChecks(healthyJob({ musicVolume: 0.95 }))
    assert.equal(byId(hot, 'music_volume_hot')?.severity, 'warn')

    const trim = collectEofShortQualityPlanChecks(
      healthyJob({ musicStartSec: 10, musicEndSec: 12 }),
    )
    assert.equal(byId(trim, 'music_trim_short')?.severity, 'fail')
  })

  it('default pop layout is face-safe; yFrac over eyes is not', () => {
    assert.equal(eofOverlayLayoutIsFaceSafe(EOF_OVERLAY_LAYOUT), true)
    assert.equal(eofOverlayCoversFaceZone(EOF_OVERLAY_LAYOUT), false)
    assert.ok(EOF_OVERLAY_LAYOUT.yFrac >= 0.44)

    const bad = { ...EOF_OVERLAY_LAYOUT, yFrac: 0.13, heightFrac: 0.72 }
    assert.equal(eofOverlayCoversFaceZone(bad), true)
    assert.equal(eofOverlayLayoutIsFaceSafe(bad), false)
    const rect = eofOverlayCardRect(bad)
    assert.ok(rect.y < 0.42)
  })

  it('pop size bounds: widthFrac too small would fail size check if used as layout', () => {
    // Gate uses module EOF_OVERLAY_LAYOUT constants — assert current defaults stay in range.
    assert.ok(EOF_OVERLAY_LAYOUT.widthFrac >= 0.55 && EOF_OVERLAY_LAYOUT.widthFrac <= 0.92)
    assert.ok(EOF_OVERLAY_LAYOUT.heightFrac >= 0.35 && EOF_OVERLAY_LAYOUT.heightFrac <= 0.7)
    const checks = collectEofShortQualityPlanChecks(healthyJob({ overlayMoments: 'always' }))
    assert.equal(byId(checks, 'overlay_size_width'), undefined)
    assert.equal(byId(checks, 'overlay_size_height'), undefined)
    assert.equal(byId(checks, 'overlay_covers_face'), undefined)
  })

  it('captioned / clickbait pop still is rejected', () => {
    assert.equal(
      isBadEofOverlayStill({
        imageTitle: 'SHOCKING TRANSFER — YOU WONT BELIEVE THIS',
        imageSource: 'oxylabs',
        imageKey: 'oxylabs:https://cdn.example.com/click.jpg',
      }),
      true,
    )
    const job = healthyJob({
      overlayMoments: 'always',
      narrationManifest: [
        {
          index: 0,
          durationSec: 4,
          caption: 'a',
          imageSource: 'oxylabs',
          imageKey: 'k0',
          imageTitle: 'clean still',
        },
        {
          index: 1,
          durationSec: 4,
          caption: 'b',
          imageSource: 'oxylabs',
          imageKey: 'k1',
          imageTitle: 'BREAKING: clickbait thumbnail text overlay',
        },
      ],
    })
    const checks = collectEofShortQualityStillsChecks(job, {
      overlayMoments: [
        {
          overlaySceneIndex: 1,
          absoluteStartSec: 1,
          absoluteEndSec: 3,
        },
      ],
    })
    assert.ok(byId(checks, 'overlay_bad_still'))
    const gate = runEofShortQualityStillsPreflight(job, {
      mode: 'auto',
      renderMeta: {
        overlayMoments: [{ overlaySceneIndex: 1, absoluteStartSec: 1, absoluteEndSec: 3 }],
      },
    })
    assert.equal(gate.phase, 'stills')
    assert.equal(gate.blocked, true)
  })

  it('phases: preflight vs stills vs post differ and stamp correctly', async () => {
    const job = healthyJob({
      musicTrackId: null,
      renderOutputPath: 'out.mp4',
      mixedAudioPath: 'mixed.mp3',
    })
    const pre = runEofShortQualityPreflight(job, { mode: 'manual' })
    const stills = runEofShortQualityStillsPreflight(job, { mode: 'manual' })
    const post = await runEofShortQualityGate(job, { mode: 'manual', skipVision: true })
    assert.equal(pre.phase, 'preflight')
    assert.equal(stills.phase, 'stills')
    assert.equal(post.phase, 'post')
    assert.ok(pre.warnings.some((w) => /music|voiceover/i.test(w)) || byId(collectEofShortQualityPlanChecks(job), 'music_missing_track'))
  })

  it('auto-publish block when !pass on post finalize', () => {
    const gate = finalizeEofQualityGate(
      [{ id: 'x', severity: 'fail', message: 'broken', detail: null }],
      { mode: 'auto', phase: 'post' },
    )
    assert.equal(gate.pass, false)
    assert.equal(gate.blocked, true)
    assert.match(formatEofQualityGateBlockMessage(gate), /blocked publish/i)
  })

  it('manual post fail reports but does not block publish', () => {
    const gate = finalizeEofQualityGate(
      [{ id: 'x', severity: 'fail', message: 'broken', detail: null }],
      { mode: 'manual', phase: 'post' },
    )
    assert.equal(gate.pass, false)
    assert.equal(gate.blocked, false)
  })
})

describe('EOF stress — remux / music allowNoMusic', () => {
  it('skipPlanPreflight / skipStillsPreflight / reuseSceneImages matrix', () => {
    assert.equal(shouldSkipEofPlanPreflight({}), false)
    assert.equal(shouldSkipEofPlanPreflight({ skipPlanPreflight: true }), true)
    assert.equal(shouldSkipEofStillsPreflight({}), false)
    assert.equal(shouldSkipEofStillsPreflight({ skipStillsPreflight: true }), true)
    assert.equal(shouldSkipEofStillsPreflight({ reuseSceneImages: true }), true)

    const remux = eofRemuxVideoJobOpts()
    assert.equal(remux.reuseSceneImages, true)
    assert.equal(remux.skipPlanPreflight, true)
    assert.equal(remux.skipStillsPreflight, true)
    assert.equal(shouldSkipEofPlanPreflight(remux), true)
    assert.equal(shouldSkipEofStillsPreflight(remux), true)

    const zap = eofRemuxVideoJobOpts({ captionMode: 'zapcap-only' })
    assert.equal(zap.captionMode, 'zapcap-only')
    assert.equal(zap.skipStillsPreflight, true)
  })

  it('allowNoMusic VO-only: null track + flag → no default bed pick', () => {
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: null }), true)
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: '' }), true)
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: 'bed-1' }), false)
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: false }, { musicTrackId: null }), false)
    assert.equal(shouldEofAllowNoMusic({}, { musicTrackId: null }), false)
  })

  it('clear music trim fields normalize safely', () => {
    const cleared = normalizeEofMusicTrim({ musicStartSec: 0, musicEndSec: null })
    assert.equal(cleared.startSec, 0)
    assert.equal(cleared.endSec, null)
    assert.match(formatEofMusicTrimLabel({ startSec: 0, endSec: null }), /Full track/)

    const near = normalizeEofMusicTrim({ musicStartSec: 5, musicEndSec: 5.1 })
    assert.equal(near.endSec, null)
  })

  it('remix after null track: remux opts still skip stills preflight', () => {
    // Music remix path: allowNoMusic on audio + remux video opts
    assert.equal(shouldEofAllowNoMusic({ allowNoMusic: true }, { musicTrackId: null }), true)
    const opts = eofRemuxVideoJobOpts()
    assert.equal(shouldSkipEofStillsPreflight(opts), true)
    assert.equal(shouldSkipEofPlanPreflight(opts), true)
  })
})

describe('EOF stress — overlay / crop / blur', () => {
  it('mid-lower yFrac pop is face-safe', () => {
    const mid = { ...EOF_OVERLAY_LAYOUT, yFrac: 0.48 }
    assert.equal(eofOverlayLayoutIsFaceSafe(mid), true)
    const planned = planEofOverlayMoments({
      mode: 'always',
      scenes: [
        { index: 0, durationSec: 4, imagePath: 'a', imageKey: 'a' },
        { index: 1, durationSec: 4, imagePath: 'b', imageKey: 'b' },
      ],
    })
    assert.ok(Array.isArray(planned))
    assert.ok(planned.length >= 1)
  })

  it('news logo blur: host triggers; title-only on clean CDN does not', () => {
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({
        imageUrl: 'https://e0.365dm.com/2024/rooney.jpg',
      }),
      true,
    )
    assert.equal(
      detectEofNewsAgencyStill({
        imageUrl: 'https://cdn.example.com/opaque.jpg',
        imageTitle: 'Getty Images archive',
      }).match,
      false,
    )
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({
        imageUrl: 'https://cdn.example.com/opaque.jpg',
        imageTitle: 'Getty Images archive',
      }),
      false,
    )
  })

  it('small pop corner blur radius clamps (yuv420 abort regression)', () => {
    const lr = clampNewsAgencyLogoBlurRadius(185, 37, 10)
    assert.ok(lr <= 9)
    assert.ok(lr >= 1)
  })
})

describe('EOF stress — watermark / caption beats', () => {
  it('watermark defaults: inset badge, opacity in range', () => {
    const layout = resolveEofWatermarkLayout({})
    assert.ok(layout.cornerW >= 120)
    assert.ok(layout.opacity > 0.05 && layout.opacity <= 1)
    assert.ok(Number.isFinite(layout.markX) && layout.markX >= 0)
    assert.ok(Number.isFinite(layout.markY) && layout.markY >= 0)
    assert.ok(String(layout.position || '').length)
  })

  it('buildWordBeats covers duration, no NaN; empty → ellipsis', () => {
    const beats = buildWordBeats('Spain beat Belgium last night', 5)
    assert.ok(beats.length >= 3)
    for (const b of beats) {
      assert.equal(Number.isFinite(b.start), true)
      assert.equal(Number.isFinite(b.end), true)
      assert.ok(b.end >= b.start)
      assert.equal(Number.isNaN(b.start), false)
    }
    assert.ok(beats.at(-1).end >= 4.5)

    const empty = buildWordBeats('', 3)
    assert.equal(empty.length, 1)
    assert.equal(empty[0].text, '…')
    assert.ok(empty[0].end >= 1.2)

    const weighted = buildWordBeats('Go Championship', 4)
    const go = weighted.find((b) => b.text === 'Go')
    const champ = weighted.find((b) => /Championship/i.test(b.text))
    assert.ok(go && champ)
    assert.ok(champ.end - champ.start > go.end - go.start)
  })

  it('sanitizeCaptionPunctuation normalizes curly quotes', () => {
    const s = sanitizeCaptionPunctuation('“England” can\u2019t stop')
    assert.match(s, /"/)
    assert.match(s, /\u2019/)
  })
})

describe('EOF stress — jobs / schema / history / notify', () => {
  it('qualityGate JSON shape + history append + malformed history', () => {
    const gate = finalizeEofQualityGate(
      [{ id: 'a', severity: 'fail', message: 'nope', detail: null }],
      { mode: 'auto', phase: 'stills' },
    )
    const parsed = parseEofQualityGate(JSON.stringify(gate))
    assert.equal(parsed.phase, 'stills')
    assert.equal(parsed.blocked, true)
    assert.equal('history' in parsed, false)

    assert.deepEqual(parseEofQualityGateHistory('not-json'), [])
    assert.deepEqual(parseEofQualityGateHistory(null), [])
    let hist = appendEofQualityGateHistory([], gate)
    assert.equal(hist.length, 1)
    for (let i = 0; i < EOF_QUALITY_GATE_HISTORY_LIMIT + 3; i += 1) {
      hist = appendEofQualityGateHistory(hist, { ...gate, checkedAt: `t-${i}`, reasons: [`r${i}`] })
    }
    assert.equal(hist.length, EOF_QUALITY_GATE_HISTORY_LIMIT)
  })

  it('notifyEofQualityGateBlocked: not_blocked + mocked send + http fail', async () => {
    const prevA = process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK
    const prevB = process.env.EOF_SLACK_WEBHOOK
    const originalFetch = globalThis.fetch
    process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK = 'https://hooks.example.com/services/test'
    delete process.env.EOF_SLACK_WEBHOOK

    try {
      const skipped = await notifyEofQualityGateBlocked({
        gate: { blocked: false, phase: 'post', mode: 'auto', reasons: [] },
      })
      assert.equal(skipped.sent, false)
      assert.equal(skipped.reason, 'not_blocked')

      globalThis.fetch = async () => new Response('ok', { status: 200 })
      const ok = await notifyEofQualityGateBlocked({
        jobId: 'j-stress',
        topic: 'England',
        gate: { blocked: true, phase: 'post', mode: 'auto', reasons: ['fail qa'] },
      })
      assert.equal(ok.sent, true)

      globalThis.fetch = async () => new Response('nope', { status: 500 })
      const bad = await notifyEofQualityGateBlocked({
        gate: { blocked: true, phase: 'preflight', mode: 'auto', reasons: ['x'] },
      })
      assert.equal(bad.sent, false)
      assert.equal(bad.reason, 'http_500')
    } finally {
      globalThis.fetch = originalFetch
      if (prevA == null) delete process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK
      else process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK = prevA
      if (prevB == null) delete process.env.EOF_SLACK_WEBHOOK
      else process.env.EOF_SLACK_WEBHOOK = prevB
    }
  })

  it('Oxylabs health notes distinguish missing vs auth down vs opt-in off', () => {
    assert.match(
      formatOxylabsSearchHealthNote({
        status: 'not_configured',
        detail: 'missing',
        softFallback: true,
      }),
      /credentials missing|soft-falling/i,
    )
    assert.match(
      formatOxylabsSearchHealthNote({
        status: 'not_configured',
        disabled: true,
        detail: 'Oxylabs disabled (set OXYLABS_ENABLED=1 to opt in when trial renewed)',
        softFallback: true,
      }),
      /opt-in|OXYLABS_ENABLED/i,
    )
    assert.match(
      formatOxylabsSearchHealthNote({
        status: 'auth_failed',
        detail: 'Unauthorized',
        httpStatus: 401,
        softFallback: true,
      }),
      /SEARCH DOWN|auth/i,
    )
  })
})

describe('EOF stress — fuzz-ish deterministic edges', () => {
  it('empty / 1-scene / many-scene Shorts do not throw', () => {
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks({ script: { scenes: [] }, captionStyle: 'off' }))
    assert.doesNotThrow(() =>
      collectEofShortQualityPlanChecks(
        healthyJob({
          script: { scenes: healthyScenes(1) },
          narrationManifest: [
            {
              index: 0,
              durationSec: 4,
              caption: 'One',
              imageSource: 'oxylabs',
              imageKey: 'k0',
            },
          ],
        }),
      ),
    )
    const many = healthyJob({
      script: { scenes: healthyScenes(12) },
      narrationManifest: healthyScenes(12).map((s, i) => ({
        index: i,
        durationSec: s.durationSec,
        caption: s.caption,
        imageSource: 'oxylabs',
        imageKey: `k${i}`,
      })),
    })
    const checks = collectEofShortQualityHeuristicChecks(many)
    assert.ok(Array.isArray(checks))
  })

  it('extremely short / long durationSec warn or fail appropriately', () => {
    const short = collectEofShortQualityPlanChecks(
      healthyJob({
        script: {
          scenes: [
            { narration: 'Quick beat one here now', caption: 'Quick beat one', durationSec: 0.5 },
            { narration: 'Quick beat two here now', caption: 'Quick beat two', durationSec: 0.5 },
          ],
        },
      }),
    )
    assert.ok(byId(short, 'timing_scene_0')?.severity === 'fail')

    const long = collectEofShortQualityPlanChecks(
      healthyJob({
        script: {
          scenes: [
            {
              narration: 'A very long monologue that keeps going for ages',
              caption: 'Long monologue',
              durationSec: 40,
            },
          ],
        },
      }),
    )
    assert.ok(byId(long, 'timing_scene_long_0')?.severity === 'warn')
  })

  it('placeholder ratios at threshold: warn below, fail above', () => {
    process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = '0.34'
    const frac = maxPlaceholderFraction()
    assert.ok(frac > 0 && frac < 1)

    // 1/3 ≈ 0.333 → warn
    const warnJob = healthyJob({
      narrationManifest: [
        { index: 0, durationSec: 4, caption: 'a', imageSource: 'placeholder', imageKey: 'p0' },
        { index: 1, durationSec: 4, caption: 'b', imageSource: 'oxylabs', imageKey: 'k1' },
        { index: 2, durationSec: 4, caption: 'c', imageSource: 'oxylabs', imageKey: 'k2' },
      ],
    })
    const warnChecks = collectEofShortQualityStillsChecks(warnJob)
    assert.equal(byId(warnChecks, 'stills_placeholder')?.severity, 'warn')

    // 2/3 ≈ 0.66 → fail
    const failJob = healthyJob({
      narrationManifest: [
        { index: 0, durationSec: 4, caption: 'a', imageSource: 'placeholder', imageKey: 'p0' },
        { index: 1, durationSec: 4, caption: 'b', imageSource: 'placeholder', imageKey: 'p1' },
        { index: 2, durationSec: 4, caption: 'c', imageSource: 'oxylabs', imageKey: 'k2' },
      ],
    })
    const failChecks = collectEofShortQualityStillsChecks(failJob)
    assert.equal(byId(failChecks, 'stills_placeholder')?.severity, 'fail')
  })

  it('missing still sources fail; weird unicode does not throw', () => {
    const missing = collectEofShortQualityStillsChecks(
      healthyJob({
        narrationManifest: [
          { index: 0, durationSec: 4, caption: 'a', imageSource: '', imageKey: '' },
          { index: 1, durationSec: 4, caption: 'b', imageSource: 'oxylabs', imageKey: 'k1' },
        ],
      }),
    )
    assert.ok(byId(missing, 'stills_missing_source'))

    const unicode = healthyJob({
      script: {
        scenes: [
          {
            narration: 'Роналду 🔥 scored — café résumé',
            caption: 'Роналду scored ⚽️',
            durationSec: 4,
          },
        ],
      },
    })
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(unicode))
    assert.doesNotThrow(() => buildWordBeats('Роналду 🔥 café', 4))
  })

  it('null/undefined job fields do not throw', () => {
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(null))
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(undefined))
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks({}))
    assert.doesNotThrow(() => collectEofShortQualityStillsChecks({}))
    assert.doesNotThrow(() => parseEofQualityGate(undefined))
    assert.equal(parseEofQualityGate(null), null)
    assert.doesNotThrow(() =>
      runEofShortQualityPreflight({ script: null, captionStyle: 'off' }, { mode: 'manual' }),
    )
  })
})
