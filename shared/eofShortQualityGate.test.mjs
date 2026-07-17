import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import {
  captionNarrationOverlap,
  captionLooksMismatched,
  collectEofShortQualityHeuristicChecks,
  finalizeEofQualityGate,
  parseEofQualityGate,
  summarizeEofQualityGate,
  formatEofQualityGateBlockMessage,
  isEofShortQualityGateEnabled,
  isEofShortQualityVisionEnabled,
  runEofShortQualityGate,
} from '../backend/api/lib/eofShortQualityGate.mjs'

describe('eofShortQualityGate helpers', () => {
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

  it('enables gate by default and vision off by default', () => {
    assert.equal(isEofShortQualityGateEnabled(), true)
    assert.equal(isEofShortQualityVisionEnabled(), false)
    process.env.EOF_SHORT_QUALITY_GATE = 'off'
    assert.equal(isEofShortQualityGateEnabled(), false)
  })

  it('measures caption/narration word overlap', () => {
    assert.ok(
      captionNarrationOverlap(
        'Bellingham hit back at Tuchel',
        'Jude Bellingham hit back at Thomas Tuchel after the presser',
      ) >= 0.6,
    )
    assert.ok(captionNarrationOverlap('totally unrelated golf news', 'football transfer drama tonight') < 0.35)
  })

  it('flags mismatched captions vs voiceover', () => {
    assert.equal(
      captionLooksMismatched(
        'Completely different topic about tennis rackets today',
        'Jude Bellingham hit back at Thomas Tuchel after heat comments',
      ),
      true,
    )
    assert.equal(
      captionLooksMismatched(
        'Bellingham hit back at Tuchel',
        'Jude Bellingham hit back at Thomas Tuchel after the presser',
      ),
      false,
    )
  })

  it('fails on placeholders, missing music, and empty captions', () => {
    const checks = collectEofShortQualityHeuristicChecks({
      topic: 'Jude Bellingham',
      captionStyle: 'live',
      captionLayout: { yNorm: 0.76, fontScale: 1 },
      musicTrackId: null,
      musicVolume: 0.22,
      mixedAudioPath: 'storage/eof/jobs/x/mixed.mp3',
      renderOutputPath: 'storage/eof/jobs/x/out.mp4',
      overlayMoments: 'off',
      script: {
        scenes: [
          { narration: 'Jude Bellingham hit back at Thomas Tuchel after heat comments.', caption: '' },
          {
            narration: 'Bellingham said Tuchel does not know that heat.',
            caption: 'Bellingham said Tuchel does not know that heat.',
          },
        ],
      },
      narrationManifest: [
        { index: 0, durationSec: 4, caption: '', imageSource: 'placeholder', imageKey: 'a' },
        { index: 1, durationSec: 4, caption: 'ok', imageSource: 'placeholder', imageKey: 'b' },
      ],
    })
    const ids = checks.map((c) => c.id)
    assert.ok(ids.includes('stills_placeholder'))
    assert.ok(ids.includes('music_missing_track'))
    assert.ok(ids.some((id) => id.startsWith('captions_empty')))
    const gate = finalizeEofQualityGate(checks, { mode: 'auto' })
    assert.equal(gate.pass, false)
    assert.equal(gate.blocked, true)
    assert.ok(gate.reasons.length >= 2)
  })

  it('passes a healthy Short snapshot', () => {
    const vo1 =
      'Jude Bellingham hit back at Thomas Tuchel after Tuchel questioned his performance in the heat.'
    const vo2 =
      'Bellingham said Tuchel does not know what it is like to play in that heat. Fair response?'
    const checks = collectEofShortQualityHeuristicChecks(
      {
        topic: 'Jude Bellingham',
        captionStyle: 'live',
        captionLayout: { yNorm: 0.76, fontScale: 1 },
        musicTrackId: 'bed-1',
        musicVolume: 0.22,
        musicStartSec: 0,
        musicEndSec: null,
        mixedAudioPath: 'storage/eof/jobs/x/mixed.mp3',
        renderOutputPath: 'storage/eof/jobs/x/out.mp4',
        overlayMoments: 'auto',
        script: {
          scenes: [
            { narration: vo1, caption: 'Bellingham hit back at Tuchel after heat comments', durationSec: 5 },
            { narration: vo2, caption: 'Bellingham said Tuchel does not know that heat', durationSec: 5 },
            {
              narration: 'Agree with Bellingham or Tuchel? Drop your take.',
              caption: 'Agree with Bellingham or Tuchel? Drop your take.',
              durationSec: 4,
            },
          ],
        },
        narrationManifest: [
          { index: 0, durationSec: 5, caption: 'Bellingham hit back at Tuchel after heat comments', imageSource: 'google', imageKey: 'k1' },
          { index: 1, durationSec: 5, caption: 'Bellingham said Tuchel does not know that heat', imageSource: 'google', imageKey: 'k2' },
          { index: 2, durationSec: 4, caption: 'Agree with Bellingham or Tuchel? Drop your take.', imageSource: 'google', imageKey: 'k3' },
        ],
      },
      {
        overlayCount: 1,
        overlayMoments: [{ sceneIndex: 1, absoluteStartSec: 5.4, absoluteEndSec: 8.2 }],
        hasSecondarySubject: true,
        secondarySceneIndex: 1,
        captionEngine: 'local',
      },
    )
    const gate = finalizeEofQualityGate(checks, { mode: 'manual' })
    assert.equal(gate.pass, true)
    assert.equal(gate.blocked, false)
    assert.equal(gate.reasons.length, 0)
  })

  it('fails Always overlay when no inset was rendered', () => {
    const checks = collectEofShortQualityHeuristicChecks(
      {
        topic: 'Rooney',
        captionStyle: 'off',
        musicTrackId: 'bed-1',
        musicVolume: 0.2,
        mixedAudioPath: 'a.mp3',
        renderOutputPath: 'v.mp4',
        overlayMoments: 'always',
        script: {
          scenes: [
            { narration: 'Wayne Rooney presser night.', caption: 'Wayne Rooney presser night.', durationSec: 4 },
            { narration: 'Tuchel responds in studio.', caption: 'Tuchel responds in studio.', durationSec: 4 },
          ],
        },
        narrationManifest: [
          { index: 0, durationSec: 4, imageSource: 'google', imageKey: 'r1' },
          { index: 1, durationSec: 4, imageSource: 'google', imageKey: 't1' },
        ],
      },
      { overlayCount: 0 },
    )
    assert.ok(checks.some((c) => c.id === 'overlay_missing_always' && c.severity === 'fail'))
  })

  it('fails when pop inset still has baked clickbait text', () => {
    const checks = collectEofShortQualityHeuristicChecks(
      {
        topic: 'Thomas Tuchel',
        captionStyle: 'off',
        musicTrackId: 'bed-1',
        musicVolume: 0.22,
        mixedAudioPath: 'a.mp3',
        renderOutputPath: 'v.mp4',
        overlayMoments: 'auto',
        script: {
          scenes: [
            { narration: 'Tuchel presser.', caption: 'Tuchel presser.', durationSec: 4 },
            { narration: 'Bananas headline.', caption: 'Bananas headline.', durationSec: 4 },
            { narration: 'Take your side.', caption: 'Take your side.', durationSec: 4 },
          ],
        },
        narrationManifest: [
          { index: 0, durationSec: 4, imageSource: 'google', imageKey: 'a', imageTitle: 'Tuchel presser' },
          {
            index: 1,
            durationSec: 4,
            imageSource: 'google',
            imageKey: 'b',
            imageTitle: 'THOMAS TUCHEL IS GOING BANANAS!',
          },
          { index: 2, durationSec: 4, imageSource: 'google', imageKey: 'c', imageTitle: 'Studio' },
        ],
      },
      {
        overlayCount: 1,
        overlayMoments: [{ sceneIndex: 0, overlaySceneIndex: 1, absoluteStartSec: 0.5, absoluteEndSec: 2.5 }],
      },
    )
    assert.ok(checks.some((c) => c.id === 'overlay_bad_still' && c.severity === 'fail'))
    const gate = finalizeEofQualityGate(checks, { mode: 'auto' })
    assert.equal(gate.pass, false)
    assert.equal(gate.blocked, true)
  })

  it('current default pop layout does not cover the face zone', () => {
    const checks = collectEofShortQualityHeuristicChecks(
      {
        topic: 'Tuchel',
        captionStyle: 'off',
        musicTrackId: 'bed-1',
        musicVolume: 0.22,
        mixedAudioPath: 'a.mp3',
        renderOutputPath: 'v.mp4',
        overlayMoments: 'auto',
        script: { scenes: [{ narration: 'a', caption: 'a', durationSec: 4 }] },
        narrationManifest: [{ index: 0, durationSec: 4, imageSource: 'google', imageKey: 'a' }],
      },
      { overlayCount: 1, overlayMoments: [{ sceneIndex: 0, overlaySceneIndex: 0, absoluteStartSec: 0.5, absoluteEndSec: 2 }] },
    )
    assert.equal(
      checks.some((c) => c.id === 'overlay_covers_face'),
      false,
      'default layout must be face-safe after placement fix',
    )
  })

  it('parses and summarizes gate JSON', () => {
    const raw = JSON.stringify({
      pass: false,
      blocked: true,
      mode: 'auto',
      checkedAt: '2026-07-17T12:00:00.000Z',
      reasons: ['No music bed selected — Short expected a bed under the VO'],
      warnings: [],
      checks: [],
      visionUsed: false,
    })
    const gate = parseEofQualityGate(raw)
    assert.equal(gate.pass, false)
    assert.match(summarizeEofQualityGate(gate), /failed/i)
    assert.match(formatEofQualityGateBlockMessage(gate), /Quality gate blocked publish/)
  })

  it('runEofShortQualityGate returns skip when disabled', async () => {
    process.env.EOF_SHORT_QUALITY_GATE = 'off'
    const gate = await runEofShortQualityGate({ topic: 'x' }, { mode: 'manual', skipVision: true })
    assert.equal(gate.mode, 'off')
    assert.equal(gate.pass, true)
  })
})
