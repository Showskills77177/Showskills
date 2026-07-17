import assert from 'node:assert/strict'
import { describe, it, mock, before, after } from 'node:test'
import {
  buildEofImageGenPrompt,
  normalizeEofImageGenMode,
  normalizeEofImageGenProvider,
  resolveEofImageGenCount,
  resolveEofImageGenAttemptOrder,
  mergeEofScrapeAndGenHits,
  sortEofPoolHitsPreferScrape,
  shouldMergeEofImageGen,
  eofImageGenMaxPerJob,
} from '../backend/api/lib/eofImageGen.mjs'
import { buildPollinationsImageUrl } from '../backend/api/lib/eofFreeGenImages.mjs'
import { applyVisionScoresToHits } from '../backend/api/lib/eofImageVision.mjs'

describe('normalizeEofImageGenMode / provider', () => {
  it('normalizes modes and aliases', () => {
    assert.equal(normalizeEofImageGenMode('auto'), 'auto')
    assert.equal(normalizeEofImageGenMode('ALWAYS'), 'always')
    assert.equal(normalizeEofImageGenMode('on'), 'always')
    assert.equal(normalizeEofImageGenMode('off'), 'off')
    assert.equal(normalizeEofImageGenMode('nope'), 'auto')
  })

  it('normalizes providers', () => {
    assert.equal(normalizeEofImageGenProvider('grok'), 'grok')
    assert.equal(normalizeEofImageGenProvider('xai'), 'grok')
    assert.equal(normalizeEofImageGenProvider('pollinations'), 'free')
    assert.equal(normalizeEofImageGenProvider('free-gen'), 'free')
    assert.equal(normalizeEofImageGenProvider(''), 'auto')
  })
})

describe('buildEofImageGenPrompt', () => {
  it('includes named subject + intent cues', () => {
    const p = buildEofImageGenPrompt({ subject: 'Wayne Rooney', intent: 'pundit', topic: 'Rooney on Kane' })
    assert.match(p, /Wayne Rooney/)
    assert.match(p, /pundit|studio|suit/i)
    assert.match(p, /9:16/)
    assert.match(p, /no text/i)
    assert.match(p, /Rooney on Kane/)
  })

  it('uses playing kit cues for playing intent', () => {
    const p = buildEofImageGenPrompt({ subject: 'Harry Kane', intent: 'playing' })
    assert.match(p, /Harry Kane/)
    assert.match(p, /kit|match/i)
  })
})

describe('resolveEofImageGenCount (auto gapfill)', () => {
  it('off → 0; always → max', () => {
    assert.equal(resolveEofImageGenCount({ mode: 'off', scrapeHitCount: 0, sceneCount: 5, maxPerJob: 3 }), 0)
    assert.equal(
      resolveEofImageGenCount({ mode: 'always', scrapeHitCount: 20, sceneCount: 5, maxPerJob: 3 }),
      3,
    )
  })

  it('auto only when scrape pool is thin', () => {
    assert.equal(
      resolveEofImageGenCount({ mode: 'auto', scrapeHitCount: 8, sceneCount: 5, maxPerJob: 3 }),
      0,
    )
    assert.equal(
      resolveEofImageGenCount({ mode: 'auto', scrapeHitCount: 1, sceneCount: 5, maxPerJob: 3 }),
      3,
    )
    assert.equal(
      resolveEofImageGenCount({ mode: 'auto', scrapeHitCount: 0, sceneCount: 2, maxPerJob: 3 }),
      3,
    )
    assert.ok(shouldMergeEofImageGen({ mode: 'auto', scrapeHitCount: 1, sceneCount: 5 }))
    assert.equal(shouldMergeEofImageGen({ mode: 'auto', scrapeHitCount: 10, sceneCount: 4 }), false)
  })

  it('respects EOF_IMAGE_GEN_MAX_PER_JOB cap helper', () => {
    assert.equal(eofImageGenMaxPerJob('2'), 2)
    assert.equal(eofImageGenMaxPerJob('99'), 6)
    assert.equal(eofImageGenMaxPerJob(''), 3)
  })
})

describe('resolveEofImageGenAttemptOrder', () => {
  it('auto prefers Grok then free', () => {
    assert.deepEqual(resolveEofImageGenAttemptOrder('auto', { grok: true, free: true }), [
      'grok',
      'free',
    ])
  })

  it('free preference puts Pollinations first', () => {
    assert.deepEqual(resolveEofImageGenAttemptOrder('free', { grok: true, free: true }), [
      'free',
      'grok',
    ])
  })

  it('skips missing providers', () => {
    assert.deepEqual(resolveEofImageGenAttemptOrder('grok', { grok: false, free: true }), ['free'])
  })
})

