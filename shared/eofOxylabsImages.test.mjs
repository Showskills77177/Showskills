import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEofOxylabsConfigured,
  isEofOxylabsEnabled,
  extractOxylabsImageRows,
  pickOxylabsImageFromHits,
  listOxylabsImageCandidates,
  orderOxylabsHitsForRotation,
  claimOxylabsPoolHit,
  buildOxylabsJobQuery,
  scoreImageCandidate,
  scoreOxylabsHitForScene,
  searchOxylabsGoogleImagesWithStatus,
  formatOxylabsSearchHealthNote,
  EOF_OXYLABS_MAX_QUERIES_PER_JOB,
} from '../backend/api/lib/eofOxylabsImages.mjs'
import { resolveEofImageProviderAttemptOrder } from '../backend/api/lib/eofImageProviderSettings.mjs'
import {
  appendEofImageKeyHistory,
  assertEofVideoPersisted,
  shouldSkipEofStillsPreflight,
  formatEofNoSceneImagesError,
  priorStillsWerePlaceholders,
  clearEofImageAvoidHistoryFromManifest,
  shouldForceFreshEofSceneImages,
  EOF_IMAGE_KEY_HISTORY_LIMIT,
} from '../backend/api/lib/eofProductionRenderVideo.mjs'
import { withDeadline } from '../backend/api/lib/eofAsyncPool.mjs'
import { isEofRenderStale } from '../backend/api/lib/eofProductionJobs.mjs'

function mockHits(n) {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://cdn.example.com/photo-${i}.jpg`,
    title: `Photo ${i}`,
    width: 800,
    height: 1200,
  }))
}

