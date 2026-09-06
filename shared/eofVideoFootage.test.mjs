import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEofVideoSearchQueries,
  extractEofSceneMomentKeywords,
  assessEofVideoCopyrightRisk,
  rankEofVideoCandidates,
  assessEofVideoTechnicalGate,
  resolveEofVideoClipWindow,
  EOF_VIDEO_MAX_FILE_BYTES,
} from './eofVideoFootage.mjs'
import { resolveEofVideoMomentDecision } from '../backend/api/lib/eofVideoQualityGate.mjs'
import { buildYtDlpInvocationArgs } from '../backend/api/lib/eofYtDlp.mjs'

describe('buildYtDlpInvocationArgs', () => {
  it('enables the Node challenge solver and preserves cookie authentication', () => {
    assert.deepEqual(buildYtDlpInvocationArgs(['https://youtube.test/video'], '/tmp/cookies.txt'), [
      '--js-runtimes',
      'node',
      '--cookies',
      '/tmp/cookies.txt',
      'https://youtube.test/video',
    ])
  })
})

describe('extractEofSceneMomentKeywords', () => {
  it('pulls distinctive non-stopword keywords from a caption', () => {
    const words = extractEofSceneMomentKeywords('Cucurella was walking on the pitch with his son after training.')
    assert.ok(words.includes('cucurella'))
    assert.ok(words.includes('walking'))
    assert.ok(words.includes('pitch'))
    assert.ok(!words.includes('the'))
    assert.ok(!words.includes('with'))
  })

  it('returns empty array for empty caption', () => {
    assert.deepEqual(extractEofSceneMomentKeywords(''), [])
  })
})

describe('buildEofVideoSearchQueries', () => {
  it('builds an ordered, deduped list biased toward the exact moment first', () => {
    const queries = buildEofVideoSearchQueries({
      subject: 'Marc Cucurella',
      sceneCaption: 'Cucurella walking on the pitch with his son.',
    })
    assert.ok(queries.length > 0)
    assert.ok(queries[0].toLowerCase().includes('cucurella'))
    assert.equal(new Set(queries).size, queries.length)
  })

  it('returns empty array when no subject or topic given', () => {
    assert.deepEqual(buildEofVideoSearchQueries({ sceneCaption: 'something' }), [])
  })
})

describe('assessEofVideoCopyrightRisk', () => {
  it('flags official broadcaster + full-match duration as high risk', () => {
    const { risk, reasons } = assessEofVideoCopyrightRisk({
      title: 'FULL MATCH HIGHLIGHTS 2024',
      channel: 'Premier League',
      duration: 95 * 60,
    })
    assert.equal(risk, 'high')
    assert.ok(reasons.length > 0)
  })

  it('treats classic/training footage as low risk', () => {
    const { risk } = assessEofVideoCopyrightRisk({
      title: 'Classic training session footage',
      channel: 'Old Football Archive',
      duration: 120,
    })
    assert.equal(risk, 'low')
  })
})

describe('rankEofVideoCandidates', () => {
  it('ranks low-risk, subject-matching, short clips above risky ones', () => {
    const ranked = rankEofVideoCandidates(
      [
        { id: 'a', title: 'Official Full Match Highlights 2024', channel: 'Premier League', duration: 95 * 60 },
        { id: 'b', title: 'Cucurella classic training footage', channel: 'Archive', duration: 90 },
      ],
      { subject: 'Cucurella' },
    )
    assert.equal(ranked[0].id, 'b')
    assert.equal(ranked[1].id, 'a')
  })
})

describe('assessEofVideoTechnicalGate', () => {
  it('passes a normal-sized, well-resolved short clip', () => {
    const { pass } = assessEofVideoTechnicalGate({
      sizeBytes: 20 * 1024 * 1024,
      durationSec: 60,
      width: 1080,
      height: 1920,
    })
    assert.equal(pass, true)
  })

  it('rejects an oversized file', () => {
    const { pass, reasons } = assessEofVideoTechnicalGate({
      sizeBytes: EOF_VIDEO_MAX_FILE_BYTES + 1,
      durationSec: 60,
      width: 1080,
      height: 1920,
    })
    assert.equal(pass, false)
    assert.ok(reasons.some((r) => r.includes('too heavy')))
  })

  it('rejects a too-long full-match-length source', () => {
    const { pass } = assessEofVideoTechnicalGate({
      sizeBytes: 20 * 1024 * 1024,
      durationSec: 25 * 60,
      width: 1080,
      height: 1920,
    })
    assert.equal(pass, false)
  })
})

describe('resolveEofVideoClipWindow', () => {
  it('centers the window on the best timestamp when given', () => {
    const win = resolveEofVideoClipWindow({ sourceDurationSec: 100, targetDurationSec: 4, bestTimestampSec: 50 })
    assert.equal(win.endSec - win.startSec, 4)
    assert.ok(win.startSec < 50 && win.endSec > 50)
  })

  it('clamps the window inside source bounds near the edges', () => {
    const win = resolveEofVideoClipWindow({ sourceDurationSec: 10, targetDurationSec: 4, bestTimestampSec: 0.5 })
    assert.ok(win.startSec >= 0)
    assert.ok(win.endSec <= 10)
  })

  it('falls back to the midpoint when no timestamp given', () => {
    const win = resolveEofVideoClipWindow({ sourceDurationSec: 100, targetDurationSec: 10 })
    assert.equal(win.startSec, 45)
    assert.equal(win.endSec, 55)
  })
})

describe('resolveEofVideoMomentDecision', () => {
  it('allows a technically safe clip to use its midpoint when optional vision is not configured', () => {
    assert.deepEqual(
      resolveEofVideoMomentDecision({ visionConfigured: false }),
      {
        pass: true,
        reason: 'vision matching not configured; using source midpoint',
        bestTimestampSec: null,
      },
    )
  })

  it('still rejects a clip when configured vision cannot match the narrated moment', () => {
    const decision = resolveEofVideoMomentDecision({
      visionConfigured: true,
      moment: { matched: false, score: 2, reason: 'wrong player', evaluated: true },
    })
    assert.equal(decision.pass, false)
    assert.match(decision.reason, /wrong player/)
  })

  it('uses the midpoint when the configured vision provider cannot evaluate the clip', () => {
    const decision = resolveEofVideoMomentDecision({
      visionConfigured: true,
      moment: {
        matched: false,
        score: 0,
        reason: 'provider request failed',
        evaluated: false,
      },
    })
    assert.equal(decision.pass, true)
    assert.equal(decision.bestTimestampSec, null)
    assert.match(decision.reason, /provider request failed/)
  })

  it('uses the midpoint when frame sampling could not produce an evaluation', () => {
    const decision = resolveEofVideoMomentDecision({
      visionConfigured: true,
      moment: {
        matched: false,
        score: 0,
        reason: 'no frames sampled',
        evaluated: false,
      },
    })
    assert.equal(decision.pass, true)
    assert.equal(decision.bestTimestampSec, null)
  })

  it('uses the matched timestamp when configured vision approves the clip', () => {
    assert.deepEqual(
      resolveEofVideoMomentDecision({
        visionConfigured: true,
        moment: {
          matched: true,
          score: 8,
          bestTimestampSec: 42,
          reason: 'correct scene',
          evaluated: true,
        },
      }),
      { pass: true, reason: 'ok', bestTimestampSec: 42 },
    )
  })
})
