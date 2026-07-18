/**
 * EOF Production hard stress / adversarial suite — second wave.
 * Deterministic edge paths only (no ffmpeg / no Wikimedia / no network).
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import {
  collectEofShortQualityPlanChecks,
  collectEofShortQualityStillsChecks,
  runEofShortQualityPreflight,
  runEofShortQualityGate,
  finalizeEofQualityGate,
  parseEofQualityGateHistory,
  appendEofQualityGateHistory,
  notifyEofQualityGateBlocked,
  captionMismatchSeverity,
  captionNarrationOverlap,
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
  EOF_OVERLAY_FACE_ZONE,
  EOF_OVERLAY_LAYOUT,
  eofOverlayCoversFaceZone,
  eofOverlayLayoutIsFaceSafe,
  eofOverlayCardRect,
  buildOverlayPopFilterFragments,
} from './eofOverlayMoments.mjs'
import {
  detectEofNewsAgencyStill,
  stillNeedsNewsAgencyLogoBlur,
  buildNewsAgencyLogoBlurFilterFragment,
  extractUrlFromEofImageKey,
} from './eofNewsAgencyLogoBlur.mjs'
import { buildWordBeats } from './eofCaptionBeats.mjs'
import { normalizeEofMusicTrim, formatEofMusicTrimLabel } from './eofMusicTrim.mjs'
import { resolveEofWatermarkLayout } from '../backend/api/lib/eofWatermark.mjs'

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

/**
 * ffmpeg filtergraph must not embed raw newlines / control breaks.
 * @param {string} frag
 * @param {string} [label]
 * @param {{ forbidQuotes?: boolean }} [opts]
 */
function assertFilterStringSafe(frag, label = 'filter', opts = {}) {
  assert.equal(typeof frag, 'string', `${label} must be string`)
  assert.equal(frag.includes('\n'), false, `${label} must not contain newline`)
  assert.equal(frag.includes('\r'), false, `${label} must not contain CR`)
  assert.equal(frag.includes('\0'), false, `${label} must not contain NUL`)
  if (opts.forbidQuotes) {
    assert.equal(frag.includes("'"), false, `${label} must not contain raw single quotes`)
  }
}