describe('merge + prefer scrape on tie', () => {
  it('merges scrape first then gen, dedupes', () => {
    const merged = mergeEofScrapeAndGenHits(
      [
        { url: 'https://a.test/1.jpg', source: 'serpapi', title: 'Rooney' },
        { url: 'https://a.test/2.jpg', source: 'serpapi' },
      ],
      [
        { url: 'https://a.test/1.jpg', source: 'grok-imagine' },
        { url: 'file:///tmp/gen.jpg', localPath: '/tmp/gen.jpg', source: 'free-gen' },
      ],
    )
    assert.equal(merged.length, 3)
    assert.equal(merged[0].source, 'serpapi')
    assert.equal(merged[2].source, 'free-gen')
  })

  it('sort prefers scrape when vision scores tie', () => {
    const sorted = sortEofPoolHitsPreferScrape([
      { url: 'g', source: 'grok-imagine', visionScore: 7 },
      { url: 's', source: 'serpapi', visionScore: 7 },
      { url: 'f', source: 'free-gen', visionScore: 8 },
    ])
    assert.equal(sorted[0].url, 'f')
    assert.equal(sorted[1].url, 's')
    assert.equal(sorted[2].url, 'g')
  })

  it('applyVisionScoresToHits prefers scrape on equal scores', () => {
    const scores = new Map([
      ['https://scrape.test/a.jpg', 7],
      ['https://gen.test/b.jpg', 7],
    ])
    const ranked = applyVisionScoresToHits(
      [
        { url: 'https://gen.test/b.jpg', source: 'grok-imagine', title: 'AI' },
        { url: 'https://scrape.test/a.jpg', source: 'serpapi', title: 'Real' },
      ],
      scores,
    )
    assert.equal(ranked[0].source, 'serpapi')
    assert.equal(ranked[1].source, 'grok-imagine')
  })

  it('applyVisionScoresToHits drops borderline score 4 (wrong-face risk)', () => {
    const scores = new Map([
      ['https://ok.test/a.jpg', 7],
      ['https://border.test/b.jpg', 4],
    ])
    const ranked = applyVisionScoresToHits(
      [
        { url: 'https://border.test/b.jpg', source: 'serpapi', title: 'Maybe Rooney' },
        { url: 'https://ok.test/a.jpg', source: 'serpapi', title: 'Wayne Rooney' },
      ],
      scores,
    )
    assert.equal(ranked.length, 1)
    assert.equal(ranked[0].url, 'https://ok.test/a.jpg')
  })
})

describe('buildPollinationsImageUrl', () => {
  it('builds 9:16 flux URL without requiring a key', () => {
    const url = buildPollinationsImageUrl('Wayne Rooney pundit studio', { seed: 42 })
    assert.match(url, /^https:\/\/image\.pollinations\.ai\/prompt\//)
    assert.match(url, /width=768/)
    assert.match(url, /height=1344/)
    assert.match(url, /model=flux/)
    assert.match(url, /seed=42/)
  })
})

describe('Grok Imagine client (mocked HTTP)', () => {
  const prevFetch = globalThis.fetch
  const prevKey = process.env.XAI_API_KEY

  before(() => {
    process.env.XAI_API_KEY = 'test-xai-key'
  })

  after(() => {
    globalThis.fetch = prevFetch
    if (prevKey === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = prevKey
  })

  it('POSTs images/generations with quality model + 9:16', async () => {
    let seen = null
    globalThis.fetch = mock.fn(async (url, init) => {
      seen = { url: String(url), body: JSON.parse(init.body) }
      return {
        ok: true,
        async json() {
          return { data: [{ url: 'https://cdn.x.ai/fake.jpg' }] }
        },
        async text() {
          return ''
        },
      }
    })
    const { requestGrokImagineImage } = await import('../backend/api/lib/eofGrokImagineImages.mjs')
    const out = await requestGrokImagineImage({ prompt: 'Wayne Rooney press photo' })
    assert.equal(out.url, 'https://cdn.x.ai/fake.jpg')
    assert.equal(seen.url, 'https://api.x.ai/v1/images/generations')
    assert.equal(seen.body.model, 'grok-imagine-image-quality')
    assert.equal(seen.body.aspect_ratio, '9:16')
    assert.equal(seen.body.n, 1)
    assert.match(seen.body.prompt, /Wayne Rooney/)
  })
})
