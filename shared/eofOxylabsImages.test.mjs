import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEofOxylabsConfigured,
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
import {
  appendEofImageKeyHistory,
  assertEofVideoPersisted,
  shouldSkipEofStillsPreflight,
  formatEofNoSceneImagesError,
  EOF_IMAGE_KEY_HISTORY_LIMIT,
} from '../backend/api/lib/eofProductionRenderVideo.mjs'

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

  it('reports configured from OXYLABS_USERNAME + OXYLABS_PASSWORD', () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    assert.equal(isEofOxylabsConfigured(), false)
    process.env.OXYLABS_USERNAME = 'test-user'
    process.env.OXYLABS_PASSWORD = 'test-pass'
    assert.equal(isEofOxylabsConfigured(), true)
    if (prevUser == null) delete process.env.OXYLABS_USERNAME
    else process.env.OXYLABS_USERNAME = prevUser
    if (prevPass == null) delete process.env.OXYLABS_PASSWORD
    else process.env.OXYLABS_PASSWORD = prevPass
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
  it('reports not_configured clearly when credentials are missing', async () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    const prevUserAlias = process.env.OXYLABS_USER
    const prevPassAlias = process.env.OXYLABS_PASS
    delete process.env.OXYLABS_USERNAME
    delete process.env.OXYLABS_PASSWORD
    delete process.env.OXYLABS_USER
    delete process.env.OXYLABS_PASS
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
    }
  })

  it('maps 401 responses to auth_failed SEARCH DOWN (soft-fallback)', async () => {
    const prevUser = process.env.OXYLABS_USERNAME
    const prevPass = process.env.OXYLABS_PASSWORD
    process.env.OXYLABS_USERNAME = 'eof-test-user'
    process.env.OXYLABS_PASSWORD = 'eof-test-pass'
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