describe('EOF hard — adversarial quality-gate captions', () => {
  const prevGate = process.env.EOF_SHORT_QUALITY_GATE
  const prevVision = process.env.EOF_SHORT_QUALITY_VISION

  beforeEach(() => {
    process.env.EOF_SHORT_QUALITY_GATE = 'auto'
    process.env.EOF_SHORT_QUALITY_VISION = 'off'
  })

  afterEach(() => {
    if (prevGate == null) delete process.env.EOF_SHORT_QUALITY_GATE
    else process.env.EOF_SHORT_QUALITY_GATE = prevGate
    if (prevVision == null) delete process.env.EOF_SHORT_QUALITY_VISION
    else process.env.EOF_SHORT_QUALITY_VISION = prevVision
  })

  it('almost-overlap captions sit just below / above the 0.35 ok band', () => {
    // 3/9 ≈ 0.333 → warn (no shared entities)
    const belowCap = 'alpha bravo charlie delta echo foxtrot golf hotel india'
    const belowNar = 'alpha bravo charlie xray yankee zulu whiskey'
    const below = captionNarrationOverlap(belowCap, belowNar)
    assert.ok(below > 0.3 && below < 0.35, `expected ~0.333 got ${below}`)
    assert.equal(captionMismatchSeverity(belowCap, belowNar), 'warn')

    // 3/8 = 0.375 → ok
    const aboveCap = 'alpha bravo charlie delta echo foxtrot golf hotel'
    const aboveNar = 'alpha bravo charlie xray yankee zulu whiskey'
    const above = captionNarrationOverlap(aboveCap, aboveNar)
    assert.ok(above >= 0.35 && above < 0.4, `expected ~0.375 got ${above}`)
    assert.equal(captionMismatchSeverity(aboveCap, aboveNar), 'ok')
  })

  it('swapped proper nouns hard-fail (Haaland vs Salah)', () => {
    const caption = 'Haaland scores hat-trick against Arsenal'
    const narration = 'Salah misses penalty in Liverpool derby'
    assert.equal(captionMismatchSeverity(caption, narration), 'fail')
    const job = healthyJob({
      overlayMoments: 'off',
      script: { scenes: [{ caption, narration, durationSec: 5 }] },
      narrationManifest: [],
    })
    assert.equal(byId(collectEofShortQualityPlanChecks(job), 'captions_mismatch_0')?.severity, 'fail')
    assert.equal(runEofShortQualityPreflight(job, { mode: 'auto' }).blocked, true)
  })

  it('empty VO with caption does not throw; mismatch severity is ok', () => {
    assert.equal(captionMismatchSeverity('England need a reset after the derby', ''), 'ok')
    assert.equal(captionMismatchSeverity('England need a reset after the derby', '   '), 'ok')
    const job = healthyJob({
      script: {
        scenes: [
          { caption: 'England need a reset after the derby', narration: '', durationSec: 4 },
          {
            caption: 'Manager faces media tomorrow morning',
            narration: 'The manager faces the media tomorrow morning.',
            durationSec: 4,
          },
        ],
      },
    })
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(job))
    assert.doesNotThrow(() => runEofShortQualityPreflight(job, { mode: 'manual' }))
  })

  it('huge caption strings do not throw or hang plan checks', () => {
    const huge = `${'England pressure mounts after tough night. '.repeat(400)}Messi`
    assert.ok(huge.length > 10_000)
    assert.doesNotThrow(() => captionMismatchSeverity(huge, 'Ronaldo slammed critics after match'))
    assert.doesNotThrow(() => buildWordBeats(huge.slice(0, 2000), 6))
    const job = healthyJob({
      script: {
        scenes: [{ caption: huge, narration: 'England pressure mounts after a tough night.', durationSec: 5 }],
      },
    })
    const checks = collectEofShortQualityPlanChecks(job)
    assert.ok(Array.isArray(checks))
  })

  it('RTL / unicode / emoji captions do not throw through gate helpers', () => {
    const rtl = 'إنجلترا تحت الضغط الليلة بعد الخسارة الثقيلة'
    const mixed = 'Роналду 🔥 scored — café résumé 日本語テスト'
    assert.doesNotThrow(() => captionMismatchSeverity(rtl, 'England under pressure tonight after loss'))
    assert.doesNotThrow(() => captionMismatchSeverity(mixed, mixed))
    assert.doesNotThrow(() => buildWordBeats(rtl, 4))
    assert.doesNotThrow(() => buildWordBeats(mixed, 4))
    const job = healthyJob({
      script: {
        scenes: [
          { caption: rtl, narration: 'England under pressure tonight after a heavy loss.', durationSec: 4 },
          { caption: mixed, narration: 'Ronaldo scored again in a dramatic night.', durationSec: 4 },
        ],
      },
    })
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(job))
    assert.doesNotThrow(() => runEofShortQualityPreflight(job, { mode: 'manual' }))
  })

  it('HTML / script injection in caption text does not throw or escape into filter-like ids', () => {
    const xss = `<script>alert('xss')</script><img src=x onerror=alert(1)> England pressure`
    const job = healthyJob({
      script: {
        scenes: [
          {
            caption: xss,
            narration: 'England face pressure after a tough result tonight.',
            durationSec: 4,
          },
        ],
      },
    })
    const checks = collectEofShortQualityPlanChecks(job)
    assert.ok(Array.isArray(checks))
    for (const c of checks) {
      assert.equal(String(c.id || '').includes('<'), false)
      assert.equal(String(c.id || '').includes('script'), false)
    }
    const gate = finalizeEofQualityGate(checks, { mode: 'manual', phase: 'preflight' })
    assert.doesNotThrow(() => JSON.stringify(gate))
  })
})

