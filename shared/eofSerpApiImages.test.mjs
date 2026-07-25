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
  EOF_SERPAPI_MAX_QUERIES_PER_JOB,
  serpApiEngine,
} from '../backend/api/lib/eofSerpApiImages.mjs'

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
    assert.ok(rows.length >= 1)
    assert.equal(rows[0].url, 'https://cdn.example.com/photos/rooney-portrait.jpg')
    assert.equal(rows[0].title, 'Wayne Rooney Everton portrait')
    assert.ok(rows.some((r) => r.url.includes('wide.jpg')))
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