describe('eofOxylabsImages', () => {
  it('builds person-first Oxylabs job queries (not manager/year noise)', () => {
    assert.match(buildOxylabsJobQuery('Wayne Rooney Everton', 0), /Wayne Rooney/i)
    assert.match(buildOxylabsJobQuery('Rooney', 0), /"Wayne Rooney" football/)
    assert.match(buildOxylabsJobQuery('Rooney', 1), /portrait/)
    assert.doesNotMatch(buildOxylabsJobQuery('Rooney', 2), /manager/i)
  })

  it('normalizes Cuccorea hair topics to Marc Cucurella Chelsea hair queries', () => {
    const topic = "Why Mark Cuccorea doesn't cut his hair"
    const q0 = buildOxylabsJobQuery(topic, 0)
    const q1 = buildOxylabsJobQuery(topic, 1)
    assert.match(q0, /Marc Cucurella/i)
    assert.match(q0, /Chelsea hair/i)
    assert.doesNotMatch(q0, /Cuccorea/i)
    assert.match(q1, /long hair|Chelsea/i)
  })

  it('claims empty-title Serp CDN hits when job query names Cucurella', () => {
    const query = '"Marc Cucurella" Chelsea hair'
    const emptyTitle = {
      url: 'https://encrypted-tbn0.gstatic.com/images?q=cuc-cdn-1',
      title: '',
      source: 'serpapi',
      width: 800,
      height: 1200,
    }
    const score = scoreOxylabsHitForScene(emptyTitle, {
      topic: 'Marc Cucurella',
      subject: 'Marc Cucurella',
      imageQuery: query,
      jobQuery: query,
    })
    assert.ok(score > -100, `empty-title + named query must be claimable, got ${score}`)
    const claimed = claimOxylabsPoolHit({
      hits: [
        emptyTitle,
        {
          url: 'https://cdn.example.com/wrong.jpg',
          title: 'Cristiano Ronaldo',
          source: 'serpapi',
        },
      ],
      claimed: new Set(),
      subject: 'Marc Cucurella',
      topic: 'Marc Cucurella',
      imageQuery: query,
      jobQuery: query,
      keyPrefix: 'serpapi',
    })
    assert.ok(claimed, 'must claim the empty-title Cucurella Serp hit')
    assert.match(claimed.imgUrl, /cuc-cdn-1/)
  })

  it('still claims empty-title Cucurella hits that carry a low visionScore', () => {
    // Name-cue fallback can leave hits with visionScore=2–3 from Grok on tiny CDN thumbs.
    // Old scorer hard-rejected any vision < MIN even when emptyTitleQueryOk — Build still failed.
    const query = '"Marc Cucurella" Chelsea hair'
    const hit = {
      url: 'https://encrypted-tbn0.gstatic.com/images?q=cuc-low-vision',
      title: '',
      source: 'serpapi',
      visionScore: 3,
      width: 800,
      height: 1200,
    }
    const score = scoreOxylabsHitForScene(hit, {
      topic: 'Marc Cucurella',
      subject: 'Marc Cucurella',
      imageQuery: query,
      jobQuery: query,
    })
    assert.ok(score > -100, `low-vision empty-title must stay claimable, got ${score}`)
    const claimed = claimOxylabsPoolHit({
      hits: [hit],
      claimed: new Set(),
      subject: 'Marc Cucurella',
      topic: 'Marc Cucurella',
      imageQuery: query,
      jobQuery: query,
      keyPrefix: 'serpapi',
    })
    assert.ok(claimed, 'must claim low-vision empty-title Cucurella hit')
  })

  it('surfaces Oxylabs auth failure (not only Wikimedia) in no-images errors', () => {
    const msg = formatEofNoSceneImagesError({
      topic: "Why Mark Cuccorea doesn't cut his hair",
      providerOrder: ['serpapi', 'oxylabs'],
      providerAttempts: [
        { provider: 'serpapi', status: 'auth_failed', detail: 'Unauthorized', hits: 0 },
        { provider: 'oxylabs', status: 'auth_failed', detail: 'Unauthorized', hits: 0 },
      ],
      wikiHits: 0,
      subject: 'Marc Cucurella',
    })
    assert.match(msg, /SerpAPI auth failed/i)
    assert.match(msg, /Oxylabs auth failed/i)
    assert.match(msg, /Wikimedia\/Commons/i)
    assert.doesNotMatch(msg, /^No real scene images.*Wikidata\/Commons returned nothing usable$/)
  })

  it('mentions subject-name filter when scrape hits were emptied post-filter', () => {
    const msg = formatEofNoSceneImagesError({
      topic: 'Test',
      providerOrder: ['serpapi'],
      providerAttempts: [{ provider: 'serpapi', status: 'ok', hits: 8, query: '"Marc Cucurella" Chelsea hair' }],
      scrapeHitsBeforeFilter: 8,
      scrapeHitsAfterFilter: 0,
      wikiHits: 0,
      subject: 'Marc Cucurella',
    })
    assert.match(msg, /post-filter emptied|subject-name\/vision filter dropped/i)
    assert.match(msg, /Marc Cucurella/)
  })

  it('biases job queries toward pundit stills when the script is a TV take', () => {
    const draft =
      'Wayne Rooney slammed Cristiano Ronaldo on Sky Sports. The pundit said the service is the problem.'
    const q0 = buildOxylabsJobQuery('Rooney on Ronaldo', 0, { plainTextDraft: draft })
    const q1 = buildOxylabsJobQuery('Rooney on Ronaldo', 1, { plainTextDraft: draft })
    assert.match(q0, /Wayne Rooney/i)
    assert.match(q0, /pundit/i)
    assert.doesNotMatch(q0, /football action|celebrating|Manchester United 2008/i)
    assert.match(q1, /studio|TV/i)
  })

  it('biases job queries toward playing action for career scripts', () => {
    const draft =
      'Wayne Rooney scored that Champions League final goal in 2008. The celebration still lives on.'
    const q0 = buildOxylabsJobQuery('Wayne Rooney Champions League final', 0, { plainTextDraft: draft })
    const q2 = buildOxylabsJobQuery('Wayne Rooney Champions League final', 2, { plainTextDraft: draft })
    assert.match(q0, /"Wayne Rooney" football/)
    assert.match(q2, /celebrating|action/i)
    assert.doesNotMatch(q0, /pundit/i)
  })

  it('ranks pundit studio titles above playing kit titles for Rooney TV scripts', () => {
    const year = new Date().getFullYear()
    const hits = [
      {
        url: 'https://cdn.example.com/rooney-2008-kit.jpg',
        title: 'Wayne Rooney Manchester United kit celebration goal 2008',
        width: 900,
        height: 1200,
      },
      {
        url: 'https://cdn.example.com/rooney-studio.jpg',
        title: `Wayne Rooney Sky Sports pundit studio suit ${year}`,
        width: 900,
        height: 1200,
      },
    ]
    const claimed = new Set()
    const pick = claimOxylabsPoolHit({
      hits,
      claimed,
      topic: 'Wayne Rooney on Ronaldo',
      imageQuery: 'Wayne Rooney pundit',
      caption: 'Rooney slammed him from the studio desk',
      plainTextDraft:
        'Wayne Rooney slammed Ronaldo on Sky Sports. The pundit tore into the service.',
      index: 0,
    })
    assert.equal(pick.imgUrl, 'https://cdn.example.com/rooney-studio.jpg')
    assert.ok(
      scoreOxylabsHitForScene(hits[1], {
        topic: 'Wayne Rooney on Ronaldo',
        imageQuery: 'Wayne Rooney pundit',
        caption: 'studio desk',
        intent: 'pundit',
      }) >
        scoreOxylabsHitForScene(hits[0], {
          topic: 'Wayne Rooney on Ronaldo',
          imageQuery: 'Wayne Rooney pundit',
          caption: 'studio desk',
          intent: 'pundit',
        }),
    )
  })

  it('prefers portrait stills over ultra-wide landscapes for Shorts', () => {
    const portrait = scoreImageCandidate('https://cdn.example.com/a.jpg', 900, 1400)
    const wide = scoreImageCandidate('https://cdn.example.com/b.jpg', 1600, 900)
    assert.ok(portrait > wide, `portrait (${portrait}) should beat wide (${wide})`)
  })

  it('is opt-in: credentials alone do not configure; needs OXYLABS_ENABLED=1', () => {
    const prev = {
      user: process.env.OXYLABS_USERNAME,
      pass: process.env.OXYLABS_PASSWORD,
      enabled: process.env.OXYLABS_ENABLED,
      disabled: process.env.OXYLABS_DISABLED,
    }
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    delete process.env.OXYLABS_ENABLED
    delete process.env.OXYLABS_DISABLED
    assert.equal(isEofOxylabsEnabled(), false)
    assert.equal(isEofOxylabsConfigured(), false)

    process.env.OXYLABS_USERNAME = 'test-user'
    process.env.OXYLABS_PASSWORD = 'test-pass'
    // Stale Vercel keys without opt-in must stay off
    assert.equal(isEofOxylabsConfigured(), false)

    process.env.OXYLABS_ENABLED = '1'
    assert.equal(isEofOxylabsEnabled(), true)
    assert.equal(isEofOxylabsConfigured(), true)

    process.env.OXYLABS_DISABLED = '1'
    assert.equal(isEofOxylabsConfigured(), false)

    for (const [k, v] of Object.entries({
      OXYLABS_USERNAME: prev.user,
      OXYLABS_PASSWORD: prev.pass,
      OXYLABS_ENABLED: prev.enabled,
      OXYLABS_DISABLED: prev.disabled,
    })) {
      if (v == null) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('provider order skips Oxylabs when not opted in (SerpAPI only)', () => {
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('auto', { serpapi: true, oxylabs: false }),
      ['serpapi'],
    )
    assert.deepEqual(
      resolveEofImageProviderAttemptOrder('oxylabs', { serpapi: true, oxylabs: false }),
      ['serpapi'],
    )
  })

  it('extracts image URLs from Oxylabs organic payload', () => {
    const rows = extractOxylabsImageRows({
      results: [
        {
          content: {
            results: {
              organic: [
                {
                  pos: 1,
                  title: 'Thomas Tuchel England',
                  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTestThumb&s',
                  link: '/url?q=https://example.com/photo',
                },
                {
                  pos: 2,
                  title: 'Full size',
                  high_res_image: 'https://cdn.example.com/photos/tuchel-england.jpg',
                  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcOther&s',
                  width: 1200,
                  height: 1600,
                },
              ],
            },
          },
        },
      ],
    })
    assert.ok(rows.length >= 1)
    assert.equal(rows[0].url, 'https://cdn.example.com/photos/tuchel-england.jpg')
    assert.ok(rows.some((r) => r.url.includes('gstatic.com') || r.url.includes('example.com')))
  })

  it('skips avoided URLs across the SERP pool (not just modulo first hit)', () => {
    const hits = mockHits(5)
    const picked = pickOxylabsImageFromHits(hits, {
      index: 0,
      avoidUrls: ['oxylabs:https://cdn.example.com/photo-0.jpg', 'https://cdn.example.com/photo-1.jpg'],
    })
    assert.equal(picked.imgUrl, 'https://cdn.example.com/photo-2.jpg')
    assert.equal(picked.reused, false)
  })

  it('simulates 20 rebuild picks with growing avoidKeys from one SERP pool', () => {
    const hits = mockHits(20)
    const history = []
    const pickedUrls = []
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const picked = pickOxylabsImageFromHits(hits, {
        index: attempt * 7,
        avoidUrls: history,
      })
      assert.ok(picked, `attempt ${attempt} should still find a hit`)
      pickedUrls.push(picked.imgUrl)
      history.push(`oxylabs:${picked.imgUrl}`)
      // Until the pool is exhausted, every pick must be fresh.
      if (attempt < 20) assert.equal(picked.reused, false, `attempt ${attempt} should be unused`)
    }
    assert.equal(new Set(pickedUrls).size, 20, '20 rebuilds should use 20 distinct URLs from a 20-hit SERP')

    // 21st pick must fall back (entire pool avoided).
    const overflow = pickOxylabsImageFromHits(hits, { index: 21 * 7, avoidUrls: history })
    assert.ok(overflow)
    assert.equal(overflow.reused, true)
  })

  it('caps billable Google Images queries to ≤2 per Short (lead + optional secondary)', () => {
    assert.equal(EOF_OXYLABS_MAX_QUERIES_PER_JOB, 2)
  })

  it('claims unique pool URLs across 7 concurrent scenes (one SERP, seven stills)', () => {
    const hits = mockHits(12)
    const claimed = new Set()
    const keys = []
    for (let scene = 0; scene < 7; scene += 1) {
      const hit = claimOxylabsPoolHit({ hits, claimed, index: scene })
      assert.ok(hit, `scene ${scene}`)
      keys.push(hit.key)
    }
    assert.equal(new Set(keys).size, 7)
    assert.equal(claimed.size, 7)
  })

  it('claims the SERP title that matches the scene beat (tactics vs celebration)', () => {
    const hits = [
      { url: 'https://cdn.example.com/celebrate.jpg', title: 'Thomas Tuchel celebrating goal', width: 900, height: 1200 },
      { url: 'https://cdn.example.com/tactics.jpg', title: 'Thomas Tuchel tactics board England', width: 1000, height: 1400 },
      { url: 'https://cdn.example.com/crowd.jpg', title: 'Wembley stadium crowd night', width: 1600, height: 900 },
    ]
    const claimed = new Set()
    const pick = claimOxylabsPoolHit({
      hits,
      claimed,
      topic: 'Did Tuchel tactics cost England?',
      imageQuery: 'Thomas Tuchel tactics board',
      caption: 'Did his tactics cost England?',
      index: 0,
    })
    assert.equal(pick.imgUrl, 'https://cdn.example.com/tactics.jpg')
    assert.ok(
      scoreOxylabsHitForScene(hits[1], {
        topic: 'Did Tuchel tactics cost England?',
        imageQuery: 'Thomas Tuchel tactics board',
        caption: 'tactics England',
      }) >
        scoreOxylabsHitForScene(hits[2], {
          topic: 'Did Tuchel tactics cost England?',
          imageQuery: 'Thomas Tuchel tactics board',
          caption: 'tactics England',
        }),
    )
  })

  it('lists fresh candidates before avoided ones for download retries', () => {
    const hits = mockHits(4)
    const list = listOxylabsImageCandidates(hits, {
      index: 0,
      avoidUrls: ['https://cdn.example.com/photo-0.jpg'],
    })
    assert.equal(list[0].imgUrl, 'https://cdn.example.com/photo-1.jpg')
    assert.equal(list[0].reused, false)
    assert.equal(list.at(-1).imgUrl, 'https://cdn.example.com/photo-0.jpg')
    assert.equal(list.at(-1).reused, true)
    assert.deepEqual(
      orderOxylabsHitsForRotation(hits, 2).map((h) => h.url),
      [
        'https://cdn.example.com/photo-2.jpg',
        'https://cdn.example.com/photo-3.jpg',
        'https://cdn.example.com/photo-0.jpg',
        'https://cdn.example.com/photo-1.jpg',
      ],
    )
  })
})

describe('eofOxylabs search health messaging', () => {
  it('skips network when opt-in is off even if stale credentials exist', async () => {
    const prev = {
      user: process.env.OXYLABS_USERNAME,
      pass: process.env.OXYLABS_PASSWORD,
      enabled: process.env.OXYLABS_ENABLED,
      disabled: process.env.OXYLABS_DISABLED,
    }
    process.env.OXYLABS_USERNAME = 'stale-user'
    process.env.OXYLABS_PASSWORD = 'stale-pass'
    delete process.env.OXYLABS_ENABLED
    delete process.env.OXYLABS_DISABLED
    let fetchCalled = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      fetchCalled = true
      throw new Error('should not call Oxylabs')
    }
    try {
      assert.equal(isEofOxylabsConfigured(), false)
      const { hits, health } = await searchOxylabsGoogleImagesWithStatus('England kit')
      assert.deepEqual(hits, [])
      assert.equal(health.status, 'not_configured')
      assert.equal(health.disabled, true)
      assert.equal(fetchCalled, false)
      assert.match(formatOxylabsSearchHealthNote(health), /opt-in|OXYLABS_ENABLED/i)
    } finally {
      globalThis.fetch = originalFetch
      for (const [k, v] of Object.entries({
        OXYLABS_USERNAME: prev.user,
        OXYLABS_PASSWORD: prev.pass,
        OXYLABS_ENABLED: prev.enabled,
        OXYLABS_DISABLED: prev.disabled,
      })) {
        if (v == null) delete process.env[k]
        else process.env[k] = v
      }
    }
  })

  it('reports not_configured clearly when enabled but credentials are missing', async () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    const prevUserAlias = process.env.OXYLABS_USER
    const prevPassAlias = process.env.OXYLABS_PASS
    const prevEnabled = process.env.OXYLABS_ENABLED
    const prevDisabled = process.env.OXYLABS_DISABLED
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    delete process.env.OXYLABS_USER
    delete process.env.OXYLABS_PASS
    delete process.env.OXYLABS_DISABLED
    process.env.OXYLABS_ENABLED = '1'
    try {
      assert.equal(isEofOxylabsConfigured(), false)
      const { hits, health } = await searchOxylabsGoogleImagesWithStatus('England kit')
      assert.deepEqual(hits, [])
      assert.equal(health.status, 'not_configured')
      assert.equal(health.softFallback, true)
      assert.match(formatOxylabsSearchHealthNote(health), /credentials missing|soft-falling/i)
    } finally {
      if (prevUser == null) delete process.env.OXYLABS_USERNAME
      else process.env.OXYLABS_USERNAME = prevUser
      if (prevPass == null) delete process.env.OXYLABS_PASSWORD
      else process.env.OXYLABS_PASSWORD = prevPass
      if (prevUserAlias == null) delete process.env.OXYLABS_USER
      else process.env.OXYLABS_USER = prevUserAlias
      if (prevPassAlias == null) delete process.env.OXYLABS_PASS
      else process.env.OXYLABS_PASS = prevPassAlias
      if (prevEnabled == null) delete process.env.OXYLABS_ENABLED
      else process.env.OXYLABS_ENABLED = prevEnabled
      if (prevDisabled == null) delete process.env.OXYLABS_DISABLED
      else process.env.OXYLABS_DISABLED = prevDisabled
    }
  })

  it('maps 401 responses to auth_failed SEARCH DOWN (soft-fallback)', async () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    const prevEnabled = process.env.OXYLABS_ENABLED
    const prevDisabled = process.env.OXYLABS_DISABLED
    process.env.OXYLABS_USERNAME = 'eof-test-user'
    process.env.OXYLABS_PASSWORD = 'eof-test-pass'
    process.env.OXYLABS_ENABLED = '1'
    delete process.env.OXYLABS_DISABLED
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response('unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } })
    try {
      const { hits, health } = await searchOxylabsGoogleImagesWithStatus('England kit')
      assert.deepEqual(hits, [])
      assert.equal(health.status, 'auth_failed')
      assert.equal(health.httpStatus, 401)
      assert.equal(health.softFallback, true)
      assert.match(formatOxylabsSearchHealthNote(health), /SEARCH DOWN|auth/i)
    } finally {
      globalThis.fetch = originalFetch
      if (prevUser == null) delete process.env.OXYLABS_USERNAME
      else process.env.OXYLABS_USERNAME = prevUser
      if (prevPass == null) delete process.env.OXYLABS_PASSWORD
      else process.env.OXYLABS_PASSWORD = prevPass
      if (prevEnabled == null) delete process.env.OXYLABS_ENABLED
      else process.env.OXYLABS_ENABLED = prevEnabled
      if (prevDisabled == null) delete process.env.OXYLABS_DISABLED
      else process.env.OXYLABS_DISABLED = prevDisabled
    }
  })
})

