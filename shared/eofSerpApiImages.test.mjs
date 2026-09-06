import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEofSerpApiConfigured,
  getSerpApiKey,
  buildSerpApiImagesSearchUrl,
  extractSerpApiImageRows,
  claimSerpApiPoolHit,
  searchSerpApiGoogleImages,
  searchSerpApiGoogleImagesWithStatus,
  formatSerpApiSearchHealthNote,
  fetchEofSerpApiJobPool,
  withoutAmericanSportsAmbiguity,
  EOF_SERPAPI_MAX_QUERIES_PER_JOB,
  serpApiEngine,
} from '../backend/api/lib/eofSerpApiImages.mjs'
import { filterHitsRequiringSubjectNameCue } from './eofSceneImageQueries.mjs'

describe('eofSerpApiImages', () => {
  it('detects SERPAPI_API_KEY and SERP_API_KEY alias', () => {
    const prevPrimary = process.env.SERPAPI_API_KEY
    const prevAlias = process.env.SERP_API_KEY
    const prevShort = process.env.SERPAPI_KEY
    const prevEof = process.env.EOF_SERPAPI_API_KEY
    delete process.env.SERPAPI_API_KEY
    delete process.env.SERP_API_KEY
    delete process.env.SERPAPI_KEY
    delete process.env.EOF_SERPAPI_API_KEY
    assert.equal(isEofSerpApiConfigured(), false)
    assert.equal(getSerpApiKey(), '')

    process.env.SERP_API_KEY = 'alias-key'
    assert.equal(isEofSerpApiConfigured(), true)
    assert.equal(getSerpApiKey(), 'alias-key')

    process.env.SERPAPI_API_KEY = 'primary-key'
    assert.equal(getSerpApiKey(), 'primary-key')

    delete process.env.SERPAPI_API_KEY
    delete process.env.SERP_API_KEY
    process.env.SERPAPI_KEY = 'short-alias'
    assert.equal(getSerpApiKey(), 'short-alias')

    if (prevPrimary == null) delete process.env.SERPAPI_API_KEY
    else process.env.SERPAPI_API_KEY = prevPrimary
    if (prevAlias == null) delete process.env.SERP_API_KEY
    else process.env.SERP_API_KEY = prevAlias
    if (prevShort == null) delete process.env.SERPAPI_KEY
    else process.env.SERPAPI_KEY = prevShort
    if (prevEof == null) delete process.env.EOF_SERPAPI_API_KEY
    else process.env.EOF_SERPAPI_API_KEY = prevEof
  })

  it('excludes American-football terms from ambiguous "football" queries', () => {
    // Regression: a bare "<subject> football" query returned NFL results (no
    // gl/hl locale hint means Google's default lean is American-football-
    // heavy for the word "football"). Exclude it at the search level.
    assert.match(withoutAmericanSportsAmbiguity('"Antonio" football'), /-nfl/)
    assert.match(withoutAmericanSportsAmbiguity('"Antonio" football manager'), /-"american football"/i)
    assert.doesNotMatch(withoutAmericanSportsAmbiguity(''), /-nfl/)
    // Queries that never say "football" at all have nothing to disambiguate.
    assert.equal(withoutAmericanSportsAmbiguity('"Marc Cucurella" Chelsea hair'), '"Marc Cucurella" Chelsea hair')
    // A caller that explicitly wants NFL content must not have it excluded.
    assert.doesNotMatch(withoutAmericanSportsAmbiguity('Tom Brady nfl highlights'), /-nfl/)
  })

  it('sends the American-sports exclusion in the actual outgoing SerpAPI request', async () => {
    const prevKey = process.env.SERPAPI_API_KEY
    process.env.SERPAPI_API_KEY = 'mock-key'
    const originalFetch = globalThis.fetch
    const fetchMock = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ images_results: [] }),
      text: async () => '',
    }))
    globalThis.fetch = fetchMock
    try {
      await searchSerpApiGoogleImagesWithStatus('"Antonio" football', { limit: 5 })
      const calledUrl = new URL(String(fetchMock.mock.calls[0].arguments[0]))
      assert.match(calledUrl.searchParams.get('q') || '', /-nfl/, 'the real request must exclude nfl')
    } finally {
      globalThis.fetch = originalFetch
      if (prevKey == null) delete process.env.SERPAPI_API_KEY
      else process.env.SERPAPI_API_KEY = prevKey
    }
  })

  it('builds google_images URL with optional gl/hl and never logs the key in path alone', () => {
    const prevEngine = process.env.SERPAPI_ENGINE
    const prevGl = process.env.SERPAPI_GL
    const prevHl = process.env.SERPAPI_HL
    process.env.SERPAPI_ENGINE = 'google_images'
    process.env.SERPAPI_GL = 'uk'
    process.env.SERPAPI_HL = 'en'

    const url = buildSerpApiImagesSearchUrl('"Wayne Rooney" football', {
      apiKey: 'test-secret-key',
    })
    assert.equal(url.origin + url.pathname, 'https://serpapi.com/search.json')
    assert.equal(url.searchParams.get('engine'), 'google_images')
    assert.equal(url.searchParams.get('q'), '"Wayne Rooney" football')
    assert.equal(url.searchParams.get('gl'), 'uk')
    assert.equal(url.searchParams.get('hl'), 'en')
    assert.equal(url.searchParams.get('api_key'), 'test-secret-key')
    assert.equal(serpApiEngine(), 'google_images')

    if (prevEngine == null) delete process.env.SERPAPI_ENGINE
    else process.env.SERPAPI_ENGINE = prevEngine
    if (prevGl == null) delete process.env.SERPAPI_GL
    else process.env.SERPAPI_GL = prevGl
    if (prevHl == null) delete process.env.SERPAPI_HL
    else process.env.SERPAPI_HL = prevHl
  })

  it('extracts original image URLs from SerpAPI images_results', () => {
    const rows = extractSerpApiImageRows({
      images_results: [
        {
          position: 1,
          title: 'Tiny thumb only',
          thumbnail: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThumb&s',
          original: null,
        },
        {
          position: 2,
          title: 'Wayne Rooney Everton portrait',
          thumbnail: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcOther&s',
          original: 'https://cdn.example.com/photos/rooney-portrait.jpg',
          original_width: 1000,
          original_height: 1400,
        },
        {
          position: 3,
          title: 'Wide landscape',
          original: 'https://cdn.example.com/photos/wide.jpg',
          original_width: 1600,
          original_height: 900,
        },
      ],
    })

    it('never mistakes a SerpAPI source-page link for an image URL', () => {
      const rows = extractSerpApiImageRows({
        images_results: [
          {
            title: 'Sir Alex Ferguson profile',
            link: 'https://news.example.com/sir-alex-ferguson-profile',
            thumbnail: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:thumb-only',
          },
        ],
      })
      assert.deepEqual(rows, [])
    })
    assert.ok(rows.length >= 1)
    assert.equal(rows[0].url, 'https://cdn.example.com/photos/rooney-portrait.jpg')
    assert.equal(rows[0].title, 'Wayne Rooney Everton portrait')
    assert.ok(rows.some((r) => r.url.includes('wide.jpg')))
    assert.ok(
      rows.every((r) => !r.url.includes('encrypted-tbn0.gstatic.com')),
      'thumbnail-only Google CDN rows must not be promoted to production stills',
    )
  })

  it('drops wrong-person and blank-metadata rows before creating a named-subject job pool', async () => {
    const prevKey = process.env.SERPAPI_API_KEY
    process.env.SERPAPI_API_KEY = 'mock-key'
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        images_results: [
          {
            title: 'Sir Alex Ferguson watches Manchester United train',
            original: 'https://cdn.example.com/sir-alex-ferguson-training.jpg',
            original_width: 900,
            original_height: 1200,
          },
          {
            title: 'Manchester City transfer graphic',
            original: 'https://cdn.example.com/city-transfer.jpg',
            original_width: 1080,
            original_height: 1080,
          },
          {
            title: '',
            original: 'https://cdn.example.com/unlabelled.jpg',
            original_width: 1080,
            original_height: 1920,
          },
        ],
      }),
      text: async () => '',
    }))
    try {
      const pool = await fetchEofSerpApiJobPool({
        topic: 'Windows',
        plainTextDraft: 'Fourteen transfer windows after Sir Alex walked out the door.',
        sceneCount: 3,
      })
      assert.equal(pool.subject, 'Sir Alex Ferguson')
      const strict = filterHitsRequiringSubjectNameCue(pool.hits, pool.subject, { log: false })
      assert.deepEqual(strict.map((hit) => hit.title), ['Sir Alex Ferguson watches Manchester United train'])
    } finally {
      globalThis.fetch = originalFetch
      if (prevKey == null) delete process.env.SERPAPI_API_KEY
      else process.env.SERPAPI_API_KEY = prevKey
    }
  })

  it('caps billable Google Images queries to ≤2 per Short job (lead + optional secondary)', () => {
    assert.equal(EOF_SERPAPI_MAX_QUERIES_PER_JOB, 2)
  })

  it('claims unique pool URLs with serpapi: keys', () => {
    const hits = [
      { url: 'https://cdn.example.com/a.jpg', title: 'A', width: 800, height: 1200 },
      { url: 'https://cdn.example.com/b.jpg', title: 'B', width: 800, height: 1200 },
    ]
    const claimed = new Set()
    const first = claimSerpApiPoolHit({ hits, claimed, index: 0 })
    const second = claimSerpApiPoolHit({ hits, claimed, index: 1 })
    assert.ok(first.key.startsWith('serpapi:'))
    assert.ok(second.key.startsWith('serpapi:'))
    assert.notEqual(first.imgUrl, second.imgUrl)
    assert.equal(claimed.size, 2)
  })

  it('parses mocked fetch search responses without calling the real API', async () => {
    const prevKey = process.env.SERPAPI_API_KEY
    process.env.SERPAPI_API_KEY = 'mock-key'

    const originalFetch = globalThis.fetch
    const fetchMock = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        images_results: [
          {
            title: 'Mock football still',
            original: 'https://cdn.example.com/mock-football.jpg',
            original_width: 900,
            original_height: 1200,
          },
        ],
      }),
      text: async () => '',
    }))
    globalThis.fetch = fetchMock

    try {
      const hits = await searchSerpApiGoogleImages('Wayne Rooney football', { limit: 5 })
      assert.equal(hits.length, 1)
      assert.equal(hits[0].url, 'https://cdn.example.com/mock-football.jpg')
      assert.equal(hits[0].source, 'serpapi')
      assert.equal(fetchMock.mock.callCount(), 1)
      const calledUrl = String(fetchMock.mock.calls[0].arguments[0])
      assert.match(calledUrl, /serpapi\.com\/search\.json/)
      assert.match(calledUrl, /engine=google_images/)
      assert.doesNotMatch(calledUrl, /oxylabs/)
    } finally {
      globalThis.fetch = originalFetch
      if (prevKey == null) delete process.env.SERPAPI_API_KEY
      else process.env.SERPAPI_API_KEY = prevKey
    }
  })

  it('uses a tight default timeout so hung SerpAPI sockets fail fast', async () => {
    const prevKey = process.env.SERPAPI_API_KEY
    const prevTimeout = process.env.EOF_SERPAPI_TIMEOUT_MS
    process.env.SERPAPI_API_KEY = 'mock-key'
    delete process.env.EOF_SERPAPI_TIMEOUT_MS

    const originalFetch = globalThis.fetch
    globalThis.fetch = mock.fn((_url, init = {}) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ images_results: [] }),
            text: async () => '',
          })
        }, 30_000)
        const onAbort = () => {
          clearTimeout(timer)
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        }
        if (init.signal?.aborted) onAbort()
        else init.signal?.addEventListener('abort', onAbort, { once: true })
      })
    })

    try {
      const started = Date.now()
      // Floor is 2s — still far below the old 45s Serp hang.
      const { hits, health } = await searchSerpApiGoogleImagesWithStatus('Marc Cucurella hair', {
        limit: 3,
        timeoutMs: 2_000,
      })
      const elapsed = Date.now() - started
      assert.equal(hits.length, 0)
      assert.equal(health.status, 'timeout')
      assert.ok(elapsed < 6_000, `expected fast fail, took ${elapsed}ms`)
    } finally {
      globalThis.fetch = originalFetch
      if (prevKey == null) delete process.env.SERPAPI_API_KEY
      else process.env.SERPAPI_API_KEY = prevKey
      if (prevTimeout == null) delete process.env.EOF_SERPAPI_TIMEOUT_MS
      else process.env.EOF_SERPAPI_TIMEOUT_MS = prevTimeout
    }
  })

  it('reports auth_failed health on 401 instead of silent empty hits', async () => {
    const prevKey = process.env.SERPAPI_API_KEY
    process.env.SERPAPI_API_KEY = 'bad-key'
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'Unauthorized',
    }))
    try {
      const { hits, health } = await searchSerpApiGoogleImagesWithStatus('Marc Cucurella', { limit: 3 })
      assert.equal(hits.length, 0)
      assert.equal(health.status, 'auth_failed')
      assert.match(formatSerpApiSearchHealthNote(health), /auth failed/i)
    } finally {
      globalThis.fetch = originalFetch
      if (prevKey == null) delete process.env.SERPAPI_API_KEY
      else process.env.SERPAPI_API_KEY = prevKey
    }
  })
})