describe('EOF hard — remux flag matrix (all combos)', () => {
  it('enumerates skipPlan × skipStills × reuseSceneImages × allowNoMusic', () => {
    const bools = [false, true]
    let n = 0
    for (const skipPlan of bools) {
      for (const skipStills of bools) {
        for (const reuse of bools) {
          for (const allowNoMusic of bools) {
            n += 1
            const opts = {
              skipPlanPreflight: skipPlan,
              skipStillsPreflight: skipStills,
              reuseSceneImages: reuse,
              allowNoMusic,
            }
            assert.equal(shouldSkipEofPlanPreflight(opts), skipPlan === true)
            assert.equal(
              shouldSkipEofStillsPreflight(opts),
              skipStills === true || reuse === true,
            )
            assert.equal(
              shouldEofAllowNoMusic(opts, { musicTrackId: null }),
              allowNoMusic === true,
            )
            assert.equal(
              shouldEofAllowNoMusic(opts, { musicTrackId: 'bed-1' }),
              false,
            )
          }
        }
      }
    }
    assert.equal(n, 16)

    const remux = eofRemuxVideoJobOpts()
    assert.equal(shouldSkipEofPlanPreflight(remux), true)
    assert.equal(shouldSkipEofStillsPreflight(remux), true)
    // remux opts alone do not imply allowNoMusic
    assert.equal(shouldEofAllowNoMusic(remux, { musicTrackId: null }), false)
  })

  it('sequential remux-style option flips stay consistent (concurrent-ish)', () => {
    const sequence = [
      {},
      { reuseSceneImages: true },
      { skipStillsPreflight: true },
      { skipPlanPreflight: true, reuseSceneImages: true },
      eofRemuxVideoJobOpts(),
      eofRemuxVideoJobOpts({ captionMode: 'zapcap-only' }),
      { allowNoMusic: true },
      { skipPlanPreflight: true, skipStillsPreflight: true, reuseSceneImages: false, allowNoMusic: true },
    ]
    for (const opts of sequence) {
      assert.doesNotThrow(() => shouldSkipEofPlanPreflight(opts))
      assert.doesNotThrow(() => shouldSkipEofStillsPreflight(opts))
      assert.doesNotThrow(() => shouldEofAllowNoMusic(opts, { musicTrackId: null }))
      assert.equal(typeof shouldSkipEofPlanPreflight(opts), 'boolean')
      assert.equal(typeof shouldSkipEofStillsPreflight(opts), 'boolean')
    }
  })
})

describe('EOF hard — pop geometry boundaries', () => {
  it('exactly on face-band edge (yMax) does not count as covering', () => {
    // rect.y < yMax is required — equality is outside the face zone.
    const onEdge = { ...EOF_OVERLAY_LAYOUT, yFrac: EOF_OVERLAY_FACE_ZONE.yMax, heightFrac: 0.2 }
    const rect = eofOverlayCardRect(onEdge)
    assert.equal(rect.y, EOF_OVERLAY_FACE_ZONE.yMax)
    assert.equal(eofOverlayCoversFaceZone(onEdge), false)
  })

  it('just inside face band edge covers eyes', () => {
    const inside = {
      ...EOF_OVERLAY_LAYOUT,
      yFrac: EOF_OVERLAY_FACE_ZONE.yMax - 0.001,
      heightFrac: 0.2,
    }
    assert.equal(eofOverlayCoversFaceZone(inside), true)
    assert.equal(eofOverlayLayoutIsFaceSafe(inside), false)
  })

  it('zero / NaN size fracs fall back to defaults (no throw)', () => {
    assert.doesNotThrow(() => eofOverlayCardRect({ widthFrac: 0, heightFrac: 0, yFrac: 0 }))
    const zero = eofOverlayCardRect({ widthFrac: 0, heightFrac: 0, yFrac: 0 })
    assert.ok(zero.w > 0 && zero.h > 0)
    assert.ok(Number.isFinite(zero.y) && Number.isFinite(zero.bottom))

    const nan = eofOverlayCardRect({ widthFrac: NaN, heightFrac: NaN, yFrac: NaN })
    assert.ok(nan.w > 0 && nan.h > 0)
  })

  it('negative fracs are clamped to safe positive geometry', () => {
    const neg = eofOverlayCardRect({ widthFrac: -0.5, heightFrac: -1, yFrac: -0.2 })
    assert.ok(neg.w > 0 && neg.w <= 1)
    assert.ok(neg.h > 0)
    assert.ok(neg.y >= 0)
    assert.ok(Number.isFinite(neg.bottom))
    assert.doesNotThrow(() => eofOverlayCoversFaceZone({ widthFrac: -1, heightFrac: -1, yFrac: -1 }))
  })
})