describe('eof remux stills-preflight skip (P0)', () => {
  it('skips stills preflight for remux / reuseSceneImages / skipStillsPreflight', () => {
    assert.equal(shouldSkipEofStillsPreflight({}), false)
    assert.equal(shouldSkipEofStillsPreflight({ skipStillsPreflight: true }), true)
    assert.equal(shouldSkipEofStillsPreflight({ reuseSceneImages: true }), true)
    assert.equal(
      shouldSkipEofStillsPreflight({ reuseSceneImages: true, skipStillsPreflight: true }),
      true,
    )
    assert.equal(shouldSkipEofStillsPreflight({ reuseSceneImages: false }), false)
  })
})

describe('eof hang fail-fast + placeholder rebuild', () => {
  it('detects prior placeholder stills so Rebuild forces a fresh Serp fetch', () => {
    assert.equal(priorStillsWerePlaceholders([]), false)
    assert.equal(
      priorStillsWerePlaceholders([
        { imageSource: 'serpapi', imageKey: 'serpapi:https://a.jpg' },
        { imageSource: 'placeholder', imageKey: 'p' },
      ]),
      false,
    )
    assert.equal(
      priorStillsWerePlaceholders([
        { imageSource: 'placeholder', imageKey: 'p0' },
        { imageSource: 'placeholder-no-image-keys', imageKey: 'p1' },
      ]),
      true,
    )
  })

  it('explicit Build forceFresh clears avoidKeys even when prior Serp keys were real (Cucurella poison)', () => {
    // After ~40 rebuilds the job holds 32 real Serp keys — NOT placeholders — so the old
    // priorStillsWerePlaceholders gate left avoidKeys intact and the pool exhausted.
    const poisoned = [
      {
        index: 0,
        imageSource: 'serpapi',
        imageKey: 'serpapi:https://cdn.example.com/cuc-1.jpg',
        imageKeyHistory: Array.from(
          { length: 32 },
          (_, i) => `serpapi:https://cdn.example.com/cuc-${i}.jpg`,
        ),
        lineHash: 'keep-me-for-tts',
      },
    ]
    assert.equal(priorStillsWerePlaceholders(poisoned), false)
    assert.equal(
      shouldForceFreshEofSceneImages({ forceFreshImages: true }, poisoned),
      true,
      'explicit Build must force fresh even when prior stills were real Serp claims',
    )
    assert.equal(
      shouldForceFreshEofSceneImages({}, poisoned),
      false,
      'without explicit flag, real Serp history must not auto-wipe (Rebuild rotation still works)',
    )

    const cleared = clearEofImageAvoidHistoryFromManifest(poisoned)
    assert.equal(cleared[0].lineHash, 'keep-me-for-tts', 'TTS line hash must survive the wipe')
    assert.deepEqual(cleared[0].imageKeyHistory, [])
    assert.equal(cleared[0].imageAttempt, 0)
  })

  it('marks rendering jobs stale when quiet (Hobby) or over max age', () => {
    const now = Date.now()
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 10_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 10_000).toISOString() },
        },
        { now, maxAgeSec: 280, maxQuietSec: 50, allowQuietKill: true },
      ),
      false,
    )
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 55_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 55_000).toISOString() },
        },
        { now, maxAgeSec: 280, maxQuietSec: 50, allowQuietKill: true },
      ),
      true,
      'Hobby quiet > 50s must stale (silent isolate kill)',
    )
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 55_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 55_000).toISOString() },
        },
        { now, maxAgeSec: 280, maxQuietSec: 50, allowQuietKill: false },
      ),
      false,
      'Pro must not quiet-kill under max age',
    )
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 5_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 150_000).toISOString() },
        },
        { now, maxAgeSec: 280, maxQuietSec: 50, allowQuietKill: false },
      ),
      false,
      'healthy heartbeats at 150s must NOT stale (encode can still finish under 280s)',
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
      'Pro default: age 281 with heartbeat must NOT stale (exact Cucurella failure)',
    )
    assert.equal(
      isEofRenderStale(
        {
          status: 'rendering_video',
          updatedAt: new Date(now - 5_000).toISOString(),
          renderProgress: { startedAt: new Date(now - 290_000).toISOString() },
        },
        { now, maxAgeSec: 280, maxQuietSec: 50, allowQuietKill: false },
      ),
      true,
      'explicit Hobby-style maxAge 280 still age-kills even with heartbeats',
    )
  })

  it('withDeadline rejects hung work instead of freezing forever', async () => {
    await assert.rejects(
      () => withDeadline(new Promise(() => {}), 50, 'Test stage'),
      /Test stage timed out after/,
    )
  })
})

describe('eof rebuild image history + persist guard', () => {
  it(`retains last ${32} image keys so 20 rebuilds stay in the avoid set`, () => {
    assert.ok(EOF_IMAGE_KEY_HISTORY_LIMIT >= 24)
    let history = []
    for (let i = 0; i < 40; i += 1) {
      history = appendEofImageKeyHistory(history, `oxylabs:https://cdn.example.com/p-${i}.jpg`)
    }
    assert.equal(history.length, EOF_IMAGE_KEY_HISTORY_LIMIT)
    assert.ok(history.includes('oxylabs:https://cdn.example.com/p-39.jpg'))
    assert.ok(history.includes('oxylabs:https://cdn.example.com/p-8.jpg'))
    assert.equal(history.includes('oxylabs:https://cdn.example.com/p-7.jpg'), false)
  })

  it('fail-hard when persist cannot store video_base64', () => {
    assert.throws(
      () => assertEofVideoPersisted({ saved: false, bytes: 12_000_000, recompressed: true }),
      /could not be stored for preview/,
    )
    const ok = assertEofVideoPersisted({ saved: true, bytes: 1_000_000, recompressed: false })
    assert.equal(ok.saved, true)
  })
})
