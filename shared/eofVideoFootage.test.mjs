import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEofVideoSearchQueries,
  extractEofSceneMomentKeywords,
  assessEofVideoCopyrightRisk,
  rankEofVideoCandidates,
  assessEofVideoTechnicalGate,
  assessEofVideoRelevance,
  scoreEofVideoAspect,
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
    assert.ok(queries[0].includes('"Marc Cucurella"'))
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
        { id: 'a', title: 'Cucurella Official Full Match Highlights 2024', channel: 'Premier League', duration: 95 * 60 },
        { id: 'b', title: 'Cucurella classic training footage', channel: 'Archive', duration: 90 },
      ],
      { subject: 'Cucurella' },
    )
    assert.equal(ranked[0].id, 'b')
    assert.equal(ranked[1].id, 'a')
  })

  it('rejects unrelated search results instead of trusting YouTube result order', () => {
    const ranked = rankEofVideoCandidates(
      [
        { id: 'wrong', title: 'Manchester City best transfers', channel: 'Football Daily', duration: 90 },
        { id: 'right', title: 'Sir Alex Ferguson rare Manchester United interview', channel: 'Archive', duration: 90 },
      ],
      {
        subject: 'Sir Alex Ferguson',
        sceneCaption: 'Fourteen transfer windows after Sir Alex walked out.',
      },
    )
    assert.deepEqual(ranked.map((candidate) => candidate.id), ['right'])
  })

  it('prefers vertical, portrait and square sources over wide footage when relevance is equal', () => {
    const base = {
      title: 'Marc Cucurella Chelsea training footage',
      channel: 'Football Archive',
      duration: 60,
    }
    const ranked = rankEofVideoCandidates(
      [
        { ...base, id: 'wide', width: 1920, height: 1080 },
        { ...base, id: 'square', width: 1080, height: 1080 },
        { ...base, id: 'portrait', width: 1080, height: 1440 },
        { ...base, id: 'vertical', width: 1080, height: 1920 },
      ],
      { subject: 'Marc Cucurella', sceneCaption: 'Cucurella training at Chelsea' },
    )
    assert.deepEqual(ranked.map((candidate) => candidate.id), [
      'vertical',
      'portrait',
      'square',
      'wide',
    ])
  })

  it('keeps a stronger scene match ahead of a merely vertical source', () => {
    const ranked = rankEofVideoCandidates(
      [
        {
          id: 'vertical-generic',
          title: 'Marc Cucurella career footage',
          channel: 'Archive',
          duration: 60,
          width: 1080,
          height: 1920,
        },
        {
          id: 'wide-specific',
          title: 'Marc Cucurella Chelsea training session',
          channel: 'Archive',
          duration: 60,
          width: 1920,
          height: 1080,
        },
      ],
      { subject: 'Marc Cucurella', sceneCaption: 'Cucurella at a Chelsea training session' },
    )
    assert.equal(ranked[0].id, 'wide-specific')
  })
})

describe('assessEofVideoRelevance', () => {
  it('requires a named subject in candidate metadata', () => {
    assert.equal(
      assessEofVideoRelevance(
        { title: 'Manchester United transfer debate', channel: 'Football Daily' },
        { subject: 'Sir Alex Ferguson' },
      ).pass,
      false,
    )
    assert.equal(
      assessEofVideoRelevance(
        { title: 'Sir Alex Ferguson discusses Manchester United', channel: 'Archive' },
        { subject: 'Sir Alex Ferguson' },
      ).pass,
      true,
    )
  })
})

describe('scoreEofVideoAspect', () => {
  it('orders TikTok-friendly source shapes ahead of wide video', () => {
    assert.ok(scoreEofVideoAspect(1080, 1920).score > scoreEofVideoAspect(1080, 1440).score)
    assert.ok(scoreEofVideoAspect(1080, 1440).score > scoreEofVideoAspect(1080, 1080).score)
    assert.ok(scoreEofVideoAspect(1080, 1080).score > scoreEofVideoAspect(1920, 1080).score)
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