describe('EOF hard — logo blur host / source edges', () => {
  it('ambiguous hosts / title-only soft match do not force blur', () => {
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({
        imageUrl: 'https://cdn.example.com/opaque.jpg',
        imageTitle: 'Getty Images archive plate',
      }),
      false,
    )
    const soft = detectEofNewsAgencyStill({
      imageUrl: 'https://images.unsplash.com/photo-1',
      imageTitle: 'Sky Sports studio lookalike',
    })
    assert.equal(soft.match, false)
    assert.equal(soft.softMatch, true)
  })

  it('query-string + mixed-case agency URLs still trigger strong match', () => {
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({
        imageUrl: 'https://E0.365DM.com/2024/rooney.jpg?w=1200&h=800&fm=jpg',
      }),
      true,
    )
    assert.equal(
      stillNeedsNewsAgencyLogoBlur({
        imageKey: 'oxylabs:https://Static.GettyImages.com/images/123.jpg?foo=bar&x=1',
      }),
      true,
    )
    const extracted = extractUrlFromEofImageKey(
      'google:https://media.gettyimages.com/id/9?k=6&src=API',
    )
    assert.match(extracted, /^https:\/\//i)
  })

  it('AP imageSource without host is strong match; empty meta is not', () => {
    assert.equal(stillNeedsNewsAgencyLogoBlur({ imageSource: 'ap' }), true)
    assert.equal(stillNeedsNewsAgencyLogoBlur({ imageSource: 'AP' }), true)
    assert.equal(stillNeedsNewsAgencyLogoBlur({ imageSource: 'oxylabs' }), false)
    assert.equal(stillNeedsNewsAgencyLogoBlur({}), false)
  })
})

describe('EOF hard — music trim adversarial', () => {
  it('end < start / NaN / negative / beyond track / start==end normalize safely', () => {
    const endBefore = normalizeEofMusicTrim({ musicStartSec: 20, musicEndSec: 5, trackDurationSec: 90 })
    assert.equal(endBefore.startSec, 20)
    assert.equal(endBefore.endSec, null)

    const nan = normalizeEofMusicTrim({ musicStartSec: NaN, musicEndSec: NaN, trackDurationSec: 60 })
    assert.equal(nan.startSec, 0)
    assert.equal(nan.endSec, null)

    const neg = normalizeEofMusicTrim({ musicStartSec: -12, musicEndSec: -3, trackDurationSec: 60 })
    assert.equal(neg.startSec, 0)
    assert.equal(neg.endSec, null)

    const beyond = normalizeEofMusicTrim({
      musicStartSec: 10,
      musicEndSec: 999,
      trackDurationSec: 40,
    })
    assert.equal(beyond.startSec, 10)
    assert.equal(beyond.endSec, 40)

    const same = normalizeEofMusicTrim({ musicStartSec: 8, musicEndSec: 8, trackDurationSec: 60 })
    assert.equal(same.startSec, 8)
    assert.equal(same.endSec, null)

    assert.doesNotThrow(() => formatEofMusicTrimLabel({ startSec: NaN, endSec: -1 }))
  })
})

describe('EOF hard — watermark invalid env', () => {
  it('invalid size/x/y/opacity env values stay finite (no crash)', () => {
    const layout = resolveEofWatermarkLayout({
      EOF_WATERMARK_SIZE: 'not-a-number',
      EOF_WATERMARK_X: 'NaN',
      EOF_WATERMARK_Y: '',
      EOF_WATERMARK_OPACITY: 'abc',
      EOF_WATERMARK_POSITION: '???',
    })
    assert.equal(Number.isFinite(layout.cornerW), true)
    assert.equal(Number.isFinite(layout.markX), true)
    assert.equal(Number.isFinite(layout.markY), true)
    assert.equal(Number.isFinite(layout.opacity), true)
    assert.ok(layout.cornerW >= 120 && layout.cornerW <= 420)
    assert.ok(layout.opacity >= 0.05 && layout.opacity <= 1)
    assert.ok(layout.markX >= 0 && layout.markY >= 0)
  })
})

describe('EOF hard — history rapid append + Slack notify', () => {
  it('rapid repeated gate appends keep newest-last order and hard cap', () => {
    let hist = []
    const total = EOF_QUALITY_GATE_HISTORY_LIMIT * 4
    for (let i = 0; i < total; i += 1) {
      hist = appendEofQualityGateHistory(hist, {
        pass: i % 2 === 0,
        blocked: i % 5 === 0,
        phase: i % 3 === 0 ? 'preflight' : i % 3 === 1 ? 'stills' : 'post',
        mode: 'auto',
        checkedAt: `t-${String(i).padStart(4, '0')}`,
        reasons: i % 2 === 0 ? [] : [`r${i}`],
        warnings: [],
      })
    }
    assert.equal(hist.length, EOF_QUALITY_GATE_HISTORY_LIMIT)
    // Newest last
    assert.equal(hist.at(-1).checkedAt, `t-${String(total - 1).padStart(4, '0')}`)
    for (let i = 1; i < hist.length; i += 1) {
      assert.ok(hist[i].checkedAt >= hist[i - 1].checkedAt)
    }
    // Malformed prior does not throw
    assert.deepEqual(parseEofQualityGateHistory('{bad'), [])
    assert.doesNotThrow(() => appendEofQualityGateHistory('{bad', { pass: true, blocked: false }))
  })

  it('Slack notify: missing webhook, non-blocked, fetch throw → no crash', async () => {
    const prevA = process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK
    const prevB = process.env.EOF_SLACK_WEBHOOK
    const originalFetch = globalThis.fetch

    try {
      delete process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK
      delete process.env.EOF_SLACK_WEBHOOK
      const missing = await notifyEofQualityGateBlocked({
        gate: { blocked: true, phase: 'post', mode: 'auto', reasons: ['x'] },
      })
      assert.equal(missing.sent, false)
      assert.equal(missing.reason, 'webhook_unset')

      process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK = 'http://insecure.example.com/hook'
      const insecure = await notifyEofQualityGateBlocked({
        gate: { blocked: true, phase: 'post', mode: 'auto', reasons: ['x'] },
      })
      assert.equal(insecure.sent, false)
      assert.equal(insecure.reason, 'webhook_unset')

      process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK = 'https://hooks.example.com/services/test'
      const notBlocked = await notifyEofQualityGateBlocked({
        gate: { blocked: false, phase: 'post', mode: 'auto', reasons: [] },
      })
      assert.equal(notBlocked.sent, false)
      assert.equal(notBlocked.reason, 'not_blocked')

      globalThis.fetch = async () => {
        throw new Error('network down')
      }
      const threw = await notifyEofQualityGateBlocked({
        jobId: 'j-hard',
        topic: 'England',
        gate: { blocked: true, phase: 'stills', mode: 'auto', reasons: ['fail qa'] },
      })
      assert.equal(threw.sent, false)
      assert.equal(threw.reason, 'fetch_error')
    } finally {
      globalThis.fetch = originalFetch
      if (prevA == null) delete process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK
      else process.env.EOF_QUALITY_GATE_SLACK_WEBHOOK = prevA
      if (prevB == null) delete process.env.EOF_SLACK_WEBHOOK
      else process.env.EOF_SLACK_WEBHOOK = prevB
    }
  })
})

describe('EOF hard — filter-string safety', () => {
  it('logo blur + pop crop fragments have no raw newlines / quotes', () => {
    const blur = buildNewsAgencyLogoBlurFilterFragment({
      frameW: 1080,
      frameH: 1920,
      labelPrefix: 'nlb_hard',
    })
    assert.ok(blur.length > 0)
    assertFilterStringSafe(blur, 'logo blur', { forbidQuotes: true })
    assert.match(blur, /boxblur=\d+:\d+/)
    assert.match(blur, /crop=\d+:\d+:\d+:\d+/)

    const pop = buildOverlayPopFilterFragments({
      startSec: 1,
      endSec: 3,
      agencyLogoBlur: true,
    })
    // Pop scale uses quoted exprs; still must not embed line breaks that split -filter_complex.
    // Pop scale/geq use quoted ffmpeg exprs; assert no line-break splits only.
    assertFilterStringSafe(pop.overlayPrep, 'pop overlayPrep')
    assertFilterStringSafe(pop.shadowPrep, 'pop shadowPrep')
    assertFilterStringSafe(pop.enableExpr, 'pop enable', { forbidQuotes: true })
    assert.match(pop.overlayPrep, /crop=/)
    assert.match(pop.overlayPrep, /scale=/)
  })
})

describe('EOF hard — null-prototype / partial jobs through gate', () => {
  const prevGate = process.env.EOF_SHORT_QUALITY_GATE

  beforeEach(() => {
    process.env.EOF_SHORT_QUALITY_GATE = 'auto'
  })

  afterEach(() => {
    if (prevGate == null) delete process.env.EOF_SHORT_QUALITY_GATE
    else process.env.EOF_SHORT_QUALITY_GATE = prevGate
  })

  it('Object.create(null) and partial jobs do not throw on plan/stills/post', async () => {
    const nullProto = Object.create(null)
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(nullProto))
    assert.doesNotThrow(() => collectEofShortQualityStillsChecks(nullProto))
    assert.doesNotThrow(() => runEofShortQualityPreflight(nullProto, { mode: 'manual' }))

    await assert.doesNotReject(async () =>
      runEofShortQualityGate(nullProto, { mode: 'manual', skipVision: true }),
    )

    const partial = Object.create(null)
    partial.topic = 'x'
    partial.captionStyle = 'live'
    partial.script = Object.create(null)
    partial.script.scenes = [{ caption: 'a', narration: 'b', durationSec: 4 }]
    await assert.doesNotReject(async () =>
      runEofShortQualityGate(partial, { mode: 'manual', skipVision: true }),
    )

    const weird = {
      script: { scenes: [null, undefined, { caption: 12, narration: null, durationSec: 'nope' }] },
      narrationManifest: [null, { imageSource: undefined }],
      musicTrackId: undefined,
      musicVolume: 'loud',
    }
    assert.doesNotThrow(() => collectEofShortQualityPlanChecks(weird))
    assert.doesNotThrow(() => collectEofShortQualityStillsChecks(weird))
    await assert.doesNotReject(async () =>
      runEofShortQualityGate(weird, { mode: 'manual', skipVision: true }),
    )
  })
})

describe('EOF hard — placeholder threshold edges', () => {
  const prevGate = process.env.EOF_SHORT_QUALITY_GATE
  const prevPlaceholder = process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER

  beforeEach(() => {
    process.env.EOF_SHORT_QUALITY_GATE = 'auto'
  })

  afterEach(() => {
    if (prevGate == null) delete process.env.EOF_SHORT_QUALITY_GATE
    else process.env.EOF_SHORT_QUALITY_GATE = prevGate
    if (prevPlaceholder == null) delete process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER
    else process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = prevPlaceholder
  })

  it('just below / at / above EOF_SHORT_QUALITY_MAX_PLACEHOLDER', () => {
    // 1/2 = 0.5
    const halfPlaceholders = healthyJob({
      narrationManifest: [
        { index: 0, durationSec: 4, caption: 'a', imageSource: 'placeholder', imageKey: 'p0' },
        { index: 1, durationSec: 4, caption: 'b', imageSource: 'oxylabs', imageKey: 'k1' },
      ],
    })

    process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = '0.51'
    assert.ok(maxPlaceholderFraction() > 0.5)
    assert.equal(byId(collectEofShortQualityStillsChecks(halfPlaceholders), 'stills_placeholder')?.severity, 'warn')

    process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = '0.5'
    assert.equal(maxPlaceholderFraction(), 0.5)
    // frac > max → fail; equal is warn
    assert.equal(byId(collectEofShortQualityStillsChecks(halfPlaceholders), 'stills_placeholder')?.severity, 'warn')

    process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = '0.49'
    assert.ok(maxPlaceholderFraction() < 0.5)
    assert.equal(byId(collectEofShortQualityStillsChecks(halfPlaceholders), 'stills_placeholder')?.severity, 'fail')
  })

  it('invalid MAX_PLACEHOLDER env falls back without crashing', () => {
    process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = 'nope'
    assert.equal(maxPlaceholderFraction(), 0.34)
    process.env.EOF_SHORT_QUALITY_MAX_PLACEHOLDER = ''
    assert.equal(maxPlaceholderFraction(), 0.34)
  })
})
